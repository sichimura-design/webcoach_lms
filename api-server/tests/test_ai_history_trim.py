"""
会話履歴の切り詰め (routers/ai_langgraph._fit_history)

案件一覧のような長い回答のあとでも同じチャットで続けられるよう、
上限を超えたら弾くのではなく履歴を削って収める。
"""
from unittest.mock import MagicMock, patch

from langchain_core.messages import AIMessage, HumanMessage

import routers.ai_langgraph as ai_langgraph
from routers.ai_langgraph import (
    MAX_HISTORY_MESSAGE_CHARS,
    ChatRequest,
    _execute_chat,
    _fit_history,
    estimate_token_count,
)


def _turns(*pairs):
    history = []
    for user, assistant in pairs:
        history += [{"role": "user", "content": user}, {"role": "assistant", "content": assistant}]
    return history


def test_short_history_is_kept_as_is():
    history = _turns(("案件を探して", "どの領域ですか？"), ("WEBデザイン", "予算は？"))
    assert _fit_history(history, 5000) == (history, 0)


def test_long_message_is_truncated():
    history = _turns(("案件を探して", "案件" * 2000))
    fitted, dropped = _fit_history(history, 100_000)
    assert dropped == 0
    assert fitted[1]["content"].startswith("案件" * 10)
    assert fitted[1]["content"].endswith("（長いため以下省略）")
    assert len(fitted[1]["content"]) < MAX_HISTORY_MESSAGE_CHARS + 20


def test_oldest_turns_are_dropped_to_fit_budget_and_start_with_user():
    history = _turns(("古い質問", "あ" * 1200), ("新しい質問", "い" * 1200), ("最新の質問", "短い回答"))
    fitted, dropped = _fit_history(history, 3000)
    assert sum(estimate_token_count(m["content"]) for m in fitted) <= 3000
    assert fitted[0]["role"] == "user"
    assert fitted[-2:] == history[-2:]
    assert dropped == len(history) - len(fitted)


def test_leading_assistant_message_is_dropped():
    history = [{"role": "assistant", "content": "こんにちは"}] + _turns(("質問", "回答"))
    fitted, dropped = _fit_history(history, 5000)
    assert fitted[0]["role"] == "user"
    assert dropped == 1


def test_interview_request_after_long_job_list_reaches_the_graph():
    """案件抽出の長い結果のあとに「面接の練習をしたい」と送っても、400にならずLLMまで届く"""
    history = _turns(
        ("案件を探して", "どの領域ですか？"),
        ("WEBデザイン", "予算は？"),
        ("5万円以上", "【案件一覧】\n" + "・バナー制作 5万円 納期1週間 詳細はこちら\n" * 150),
    )
    fake_graph = MagicMock()
    fake_graph.invoke.return_value = {"messages": [AIMessage(content="ok")], "final_response": "ok", "iteration_count": 1}
    with patch.object(ai_langgraph, "get_learning_coach_graph", return_value=fake_graph), \
         patch("agents.tools_langchain.create_ai_application_tools", return_value=([], None, None)):
        result = _execute_chat(
            ChatRequest(user_id=7, message="面接の練習をしたい", session_id="s", conversation_history=history),
            MagicMock(),
        )

    assert result.message == "ok"
    messages = fake_graph.invoke.call_args.args[0]["messages"]
    assert isinstance(messages[0], HumanMessage)
    assert messages[-1].content == "面接の練習をしたい"
