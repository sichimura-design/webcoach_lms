"""
教材ページのAIコーチ: 教材文脈の受け渡しと「教材優先・一般知識の区別」
(agents/learning_coach_agent.py / routers/ai_langgraph.py)

- lesson_contextがあるときだけ、開いている教材と教材優先の回答ルールをプロンプトに入れる
- 回答末尾の根拠区分マーカーを本文から取り除き、groundingへ移す
- RAG検索クエリに選択箇所・見出しを含める
"""
from langchain_core.messages import AIMessage
import pytest
from pydantic import ValidationError

from agents.learning_coach_agent import (
    build_lesson_context_prompt,
    build_rag_query,
    extract_grounding,
    respond_node,
)
from routers.ai_langgraph import ChatRequest

LESSON = {
    "course_name": "Webデザイン入門",
    "section_name": "第2章 配色",
    "lesson_id": 42,
    "lesson_name": "色の三属性",
    "heading": "彩度とは",
    "selected_text": "彩度は色の鮮やかさの度合いです。",
    "context_before": "色には色相・明度・彩度の3つの属性があります。",
    "context_after": "彩度が低いほどグレーに近づきます。",
    "lesson_text": "色の三属性について学びます。",
}


def test_prompt_is_empty_without_lesson_context():
    assert build_lesson_context_prompt(None) == ""


def test_prompt_contains_lesson_and_selection_and_rules():
    prompt = build_lesson_context_prompt(LESSON)
    for value in LESSON.values():
        if isinstance(value, str):
            assert value in prompt
    assert "教材外の補足（一般知識）" in prompt
    assert "[[grounding:material]]" in prompt
    # 選択箇所が前後の文章の間に並ぶ
    assert prompt.index("<直前の文章>") < prompt.index("<選択箇所>") < prompt.index("<直後の文章>")


def test_prompt_omits_selection_block_when_nothing_selected():
    prompt = build_lesson_context_prompt({"course_name": "Webデザイン入門", "lesson_name": "色の三属性"})
    assert "<選択箇所>" not in prompt
    assert "- 見出し:" not in prompt
    assert "教材を優先する回答ルール" in prompt


@pytest.mark.parametrize("kind", ["material", "mixed", "general"])
def test_extract_grounding_strips_marker(kind):
    text, grounding = extract_grounding(f"彩度は鮮やかさです。\n\n[[grounding:{kind}]]")
    assert grounding == kind
    assert text == "彩度は鮮やかさです。"


def test_extract_grounding_without_marker():
    assert extract_grounding("ふつうの回答") == ("ふつうの回答", None)


def test_rag_query_includes_selection_and_heading():
    query = build_rag_query("これどういう意味？", LESSON)
    assert "これどういう意味？" in query
    assert LESSON["heading"] in query
    assert LESSON["selected_text"] in query
    assert build_rag_query("質問", None) == "質問"


def _state(content, lesson_context, dify=None):
    return {
        "messages": [AIMessage(content=content)],
        "user_id": None,
        "lesson_context": lesson_context,
        "dify_bypass_response": dify,
    }


def test_respond_node_sets_grounding_for_lesson_page():
    result = respond_node(_state("教材の説明です。\n[[grounding:mixed]]", LESSON))
    assert result["final_response"] == "教材の説明です。"
    assert result["grounding"] == "mixed"


def test_respond_node_no_grounding_outside_lesson_page():
    result = respond_node(_state("回答\n[[grounding:material]]", None))
    assert result["final_response"] == "回答"
    assert result["grounding"] is None


def test_respond_node_no_grounding_for_dify_response():
    result = respond_node(_state("", LESSON, dify="Difyの応答"))
    assert result["final_response"] == "Difyの応答"
    assert result["grounding"] is None


def test_chat_request_accepts_lesson_context_and_rejects_oversized_text():
    req = ChatRequest(user_id=1, message="質問", course_id=3, lesson_context=LESSON)
    assert req.lesson_context.heading == "彩度とは"
    with pytest.raises(ValidationError):
        ChatRequest(user_id=1, message="質問", lesson_context={"selected_text": "あ" * 1001})
