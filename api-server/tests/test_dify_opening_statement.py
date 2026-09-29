"""
Dify会話の最初に、アプリの挨拶文（opening_statement）を出す (agents/tools_langchain.py)

Dify標準UIは会話の最初に挨拶文を出すが、WebCoachはユーザーの最初の発言をそのまま送るため
挨拶文が見えなかった。デザインフィードバックメンターProは挨拶文で「プロジェクト＝デザインの
種類・目的・ターゲット」を説明しており、それが無いまま「プロジェクトの概要をおしえてください」
と返ってきて、ユーザーには意味が分からなかった。
"""
from unittest.mock import MagicMock, patch

import pytest

import agents.tools_langchain as tools_langchain
from agents.tools_langchain import _call_dify_chat
from tests.dify_stream_mock import dify_response

OPENING = "まずは今回のプロジェクトの情報を教えてください！\n- デザインの種類\n- ターゲット"
OPENING_WITH_BUTTONS = (
    "今日使える時間はどのくらいですか？\n\n<div>\n"
    '<button data-message="5時間">5時間</button>\n'
    '<button data-message="2時間">2時間</button>\n</div>'
)


@pytest.fixture(autouse=True)
def _reset_caches():
    for cache in (
        tools_langchain._dify_conversation_cache,
        tools_langchain._dify_sticky_app_cache,
        tools_langchain._dify_extra_inputs_cache,
        tools_langchain._dify_image_cache,
    ):
        cache.clear()
    yield


def _call(answers, opening, messages):
    replies = iter(answers)
    mock_post = MagicMock(
        side_effect=lambda url, **kw: dify_response({"answer": next(replies), "conversation_id": "conv-1"})
    )
    params = {"opening_statement": opening, "user_input_form": []}
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=params), \
         patch.object(tools_langchain.requests, "post", mock_post):
        return [_call_dify_chat(m, 7, "key", 17, session_id="s1") for m in messages]


def test_first_reply_starts_with_opening_statement():
    first, second = _call(
        ["まずはプロジェクトの概要をおしえてください！", "ありがとうございます"],
        OPENING,
        ["バナーを見てほしい", "20代女性向けのバナーです"],
    )
    assert first == f"{OPENING}\n\nまずはプロジェクトの概要をおしえてください！"
    # 続きのターンには付けない
    assert second == "ありがとうございます"


def test_opening_buttons_are_dropped_when_reply_has_its_own():
    reply = '時間を選んでください\n<div><button data-message="5時間">5時間</button></div>'
    [first] = _call([reply], OPENING_WITH_BUTTONS, ["挑戦したい"])
    assert first == f"今日使える時間はどのくらいですか？\n\n{reply}"


def test_opening_buttons_are_kept_when_reply_has_none():
    [first] = _call(["よろしくお願いします"], OPENING_WITH_BUTTONS, ["挑戦したい"])
    assert first == f"{OPENING_WITH_BUTTONS}\n\nよろしくお願いします"


def test_no_opening_statement_leaves_reply_as_is():
    [first] = _call(["こんにちは"], "", ["はじめたい"])
    assert first == "こんにちは"
