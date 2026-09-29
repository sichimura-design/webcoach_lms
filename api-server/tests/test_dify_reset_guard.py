"""
Dify会話のリセット判定 (agents/tools_langchain.py)

LLMが ask_ai_application_* に start_new_conversation=true を付けても、ユーザー自身が
「最初から」「新しく」等やり直しをはっきり言っていなければ会話を続ける（B-008）。
デザインスプリントチャレンジャーで業種（「飲食店」）を答えたターンにLLMがリセットを付け、
Difyが最初の「今日使える時間」に戻ってしまっていた。
"""
import pytest

from agents.tools_langchain import _should_reset_dify_conversation


@pytest.mark.parametrize(
    "message",
    [
        "飲食店",
        "5時間（初心者～中級者向け）",
        "シズル感",
        "Crowdworksで案件を探している",
        "WEBデザインの案件を探したい",
    ],
)
def test_answers_to_the_app_never_reset(message):
    assert _should_reset_dify_conversation(message, requested=True) is False


@pytest.mark.parametrize(
    "message",
    [
        "新しく探したい",
        "最初からやり直したい",
        "別の条件で探して",
        "一から考え直したい",
        "リセットして",
    ],
)
def test_explicit_restart_is_honored(message):
    assert _should_reset_dify_conversation(message, requested=True) is True


def test_no_reset_unless_llm_asked():
    assert _should_reset_dify_conversation("最初からやり直したい", requested=False) is False
