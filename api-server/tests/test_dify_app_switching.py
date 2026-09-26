"""
Difyアプリの会話継続と切り替え (agents/tools_langchain.py, routers/ai_langgraph.py)

- 直前のDify応答のボタン値が送られたときだけ、直前のアプリへツールを固定する
- 自由入力の発言は固定せず「続きなら同じツールを」とLLMに伝えるだけにする（別用途なら切り替えられる）
- 他アプリ固有のタグを含む発言では、続きの案内も出さない
- 専門モードの指示文はDifyへ送る発言に混ぜない
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

import agents.tools_langchain as tools_langchain
import routers.ai_langgraph as ai_langgraph
from agents.tools_langchain import _call_dify_chat, clear_sticky_dify_app, create_ai_application_tools
from routers.ai_langgraph import ChatRequest, _execute_chat

SPRINT_ANSWER = (
    "今日使える時間について教えてください！\n<div>"
    '<button data-message="5時間（初心者～中級者向け）">5時間（初心者～中級者向け）</button>'
    '<button data-message="3時間（スピードを意識したい人向け）">3時間（スピードを意識したい人向け）</button>'
    "</div>"
)


def _app(app_id, tags):
    return SimpleNamespace(id=app_id, name=f"app{app_id}", category="", description="", tags=tags, secret_key="k")


APPS = [
    _app(14, "AI,デザイン"),
    _app(15, "AI,就活,面接"),
    _app(16, "AI,コピーライティング"),
]


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


def _db():
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = APPS
    return db


def _response(payload):
    resp = MagicMock()
    resp.json.return_value = payload
    resp.raise_for_status.return_value = None
    return resp


def _talk_to_sprint_app(answer=SPRINT_ANSWER):
    """id=14と1ターン会話して、sticky/ボタンのキャッシュを実際の経路で作る"""
    with patch.object(tools_langchain, "_get_dify_parameters", return_value={"user_input_form": []}), \
         patch.object(tools_langchain.requests, "post", return_value=_response({"answer": answer, "conversation_id": "c"})):
        _call_dify_chat("今日のデザイン練習課題をください", 7, "key", 14, session_id="s")


def _decide(message):
    with patch.object(tools_langchain, "_get_dify_api_key", return_value="key"), \
         patch.object(tools_langchain, "_get_dify_parameters", return_value={}):
        _, forced, continuing = create_ai_application_tools(_db(), message, 7, session_id="s")
    return forced, continuing


def test_button_value_forces_previous_app():
    _talk_to_sprint_app()
    assert _decide("3時間（スピードを意識したい人向け）") == ("ask_ai_application_14", None)


@pytest.mark.parametrize("message", ["3時間くらいです", "キャッチコピーを考えてほしい", "別のことを相談したい"])
def test_free_text_is_not_forced_but_hinted(message):
    _talk_to_sprint_app()
    assert _decide(message) == (None, "ask_ai_application_14")


def test_other_app_tag_drops_hint():
    _talk_to_sprint_app()
    assert _decide("面接の練習がしたい") == (None, None)


def test_no_previous_app_means_no_force_or_hint():
    assert _decide("3時間（スピードを意識したい人向け）") == (None, None)


def test_buttons_are_scoped_to_session():
    _talk_to_sprint_app()
    with patch.object(tools_langchain, "_get_dify_api_key", return_value="key"), \
         patch.object(tools_langchain, "_get_dify_parameters", return_value={}):
        _, forced, continuing = create_ai_application_tools(_db(), "3時間（スピードを意識したい人向け）", 7, session_id="other")
    assert (forced, continuing) == (None, None)


def test_fallback_suggested_question_buttons_are_also_forced():
    """空応答時に組み立てるsuggested_questionsボタンも、押したら同じアプリへ固定する"""
    params = {"user_input_form": [], "suggested_questions": ["応募文作成", "応募文添削"]}
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=params), \
         patch.object(tools_langchain.requests, "post", return_value=_response({"answer": "", "conversation_id": "c"})):
        _call_dify_chat("応募文を作ってほしい", 7, "key", 14, session_id="s")
    assert _decide("応募文作成") == ("ask_ai_application_14", None)


def test_button_value_html_entities_are_unescaped():
    _talk_to_sprint_app('<button data-message="A &amp; B">A &amp; B</button>')
    assert _decide("A & B")[0] == "ask_ai_application_14"


def test_clear_sticky_also_clears_buttons():
    _talk_to_sprint_app()
    clear_sticky_dify_app(7, "s")
    assert tools_langchain._dify_last_buttons_cache.get((7, "s")) is None
    assert _decide("3時間（スピードを意識したい人向け）") == (None, None)


def test_mode_instruction_is_not_sent_as_dify_message():
    """専門モードの指示文はstateに別で渡り、Difyツールへ転送する発言は素のまま"""
    fake_graph = MagicMock()
    fake_graph.invoke.return_value = {"messages": [AIMessage(content="ok")], "final_response": "ok", "iteration_count": 1}
    request = ChatRequest(
        user_id=7,
        message="3時間（スピードを意識したい人向け）",
        session_id="s",
        mode_instruction="【制作物添削モード】観点ごとに整理して答えてください。",
    )
    with patch.object(ai_langgraph, "get_learning_coach_graph", return_value=fake_graph), \
         patch("agents.tools_langchain.create_ai_application_tools", return_value=([], None, None)) as create_tools:
        _execute_chat(request, MagicMock())

    assert create_tools.call_args.args[1] == "3時間（スピードを意識したい人向け）"
    state = fake_graph.invoke.call_args.args[0]
    assert state["mode_instruction"] == "【制作物添削モード】観点ごとに整理して答えてください。"
    assert state["messages"][-1].content == "3時間（スピードを意識したい人向け）"
