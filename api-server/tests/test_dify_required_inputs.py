"""
必須入力変数（AI面接シミュレーターの求人URL job_posting）を会話の前に尋ねる (agents/tools_langchain.py)

job_posting はDify標準画面では会話前のフォームで入れる項目で、会話の中では尋ねられない。
WebCoachは空文字で埋めて送っていたため、面談タイプのボタンを押すと求人なしで面接が始まっていた。
"""
from unittest.mock import MagicMock, patch

import pytest

import agents.tools_langchain as tools_langchain
from agents.tools_langchain import _call_dify_chat
from tests.dify_stream_mock import dify_response

PARAMS = {
    "opening_statement": "はじめまして、AI面接官です！",
    "suggested_questions": ["クライアントとの業務委託面談", "企業の採用面接"],
    "user_input_form": [{"text-input": {"variable": "job_posting", "label": "求人情報のURL", "required": True}}],
}
URL = "https://crowdworks.jp/public/jobs/123"


@pytest.fixture(autouse=True)
def _reset_caches():
    for cache in (
        tools_langchain._dify_conversation_cache,
        tools_langchain._dify_sticky_app_cache,
        tools_langchain._dify_extra_inputs_cache,
        tools_langchain._dify_image_cache,
        tools_langchain._dify_last_buttons_cache,
        tools_langchain._dify_pending_first_message,
        tools_langchain._dify_inputs_skipped,
    ):
        cache.clear()
    yield


def _run(messages, replies=None, opening_shown=False):
    """Difyへ送った (query, inputs) の列と、各ターンの応答を返す"""
    it = iter(replies or [])
    sent = []

    def post(url, **kw):
        sent.append((kw["json"]["query"], kw["json"]["inputs"]))
        return dify_response({"answer": next(it, "面接を始めます"), "conversation_id": "conv-1"})

    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS), \
         patch.object(tools_langchain.requests, "post", MagicMock(side_effect=post)):
        answers = [_call_dify_chat(m, 7, "key", 15, session_id="s1", opening_shown=opening_shown and i == 0)
                   for i, m in enumerate(messages)]
    return answers, sent


def test_asks_for_url_before_sending_to_dify():
    answers, sent = _run(["クライアントとの業務委託面談"])
    assert sent == []
    assert "求人情報のURLを貼ってください" in answers[0]
    assert 'data-message="URLなしで始める"' in answers[0]
    # ボタンを押したらこのアプリへ固定されるように
    assert "URLなしで始める" in tools_langchain._dify_last_buttons_cache[(7, "s1")]


def test_sentence_label_is_used_as_is():
    # 実際のAI面接シミュレーターのラベルは文になっている
    fields = [{"variable": "job_posting", "label": "求人情報のURLを入力してください 【必須】", "required": True}]
    assert tools_langchain._ask_required_inputs_html(fields).startswith("はじめに、求人情報のURLを貼ってください。")


def test_url_reply_starts_with_the_held_first_message():
    _, sent = _run(["クライアントとの業務委託面談", f"これです {URL}"])
    assert sent == [("クライアントとの業務委託面談", {"job_posting": URL})]


def test_url_is_kept_for_later_turns():
    _, sent = _run(["クライアントとの業務委託面談", URL, "よろしくお願いします"])
    assert sent[1] == ("よろしくお願いします", {"job_posting": URL})


def test_url_in_first_message_is_used_without_asking():
    _, sent = _run([f"{URL} の面接練習をしたい"])
    assert sent == [(f"{URL} の面接練習をしたい", {"job_posting": URL})]


def test_skip_button_starts_without_url():
    _, sent = _run(["クライアントとの業務委託面談", "URLなしで始める"])
    assert sent == [("クライアントとの業務委託面談", {"job_posting": ""})]


def test_does_not_ask_twice():
    # URLでもボタンでもない答えなら、その発言で始める（同じ質問を繰り返さない）
    answers, sent = _run(["クライアントとの業務委託面談", "URLは持っていません"], ["", "面接を始めます"])
    assert sent[0] == ("URLは持っていません", {"job_posting": ""})
    # 空応答で会話が覚えられず次も新しい会話になっても、もう尋ねない
    _, sent2 = _run(["企業の採用面接"])
    assert sent2 == [("企業の採用面接", {"job_posting": ""})]


def test_restart_asks_again():
    _run(["クライアントとの業務委託面談", URL])
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS), \
         patch.object(tools_langchain.requests, "post", MagicMock()) as post:
        answer = _call_dify_chat("最初からやり直したい", 7, "key", 15, reset=True, session_id="s1")
    post.assert_not_called()
    assert "URLを貼ってください" in answer


def test_opening_shown_on_the_asking_turn_is_kept():
    # 画面が挨拶文を出してから選択肢を押した → URLを貼ったターンの応答に挨拶文を付け直さない
    answers, _ = _run(["クライアントとの業務委託面談", URL], opening_shown=True)
    assert answers[1] == "面接を始めます"


def test_opening_is_added_when_screen_did_not_show_it():
    answers, _ = _run(["クライアントとの業務委託面談", URL])
    assert answers[1].startswith("はじめまして、AI面接官です！")
