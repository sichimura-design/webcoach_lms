"""
AI利用ログ (agents/usage_log.py) の出力内容

- /api/ai/chat 1リクエストにつき event=ai_chat を1行JSONで出す（成功/入力長超過/例外）
- Difyアプリ呼び出し1回につき event=ai_app_call を1行JSONで出す（成功/空応答/タイムアウト/HTTPエラー）
- 発言本文・回答本文はログに含めない
"""
import json
from unittest.mock import MagicMock, patch

import pytest
import requests
from fastapi import HTTPException
from langchain_core.messages import AIMessage, HumanMessage

import agents.tools_langchain as tools_langchain
import agents.usage_log as usage_log
import routers.ai_langgraph as ai_langgraph
from agents.tools_langchain import _call_dify_chat
from routers.ai_langgraph import ChatRequest, _execute_chat, _summarize_llm_usage

PARAMS = {"file_upload": {"enabled": False}, "user_input_form": []}


@pytest.fixture
def usage_events():
    """log_ai_usageが出力したJSON行をパースして集める"""
    events = []
    handler = MagicMock()
    handler.level = 0
    handler.handle.side_effect = lambda record: events.append(json.loads(record.getMessage()))
    usage_log._usage_logger.addHandler(handler)
    yield events
    usage_log._usage_logger.removeHandler(handler)


@pytest.fixture(autouse=True)
def _reset_dify_caches():
    for cache in (
        tools_langchain._dify_conversation_cache,
        tools_langchain._dify_sticky_app_cache,
        tools_langchain._dify_extra_inputs_cache,
        tools_langchain._dify_image_cache,
    ):
        cache.clear()


def _dify_response(payload):
    resp = MagicMock()
    resp.json.return_value = payload
    resp.raise_for_status.return_value = None
    return resp


# ---- ai_app_call (Dify) ----

def test_dify_success_logs_tokens_and_price(usage_events):
    payload = {
        "answer": "案件はこちらです",
        "conversation_id": "conv-1",
        "metadata": {"usage": {"prompt_tokens": 120, "completion_tokens": 30, "total_price": "0.0012", "currency": "USD"}},
    }
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS), \
         patch.object(tools_langchain.requests, "post", return_value=_dify_response(payload)):
        _call_dify_chat("秘密の相談内容", 7, "key", 20, session_id="lesson:3")

    [event] = usage_events
    assert event["event"] == "ai_app_call"
    assert event["status"] == "success"
    assert (event["user_id"], event["app_id"], event["session_id"]) == (7, 20, "lesson:3")
    assert (event["input_tokens"], event["output_tokens"]) == (120, 30)
    assert (event["total_price"], event["currency"]) == ("0.0012", "USD")
    assert event["new_conversation"] is True
    assert event["conversation_id"] == "conv-1"
    assert event["message_chars"] == len("秘密の相談内容")
    assert "duration_ms" in event
    assert "秘密の相談内容" not in json.dumps(event, ensure_ascii=False)


def test_dify_empty_answer_logs_empty_status(usage_events):
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS), \
         patch.object(tools_langchain.requests, "post", return_value=_dify_response({"answer": "", "conversation_id": "c"})):
        _call_dify_chat("q", 7, "key", 20)

    assert usage_events[0]["status"] == "empty"


def test_dify_timeout_logs_timeout_status(usage_events):
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS), \
         patch.object(tools_langchain.requests, "post", side_effect=requests.exceptions.Timeout("slow")):
        _call_dify_chat("q", 7, "key", 20)

    [event] = usage_events
    assert event["status"] == "timeout"
    assert event["error_type"] == "Timeout"


def test_dify_http_error_logs_status_code(usage_events):
    resp = MagicMock(status_code=400)
    error = requests.exceptions.HTTPError("bad", response=resp)
    bad = _dify_response({})
    bad.raise_for_status.side_effect = error
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS), \
         patch.object(tools_langchain.requests, "post", return_value=bad):
        _call_dify_chat("q", 7, "key", 20)

    [event] = usage_events
    assert (event["status"], event["error_type"], event["http_status"]) == ("error", "HTTPError", 400)


# ---- ai_chat (LangGraph) ----

def test_summarize_counts_only_messages_with_usage_and_dify_calls():
    messages = [
        HumanMessage(content="前の質問"),
        AIMessage(content="前の回答"),  # 会話履歴由来: usage_metadata無し → 数えない
        HumanMessage(content="今の質問"),
        AIMessage(
            content="",
            tool_calls=[{"name": "ask_ai_application_20", "args": {}, "id": "t1"}],
            usage_metadata={"input_tokens": 100, "output_tokens": 10, "total_tokens": 110},
        ),
        AIMessage(content="回答", usage_metadata={"input_tokens": 200, "output_tokens": 50, "total_tokens": 250}),
    ]
    assert _summarize_llm_usage(messages) == {
        "llm_calls": 2,
        "input_tokens": 300,
        "output_tokens": 60,
        "dify_app_ids": [20],
    }


def _request(**kwargs):
    return ChatRequest(user_id=7, message="こんにちは", session_id="page:1", **kwargs)


def test_chat_success_logs_ai_chat_event(usage_events):
    fake_graph = MagicMock()
    fake_graph.invoke.return_value = {
        "messages": [AIMessage(content="やあ", usage_metadata={"input_tokens": 50, "output_tokens": 5, "total_tokens": 55})],
        "final_response": "やあ",
        "iteration_count": 1,
    }
    with patch.object(ai_langgraph, "get_learning_coach_graph", return_value=fake_graph), \
         patch("agents.tools_langchain.create_ai_application_tools", return_value=([], None, None)):
        result = _execute_chat(_request(), MagicMock())

    assert result.message == "やあ"
    [event] = usage_events
    assert event["event"] == "ai_chat"
    assert event["status"] == "success"
    assert (event["user_id"], event["session_id"]) == (7, "page:1")
    assert (event["llm_calls"], event["input_tokens"], event["output_tokens"]) == (1, 50, 5)
    assert event["iterations"] == 1
    assert "dify_app_ids" not in event
    assert "こんにちは" not in json.dumps(event, ensure_ascii=False)


def test_chat_input_too_long_logs_rejected(usage_events):
    history = [{"role": "user", "content": "あ" * 3000}] * 10
    with pytest.raises(HTTPException):
        _execute_chat(_request(conversation_history=history), MagicMock())

    [event] = usage_events
    assert (event["status"], event["http_status"]) == ("rejected", 400)


def test_chat_exception_logs_error_and_reraises(usage_events):
    fake_graph = MagicMock()
    fake_graph.invoke.side_effect = RuntimeError("anthropic down")
    with patch.object(ai_langgraph, "get_learning_coach_graph", return_value=fake_graph), \
         patch("agents.tools_langchain.create_ai_application_tools", return_value=([], None, None)):
        with pytest.raises(RuntimeError):
            _execute_chat(_request(), MagicMock())

    [event] = usage_events
    assert (event["status"], event["error_type"]) == ("error", "RuntimeError")
