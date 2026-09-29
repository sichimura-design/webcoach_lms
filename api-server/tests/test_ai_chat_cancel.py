"""
AIチャットの「生成を中止」（agents/run_control.py）

- 本人のrunだけを止める。/chat より先に届いた中止も、あとから始まるrunに効く
- Dify: task_id で停止APIを呼び、ChatCancelled で抜ける。途中までの会話IDは覚えて次の発言で続ける
- LLM: ストリーミングの受信途中で打ち切り、ストリームを閉じる
- /chat: 中止されたら status="cancelled" を返す
"""
import json
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import AIMessageChunk

import agents.run_control as run_control
import agents.tools_langchain as tools_langchain
from agents.learning_coach_agent import _invoke_llm
from agents.run_control import ChatCancelled, cancel_run, finish_run, get_run, start_run
from agents.tools_langchain import _call_dify_chat
from tests.dify_stream_mock import dify_response


@pytest.fixture(autouse=True)
def _reset():
    run_control._runs.clear()
    run_control._early_cancels.clear()
    for cache in (
        tools_langchain._dify_conversation_cache,
        tools_langchain._dify_sticky_app_cache,
        tools_langchain._dify_extra_inputs_cache,
        tools_langchain._dify_image_cache,
        tools_langchain._dify_last_buttons_cache,
    ):
        cache.clear()
    yield
    run_control._runs.clear()
    run_control._early_cancels.clear()


# ---- run の管理 ----

def test_cancel_stops_own_run_only():
    run = start_run("r1", user_id=7)
    assert cancel_run("r1", user_id=8) is False
    assert not run.cancelled
    assert cancel_run("r1", user_id=7) is True
    assert run.cancelled


def test_cancel_before_chat_starts_is_applied_to_that_run():
    cancel_run("r2", user_id=7)
    assert start_run("r2", user_id=7).cancelled


def test_early_cancel_by_other_user_is_ignored():
    cancel_run("r3", user_id=8)
    assert not start_run("r3", user_id=7).cancelled


def test_duplicate_run_id_does_not_take_over_running_run():
    first = start_run("r4", user_id=7)
    second = start_run("r4", user_id=8)
    assert second.run_id != "r4"
    assert get_run("r4") is first
    finish_run(first)
    assert get_run("r4") is None


# ---- Dify ----

def _stream_response(lines):
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.iter_lines.side_effect = lambda *a, **k: iter(lines)
    return resp


def _event(**e):
    return b"data: " + json.dumps(e, ensure_ascii=False).encode("utf-8")


def test_dify_stream_is_assembled_like_blocking_response():
    payload = {"answer": "案件はこちらです", "conversation_id": "conv-1"}
    with patch.object(tools_langchain, "_get_dify_parameters", return_value={"user_input_form": []}), \
         patch.object(tools_langchain.requests, "post", return_value=dify_response(payload)) as post:
        answer = _call_dify_chat("探して", 7, "key", 14, session_id="s")
    assert answer == "案件はこちらです"
    assert post.call_args.kwargs["json"]["response_mode"] == "streaming"
    assert post.call_args.kwargs["stream"] is True
    assert tools_langchain._dify_conversation_cache[(7, 14, "s")] == "conv-1"


def test_cancel_during_dify_calls_stop_api_and_keeps_conversation():
    run = start_run("r5", user_id=7)

    def lines():
        yield _event(event="workflow_started", task_id="task-9", conversation_id="conv-9")
        yield _event(event="ping")
        # ここでユーザーが中止した
        cancel_run("r5", user_id=7)
        yield _event(event="ping")
        yield _event(event="message", task_id="task-9", conversation_id="conv-9", answer="届かない")

    chat = MagicMock()
    chat.raise_for_status.return_value = None
    chat.iter_lines.side_effect = lambda *a, **k: lines()
    stop = MagicMock()

    def post(url, **kwargs):
        if url.endswith("/stop"):
            stop(url, **kwargs)
            return MagicMock()
        return chat

    with patch.object(tools_langchain, "_get_dify_parameters", return_value={"user_input_form": []}), \
         patch.object(tools_langchain.requests, "post", side_effect=post):
        with pytest.raises(ChatCancelled):
            _call_dify_chat("探して", 7, "key", 14, session_id="s", run_id="r5")

    stop.assert_called_once()
    assert stop.call_args.args[0].endswith("/chat-messages/task-9/stop")
    assert stop.call_args.kwargs["json"] == {"user": "webcoach-user-7"}
    chat.close.assert_called_once()
    # 途中まで進んだ会話はDify側に残るので、次の発言はその続きとして送る
    assert tools_langchain._dify_conversation_cache[(7, 14, "s")] == "conv-9"
    assert run.cancelled


def test_already_cancelled_run_does_not_call_dify():
    start_run("r6", user_id=7)
    cancel_run("r6", user_id=7)
    with patch.object(tools_langchain, "_get_dify_parameters", return_value={"user_input_form": []}), \
         patch.object(tools_langchain.requests, "post") as post:
        with pytest.raises(ChatCancelled):
            _call_dify_chat("探して", 7, "key", 14, session_id="s", run_id="r6")
    post.assert_not_called()


def test_dify_error_event_returns_error_message():
    resp = _stream_response([_event(event="error", task_id="t", code="invalid_param", message="bad")])
    with patch.object(tools_langchain, "_get_dify_parameters", return_value={"user_input_form": []}), \
         patch.object(tools_langchain.requests, "post", return_value=resp):
        answer = _call_dify_chat("探して", 7, "key", 14, session_id="s")
    assert "エラー" in answer


def test_dify_total_timeout_stops_task():
    resp = _stream_response([
        _event(event="workflow_started", task_id="task-t", conversation_id="c"),
        _event(event="ping"),
    ])
    calls = []

    def post(url, **kwargs):
        calls.append(url)
        return resp if url.endswith("/chat-messages") else MagicMock()

    with patch.object(tools_langchain, "_get_dify_parameters", return_value={"user_input_form": []}), \
         patch.object(tools_langchain.requests, "post", side_effect=post), \
         patch.object(tools_langchain, "DIFY_TOTAL_TIMEOUT_SECONDS", -1):
        answer = _call_dify_chat("探して", 7, "key", 14, session_id="s")
    assert "時間内" in answer
    # 1行目を読んだ時点で上限超過。task_id が分かる前なので停止APIは呼ばない
    assert calls == [f"{tools_langchain.DIFY_API_BASE_URL}/chat-messages"]


# ---- LLM ----

class _FakeStream:
    def __init__(self, chunks, on_yield=None):
        self.chunks = chunks
        self.on_yield = on_yield
        self.closed = False

    def __iter__(self):
        for i, c in enumerate(self.chunks):
            if self.on_yield:
                self.on_yield(i)
            yield c

    def close(self):
        self.closed = True


class _FakeLlm:
    def __init__(self, stream):
        self._stream = stream

    def stream(self, messages):
        gen = iter(self._stream)
        stream = self._stream

        class _Gen:
            def __iter__(self_inner):
                return gen

            def close(self_inner):
                stream.close()

        return _Gen()

    def invoke(self, messages):
        raise AssertionError("runがあるときはストリーミングで呼ぶ")


def test_llm_stream_is_merged_into_one_message():
    start_run("r7", user_id=7)
    stream = _FakeStream([AIMessageChunk(content="こん"), AIMessageChunk(content="にちは")])
    msg = _invoke_llm(_FakeLlm(stream), [], "r7")
    assert msg.content == "こんにちは"
    assert type(msg).__name__ == "AIMessage"
    assert stream.closed


def test_llm_stream_stops_when_cancelled():
    start_run("r8", user_id=7)
    stream = _FakeStream(
        [AIMessageChunk(content="a"), AIMessageChunk(content="b"), AIMessageChunk(content="c")],
        on_yield=lambda i: cancel_run("r8", user_id=7) if i == 1 else None,
    )
    with pytest.raises(ChatCancelled):
        _invoke_llm(_FakeLlm(stream), [], "r8")
    assert stream.closed


def test_llm_without_run_uses_invoke():
    llm = MagicMock()
    llm.invoke.return_value = "ok"
    assert _invoke_llm(llm, [], None) == "ok"
    llm.stream.assert_not_called()


# ---- /chat ----

def test_chat_returns_cancelled_status():
    from routers import ai_langgraph

    def fake_execute(request, db, run):
        cancel_run(request.run_id, request.user_id)
        run.raise_if_cancelled()

    with patch.object(ai_langgraph, "_execute_chat", side_effect=fake_execute), \
         patch.object(ai_langgraph, "SessionLocal", return_value=MagicMock()):
        res = ai_langgraph.ai_chat_langgraph(ai_langgraph.ChatRequest(user_id=7, message="hi", run_id="r9"))
    assert res.status == "cancelled"
    assert get_run("r9") is None


def test_cancel_endpoint_uses_user_id():
    from routers import ai_langgraph

    start_run("r10", user_id=7)
    assert ai_langgraph.cancel_chat(ai_langgraph.CancelRequest(user_id=8, run_id="r10")) == {"cancelled": False}
    assert ai_langgraph.cancel_chat(ai_langgraph.CancelRequest(user_id=7, run_id="r10")) == {"cancelled": True}
