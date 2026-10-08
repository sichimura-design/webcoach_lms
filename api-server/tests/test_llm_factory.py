"""
Claudeの呼び出し設定(Claude Sonnet 5.5向け)と、固定したDifyツールの呼び出し

- Sonnet 5.5ではtemperatureを送らず、thinking=between_tools・effort=lowを送る
- それ以外のモデル(Haiku 4.5等)にはSonnet 5.5専用の設定を送らない
- 応答本文はtextブロックだけを取る(先頭にthinkingブロックが付くことがある)
- 固定したDifyツールはtool_choiceで強制せず(Sonnet 5.5では400)、そのツールだけを渡す。
  呼ばなかったときはこちらで呼び出しを作る
"""
from unittest.mock import MagicMock, patch

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.tools import StructuredTool

import agents.learning_coach_agent as agent
import llm_factory
from agents.tools_langchain import AskAiApplicationInput


def _payload(monkeypatch, model):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_MODEL", model)
    llm = llm_factory.create_chat_model(max_tokens=1024)
    return llm._get_request_payload([HumanMessage(content="こんにちは")])


def test_sonnet_5_5_request_has_no_temperature_and_no_thinking(monkeypatch):
    payload = _payload(monkeypatch, "claude-sonnet-5-5")

    assert payload["model"] == "claude-sonnet-5-5"
    assert "temperature" not in payload
    assert payload["thinking"] == {"type": "between_tools"}
    assert payload["output_config"] == {"effort": "low"}
    assert payload["max_tokens"] == 1024


def test_other_models_get_no_sonnet_5_5_options(monkeypatch):
    payload = _payload(monkeypatch, "claude-haiku-4-5-20251001")

    assert "temperature" not in payload
    assert "thinking" not in payload
    assert "output_config" not in payload


def test_workspace_id_is_sent_as_header_when_set(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_WORKSPACE_ID", " wrkspc_test ")
    llm = llm_factory.create_chat_model(max_tokens=1024)

    assert llm._client.default_headers["anthropic-workspace-id"] == "wrkspc_test"


def test_no_workspace_header_when_unset(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.delenv("ANTHROPIC_WORKSPACE_ID", raising=False)
    llm = llm_factory.create_chat_model(max_tokens=1024)

    assert "anthropic-workspace-id" not in llm._client.default_headers


def test_message_text_skips_thinking_and_tool_use_blocks():
    content = [
        {"type": "thinking", "thinking": "", "signature": "sig"},
        {"type": "text", "text": "回答"},
        {"type": "tool_use", "id": "t1", "name": "x", "input": {}},
        {"type": "text", "text": "の続き"},
    ]
    assert llm_factory.message_text(content) == "回答の続き"
    assert llm_factory.message_text("そのまま") == "そのまま"


def _dify_tool(name):
    return StructuredTool.from_function(
        name=name, description="d", func=lambda **kw: "dify", args_schema=AskAiApplicationInput
    )


def _run_sticky(llm_response):
    fake_llm = MagicMock()
    fake_llm.bind_tools.return_value.invoke.return_value = llm_response
    state = {
        "messages": [HumanMessage(content="クラウドワークス")],
        "user_id": 7,
        "dynamic_tools": [_dify_tool("ask_ai_application_14"), _dify_tool("ask_ai_application_15")],
        "rag_context": "",
        "iteration_count": 0,
        "max_iterations": 3,
        "sticky_dify_tool_name": "ask_ai_application_14",
    }
    with patch.object(agent, "llm", fake_llm), patch.object(agent, "tools_list", []), \
         patch.object(agent, "initialize_components", lambda: None):
        result = agent.agent_node(state)
    return fake_llm, result["messages"][0]


def test_sticky_tool_is_offered_alone_without_forced_tool_choice():
    called = AIMessage(content="", tool_calls=[
        {"name": "ask_ai_application_14", "args": {"query": "q", "userid": 7}, "id": "c1", "type": "tool_call"}
    ])

    fake_llm, response = _run_sticky(called)

    args, kwargs = fake_llm.bind_tools.call_args
    assert [t.name for t in args[0]] == ["ask_ai_application_14"]
    assert "tool_choice" not in kwargs
    system_blocks = fake_llm.bind_tools.return_value.invoke.call_args[0][0][0].content
    assert "ask_ai_application_14 を呼び出して" in system_blocks[-1]["text"]
    assert response is called


def test_sticky_tool_is_called_directly_when_llm_answers_by_itself():
    _, response = _run_sticky(AIMessage(content="自分で答えました"))

    assert len(response.tool_calls) == 1
    call = response.tool_calls[0]
    assert call["name"] == "ask_ai_application_14"
    assert call["args"] == {"query": "クラウドワークス", "userid": 7}
    assert call["id"].startswith("forced_")
