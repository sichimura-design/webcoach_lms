"""
アプリのモードに入った直後の最初の発言は、指定したDifyアプリへ必ず送る（force_app_key）

「AIコーチでできること」で「使ってみる」を押した直後の発言を、LLMの判断（似た説明の
別アプリ・ツールを呼ばずに自分で答える）に任せず、そのアプリのツールに固定する。
固定は既存の sticky_dify_tool_name（tool_choice でそのツールを強制）に載せる。
"""
from unittest.mock import MagicMock, patch

from langchain_core.messages import AIMessage

import routers.ai_langgraph as ai_langgraph
from routers.ai_langgraph import ChatRequest, _execute_chat


def _tool(name):
    t = MagicMock()
    t.name = name
    return t


def _run(request, *, app_id=None, tools=(), sticky=None):
    """_execute_chat を走らせ、グラフへ渡った初期ステートを返す"""
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = (
        MagicMock(id=app_id) if app_id is not None else None
    )
    fake_graph = MagicMock()
    fake_graph.invoke.return_value = {
        "messages": [AIMessage(content="ok")], "final_response": "ok", "iteration_count": 1,
    }
    with patch.object(ai_langgraph, "get_learning_coach_graph", return_value=fake_graph), \
         patch("agents.tools_langchain.create_ai_application_tools",
               return_value=(list(tools), sticky, None)):
        _execute_chat(request, db)
    return fake_graph.invoke.call_args[0][0]


def test_force_app_key_fixes_the_tool():
    state = _run(
        ChatRequest(user_id=7, message="お願いします", force_app_key="design-sprint-challenger"),
        app_id=14,
        tools=[_tool("ask_ai_application_14"), _tool("ask_ai_application_15")],
    )
    assert state["sticky_dify_tool_name"] == "ask_ai_application_14"


def test_force_app_key_overrides_previous_sticky_app():
    state = _run(
        ChatRequest(user_id=7, message="はい", force_app_key="design-sprint-challenger"),
        app_id=14,
        tools=[_tool("ask_ai_application_14"), _tool("ask_ai_application_15")],
        sticky="ask_ai_application_15",
    )
    assert state["sticky_dify_tool_name"] == "ask_ai_application_14"


def test_unknown_app_key_leaves_routing_to_llm():
    state = _run(
        ChatRequest(user_id=7, message="お願いします", force_app_key="no-such-app"),
        app_id=None,
        tools=[_tool("ask_ai_application_14")],
    )
    assert state["sticky_dify_tool_name"] is None


def test_without_force_app_key_nothing_is_forced():
    state = _run(
        ChatRequest(user_id=7, message="お願いします"),
        tools=[_tool("ask_ai_application_14")],
    )
    assert state["sticky_dify_tool_name"] is None
