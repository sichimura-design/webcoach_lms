"""
アプリのモードに入ったとき画面に出す挨拶文と選択肢 (agents/tools_langchain.build_dify_intro)
と、画面が出し済みのときに最初の応答へ挨拶文を付け直さないこと
"""
from unittest.mock import MagicMock, patch

import pytest

import agents.tools_langchain as tools_langchain
from agents.tools_langchain import _call_dify_chat, build_dify_intro
from tests.dify_stream_mock import dify_response

OPENING = "こんにちは！\nまずは「作成」と「添削」のどちらをご希望か、教えてください😊"


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


def _intro(params):
    with patch.object(tools_langchain, "_get_dify_api_key", return_value="key"), \
         patch.object(tools_langchain, "_get_dify_parameters", return_value=params):
        return build_dify_intro("project-application-writer")


def test_intro_renders_suggested_questions_as_buttons():
    intro = _intro({"opening_statement": OPENING, "suggested_questions": ["応募文作成", "応募文添削"]})
    assert intro["has_choices"] is True
    assert intro["message"].startswith(OPENING)
    assert '<button data-message="応募文作成">応募文作成</button>' in intro["message"]
    assert '<button data-message="応募文添削">応募文添削</button>' in intro["message"]


def test_intro_keeps_buttons_written_in_opening():
    opening = '時間は？\n<div><button data-message="5時間">5時間</button></div>'
    intro = _intro({"opening_statement": opening, "suggested_questions": []})
    assert intro["has_choices"] is True
    assert intro["message"] == opening


def test_intro_without_choices():
    intro = _intro({"opening_statement": "商品を入力してください", "suggested_questions": []})
    assert intro["has_choices"] is False
    assert intro["message"] == "商品を入力してください"


def test_intro_escapes_choice_text():
    intro = _intro({"opening_statement": "", "suggested_questions": ['A"<b>']})
    assert '<button data-message="A&quot;&lt;b&gt;">A&quot;&lt;b&gt;</button>' in intro["message"]


def test_intro_unknown_app():
    with patch.object(tools_langchain, "_get_dify_api_key", return_value=None):
        assert build_dify_intro("nope") is None


@pytest.mark.parametrize("opening_shown, expected", [(False, f"{OPENING}\n\n<form>URL</form>"), (True, "<form>URL</form>")])
def test_first_reply_opening_depends_on_opening_shown(opening_shown, expected):
    params = {"opening_statement": OPENING, "user_input_form": []}
    mock_post = MagicMock(side_effect=lambda url, **kw: dify_response({"answer": "<form>URL</form>", "conversation_id": "c1"}))
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=params), \
         patch.object(tools_langchain.requests, "post", mock_post):
        answer = _call_dify_chat("応募文作成", 7, "key", 19, session_id="s1", opening_shown=opening_shown)
    assert answer == expected
