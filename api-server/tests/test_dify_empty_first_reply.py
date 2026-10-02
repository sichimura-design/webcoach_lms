"""
最初の発言が空応答になったDify会話を覚えない (agents/tools_langchain.py)

応募文メーカーは会話の最初の発言で「作成／添削」の分岐が決まる。面接の答え等の自由文で
始まると空応答になり、その会話のまま選択肢の「応募文作成」を送っても空のまま進まなかった
（WebCoachは空応答の代わりに選択肢ボタンを出すので、同じボタンが繰り返し出ていた）。
"""
from unittest.mock import MagicMock, patch

import pytest

import agents.tools_langchain as tools_langchain
from agents.tools_langchain import _call_dify_chat
from tests.dify_stream_mock import dify_response


@pytest.fixture(autouse=True)
def _reset_caches():
    for cache in (
        tools_langchain._dify_conversation_cache,
        tools_langchain._dify_sticky_app_cache,
        tools_langchain._dify_extra_inputs_cache,
        tools_langchain._dify_image_cache,
        tools_langchain._dify_last_buttons_cache,
    ):
        cache.clear()
    yield


def _run(replies, messages):
    """replies: (answer, conversation_id) の列。送った conversation_id の列を返す"""
    it = iter(replies)
    sent = []

    def post(url, **kw):
        sent.append(kw["json"]["conversation_id"])
        answer, conv = next(it)
        return dify_response({"answer": answer, "conversation_id": conv})

    params = {"opening_statement": "", "user_input_form": [], "suggested_questions": ["応募文作成", "応募文添削"]}
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=params), \
         patch.object(tools_langchain.requests, "post", MagicMock(side_effect=post)):
        answers = [_call_dify_chat(m, 7, "key", 19, session_id="s1") for m in messages]
    return answers, sent


def test_empty_first_reply_is_not_continued():
    answers, sent = _run(
        [("", "conv-empty"), ("<form>URL</form>", "conv-2")],
        ["本日はお時間をいただき…応募理由は…", "応募文作成"],
    )
    # 空応答の代わりに選択肢ボタンを出す
    assert 'data-message="応募文作成"' in answers[0]
    # 選択肢は新しい会話の最初の発言として送る
    assert sent == ["", ""]
    assert answers[1] == "<form>URL</form>"
    assert tools_langchain._dify_conversation_cache[(7, 19, "s1")] == "conv-2"


def test_empty_reply_mid_conversation_keeps_conversation():
    _, sent = _run(
        [("URLを入力してください", "conv-1"), ("", "conv-1"), ("続き", "conv-1")],
        ["応募文作成", "?", "url: https://example.com"],
    )
    assert sent == ["", "conv-1", "conv-1"]
