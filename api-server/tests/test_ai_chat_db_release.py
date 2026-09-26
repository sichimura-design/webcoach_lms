"""
AIチャット実行中にDB接続を握り続けないこと

AIチャット1件はLLM/Difyの応答待ちで最大90秒かかる。その間DBセッションを
開いたままにすると、同時AIチャット数がSQLAlchemyの接続プール上限に達した時点で
AI以外の全APIまで接続待ちで止まる。DBを使うのは冒頭の動的ツール構築だけなので、
グラフ実行(LLM呼び出し)より前にセッションを閉じて接続をプールへ返す。
"""
from unittest.mock import MagicMock, patch

from langchain_core.messages import AIMessage

import routers.ai_langgraph as ai_langgraph
from routers.ai_langgraph import ChatRequest, _execute_chat


def test_db_session_is_closed_before_graph_invoke():
    calls = []
    db = MagicMock()
    db.close.side_effect = lambda: calls.append("db.close")

    fake_graph = MagicMock()

    def _invoke(state):
        calls.append("graph.invoke")
        return {"messages": [AIMessage(content="やあ")], "final_response": "やあ", "iteration_count": 1}

    fake_graph.invoke.side_effect = _invoke

    with patch.object(ai_langgraph, "get_learning_coach_graph", return_value=fake_graph), \
         patch("agents.tools_langchain.create_ai_application_tools", return_value=([], None, None)):
        _execute_chat(ChatRequest(user_id=7, message="こんにちは", session_id="page:1"), db)

    assert calls.index("db.close") < calls.index("graph.invoke")
