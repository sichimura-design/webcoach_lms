"""index.py の単体テスト(Slack・Claude・AWSへの実通信はしない)

実行: cd cdk-prod/lambda/support-bot && python3 -m pytest test_index.py
"""
import hashlib
import hmac
import json
import os
import sys
from types import SimpleNamespace
from unittest import mock

os.environ.setdefault("AWS_DEFAULT_REGION", "ap-northeast-1")
os.environ.setdefault("SLACK_SECRET_ID", "test/slack")
os.environ.setdefault("ANTHROPIC_SECRET_ID", "test/anthropic")
sys.path.insert(0, os.path.dirname(__file__))

import index  # noqa: E402

REPO_MANUAL = os.path.join(os.path.dirname(__file__), "../../../docs/support")
SECRET = "signing-secret"


def _sign(body, ts):
    return "v0=" + hmac.new(SECRET.encode(), f"v0:{ts}:{body}".encode(), hashlib.sha256).hexdigest()


def test_署名が正しければ通る():
    assert index.verify_signature(SECRET, "1000", "body", _sign("body", "1000"), now=1000)


def test_署名違い_古い_欠けているものは通さない():
    assert not index.verify_signature(SECRET, "1000", "body", _sign("other", "1000"), now=1000)
    assert not index.verify_signature(SECRET, "1000", "body", _sign("body", "1000"), now=1000 + 301)
    assert not index.verify_signature(SECRET, None, "body", None, now=1000)
    assert not index.verify_signature(SECRET, "abc", "body", "v0=x", now=1000)


def test_メンションを取り除く():
    assert index.clean_text("<@U123ABC> ログインできない") == "ログインできない"


def test_スレッドを会話にする_ボット発言はassistant_前後はuserにそろえる():
    thread = [
        {"user": "UBOT", "text": "前置き"},
        {"user": "U1", "text": "<@UBOT> 仮パスワードが切れた"},
        {"user": "UBOT", "text": "再発行できます"},
        {"user": "U1", "text": "<@UBOT> 届かない場合は?"},
        {"bot_id": "B9", "text": "別のボット"},
    ]
    assert index.thread_to_messages(thread, "UBOT") == [
        {"role": "user", "content": "仮パスワードが切れた"},
        {"role": "assistant", "content": "再発行できます"},
        {"role": "user", "content": "届かない場合は?"},
    ]


def test_マニュアルは決まった順に読む():
    text = index.load_manual(REPO_MANUAL)
    names = [line.split('"')[1] for line in text.splitlines() if line.startswith("<document ")]
    assert names[:4] == ["README.md", "login.md", "coaching.md", "ai-coach.md"]
    assert "仮パスワード" in text


def _http_event(body, ts, headers=None):
    return {
        "headers": {"X-Slack-Request-Timestamp": ts, "X-Slack-Signature": _sign(body, ts), **(headers or {})},
        "body": body,
    }


@mock.patch.object(index, "_slack_secret", return_value={"signing_secret": SECRET, "bot_token": "xoxb"})
def test_url_verificationにはchallengeを返す(_):
    ts = str(int(index.time.time()))
    body = json.dumps({"type": "url_verification", "challenge": "abc"})
    assert index.handler(_http_event(body, ts), None)["body"] == "abc"


@mock.patch.object(index, "_slack_secret", return_value={"signing_secret": SECRET, "bot_token": "xoxb"})
def test_メンションは非同期で呼び直してすぐ200を返す_再送と許可外チャンネルは無視(_):
    ts = str(int(index.time.time()))
    body = json.dumps({
        "type": "event_callback",
        "authorizations": [{"user_id": "UBOT"}],
        "event": {"type": "app_mention", "channel": "C1", "ts": "1.1", "text": "<@UBOT> 質問"},
    })
    context = SimpleNamespace(function_name="prod-support-bot")
    lam = mock.Mock()
    with mock.patch.object(index.boto3, "client", return_value=lam):
        assert index.handler(_http_event(body, ts), context)["statusCode"] == 200
        sent = json.loads(lam.invoke.call_args.kwargs["Payload"])
        assert sent["kind"] == "answer" and sent["bot_user_id"] == "UBOT"
        assert lam.invoke.call_args.kwargs["InvocationType"] == "Event"

        lam.reset_mock()
        assert index.handler(_http_event(body, ts, {"X-Slack-Retry-Num": "1"}), context)["statusCode"] == 200
        with mock.patch.dict(os.environ, {"ALLOWED_CHANNELS": "C2"}):
            assert index.handler(_http_event(body, ts), context)["statusCode"] == 200
        lam.invoke.assert_not_called()


@mock.patch.object(index, "_slack_secret", return_value={"signing_secret": SECRET, "bot_token": "xoxb"})
def test_署名が違えば401(_):
    event = _http_event("{}", str(int(index.time.time())))
    event["headers"]["X-Slack-Signature"] = "v0=bad"
    assert index.handler(event, None)["statusCode"] == 401


@mock.patch.object(index, "_slack_secret", return_value={"signing_secret": SECRET, "bot_token": "xoxb"})
def test_回答はスレッドへ返す_スレッド外の発言はその文だけで聞く(_):
    with mock.patch.object(index, "ask_claude", return_value="回答です") as ask, \
         mock.patch.object(index, "_slack_api") as slack:
        index.answer({"channel": "C1", "ts": "1.1", "text": "<@UBOT> ログインできない"}, "UBOT")
    ask.assert_called_once_with([{"role": "user", "content": "ログインできない"}])
    slack.assert_called_once_with("chat.postMessage", "xoxb", payload={"channel": "C1", "thread_ts": "1.1", "text": "回答です"})


def test_Claudeへの依頼_マニュアルをキャッシュして渡す_断られたら定型文():
    fake = mock.Mock()
    fake.beta.messages.create.return_value = SimpleNamespace(
        model=index.MODEL, stop_reason="refusal", content=[], _request_id="req_1",
        usage=SimpleNamespace(input_tokens=1, cache_read_input_tokens=0, cache_creation_input_tokens=0, output_tokens=0),
    )
    with mock.patch.dict(os.environ, {"MANUAL_DIR": REPO_MANUAL}), mock.patch.object(index, "_claude", return_value=fake):
        text = index.ask_claude([{"role": "user", "content": "質問"}])
    assert "エンジニア" in text
    kwargs = fake.beta.messages.create.call_args.kwargs
    assert kwargs["model"] == "claude-opus-5-5"
    assert kwargs["fallbacks"] == "default" and kwargs["betas"] == ["server-side-fallback-2026-07-01"]
    assert kwargs["system"][0]["cache_control"] == {"type": "ephemeral", "ttl": "1h"}
    assert "<manual>" in kwargs["system"][0]["text"]
