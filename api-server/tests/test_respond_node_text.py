"""
最終回答: 今回のユーザー発言以降のAIの本文をすべてつなげる (agents/learning_coach_agent.respond_node)

ツール呼び出しと同時に書いた本文（プラットフォームの選択肢など）が、ツール結果を受けた
あとの短い発言で上書きされて消えていた不具合の再発防止。
"""
from unittest.mock import patch

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from agents.learning_coach_agent import respond_node

BUTTONS = '<button data-message="Crowdworksで案件を探したい">Crowdworks</button>'


def _state(messages):
    return {"messages": messages, "user_id": 28, "session_id": "page:1", "lesson_context": None}


def _run(messages):
    with patch("agents.tools_langchain.clear_sticky_dify_app"):
        return respond_node(_state(messages))["final_response"]


def test_text_written_with_tool_call_is_kept():
    messages = [
        HumanMessage(content="案件を探して"),
        AIMessage(
            content=[{"type": "text", "text": f"どれで探しますか？\n{BUTTONS}"}],
            tool_calls=[{"name": "get_user_profile", "args": {}, "id": "t1"}],
        ),
        ToolMessage(content="{}", tool_call_id="t1"),
        AIMessage(content="プラットフォームをお選びください！"),
    ]
    assert _run(messages) == f"どれで探しますか？\n{BUTTONS}\n\nプラットフォームをお選びください！"


def test_previous_turns_are_not_included():
    messages = [
        HumanMessage(content="前の質問"),
        AIMessage(content="前の回答"),
        HumanMessage(content="今の質問"),
        AIMessage(content="今の回答"),
    ]
    assert _run(messages) == "今の回答"


def test_no_answer_in_this_turn_falls_back():
    messages = [HumanMessage(content="前"), AIMessage(content="前の回答"), HumanMessage(content="今")]
    assert _run(messages) == "申し訳ございません。回答を生成できませんでした。"
