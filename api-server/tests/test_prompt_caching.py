"""
AIチャットの入力トークン削減とプロンプトキャッシュ

- システムプロンプトの固定部分(キャッシュ対象)にユーザーIDや教材検索結果などの可変値が入らない
- 固定部分にcache_controlが付き、可変部分は別ブロックになる
- Difyアプリのツール定義が小さく保たれている（アプリの数だけ繰り返し送られるため）
- キャッシュ読み書きのトークン数を利用ログ用に集計できる
"""
import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.utils.function_calling import convert_to_openai_tool

import agents.learning_coach_agent as agent
import agents.tools_langchain as tools_langchain
from routers.ai_langgraph import _summarize_llm_usage


def _run_agent_node(**state_overrides):
    captured = {}
    fake_llm = MagicMock()

    def invoke(messages):
        captured["messages"] = messages
        return AIMessage(content="ok")

    fake_llm.bind_tools.return_value.invoke.side_effect = invoke
    state = {
        "messages": [HumanMessage(content="質問")],
        "user_id": 12345,
        "dynamic_tools": [],
        "rag_context": "[参考資料 1]\nCanvaの教材本文",
        "iteration_count": 0,
        "max_iterations": 3,
        **state_overrides,
    }
    with patch.object(agent, "llm", fake_llm), patch.object(agent, "tools_list", []), \
         patch.object(agent, "initialize_components", lambda: None):
        agent.agent_node(state)
    return captured["messages"][0].content


def test_static_block_is_cached_and_has_no_per_request_values():
    static, dynamic = _run_agent_node(mode_instruction="【制作物添削モード】")
    assert static["cache_control"] == {"type": "ephemeral"}
    assert static["text"] == agent.STATIC_SYSTEM_PROMPT
    for volatile in ("12345", "Canvaの教材本文", "制作物添削モード"):
        assert volatile not in static["text"]
        assert volatile in dynamic["text"]
    assert "cache_control" not in dynamic


def test_static_block_is_identical_across_users():
    first, _ = _run_agent_node(user_id=1)
    second, _ = _run_agent_node(user_id=2, rag_context="", iteration_count=2)
    assert first == second


def test_dify_tool_definition_stays_small():
    apps = [
        SimpleNamespace(id=i, name=f"アプリ{i}", category="カテゴリ", description="説明", tags="", secret_key="k")
        for i in range(14, 23)
    ]
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = apps
    with patch.object(tools_langchain, "_get_dify_api_key", return_value="k"), \
         patch.object(tools_langchain, "_get_dify_parameters", return_value={}):
        tools, _, _ = tools_langchain.create_ai_application_tools(db, "x", 1, session_id="s")

    schema = json.dumps(convert_to_openai_tool(tools[0]), ensure_ascii=False)
    # 以前は引数の説明だけで日本語約800文字あり、アプリの数だけ繰り返し送られていた。
    # 残りの大半はJSONの構造（英字・記号でトークン数は少ない）
    japanese_chars = sum(1 for c in schema if ord(c) > 0x3000)
    assert japanese_chars < 120


def test_summarize_reports_cache_tokens():
    messages = [
        AIMessage(
            content="回答",
            usage_metadata={
                "input_tokens": 1000, "output_tokens": 10, "total_tokens": 1010,
                "input_token_details": {"cache_read": 800, "cache_creation": 150},
            },
        )
    ]
    usage = _summarize_llm_usage(messages)
    assert (usage["input_tokens"], usage["cache_read_tokens"], usage["cache_creation_tokens"]) == (1000, 800, 150)


def _run_retrieve(documents, distances):
    fake_db = MagicMock()
    fake_db.search.return_value = {
        "documents": [documents],
        "metadatas": [[{"module_name": "m"} for _ in documents]],
        "distances": [distances],
    }
    with patch.object(agent, "vector_db", fake_db):
        state = agent.retrieve_node({"messages": [HumanMessage(content="質問")], "lesson_context": None, "course_id": None})
    return fake_db, state


def test_rag_drops_low_similarity_results():
    # distance = 1 - similarity
    fake_db, state = _run_retrieve(["関連", "無関係A", "無関係B"], [0.31, 0.53, 0.60])
    assert fake_db.search.call_args.kwargs["n_results"] == agent.RAG_MAX_RESULTS
    assert "関連" in state["rag_context"]
    assert "無関係" not in state["rag_context"]
    assert len(state["rag_sources"]) == 1


def test_rag_injects_nothing_when_all_results_are_irrelevant():
    _, state = _run_retrieve(["無関係A", "無関係B"], [0.55, 0.60])
    assert not state.get("rag_context")
