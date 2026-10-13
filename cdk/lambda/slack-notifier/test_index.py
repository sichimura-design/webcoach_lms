"""index.py の単体テスト(boto3・Slackへの実通信はモック)

実行: cd cdk/lambda/slack-notifier && python3 -m pytest test_index.py
"""
import base64
import gzip
import json
import os
import sys
from unittest import mock

os.environ.setdefault("USAGE_LOG_GROUP_NAME", "/dev/moodle/api-server")
os.environ.setdefault("USAGE_WEBHOOK_SECRET_ID", "dev/moodle/slack-usage-webhook")
os.environ.setdefault("ALERT_WEBHOOK_SECRET_ID", "dev/moodle/slack-alert-webhook")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-northeast-1")
sys.path.insert(0, os.path.dirname(__file__))

import index  # noqa: E402


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_suppression():
    index._last_notified.clear()


def _subscription_event(messages, log_group="/dev/moodle/api-server"):
    payload = {
        "logGroup": log_group,
        "logEvents": [{"id": str(i), "timestamp": 1790000000000, "message": m} for i, m in enumerate(messages)],
    }
    data = base64.b64encode(gzip.compress(json.dumps(payload).encode())).decode()
    return {"awslogs": {"data": data}}


def test_ai_error_goes_to_alert_channel():
    msgs = [
        json.dumps({"event": "ai_app_call", "ts": "2026-09-26T01:00:00.000+00:00", "status": "timeout",
                    "app_id": 15, "user_id": 3, "duration_ms": 120000, "error_type": "ReadTimeout"}),
        json.dumps({"event": "ai_chat", "ts": "2026-09-26T01:00:05.000+00:00", "status": "error",
                    "user_id": 4, "error_type": "APIError"}),
    ]
    with mock.patch.object(index, "_post_to_slack") as post:
        result = index.handler(_subscription_event(msgs), None)

    assert result["posted"] == 2
    secret_id, text = post.call_args[0]
    assert secret_id == index.ALERT
    assert "[dev] api-server エラー 2件" in text
    assert "09/26 10:00:00 Difyアプリ id=15 `timeout`" in text
    assert "AIチャット `error` error_type=APIError user_id=4" in text


def test_text_errors_are_grouped_and_noise_ignored():
    msgs = [
        "Moodle API error (local_webcoach_utils_get_course_tags): アクセスコントロール例外 course 12",
        "Moodle API error (local_webcoach_utils_get_course_tags): アクセスコントロール例外 course 34",
        "[AUDIT-ALERT] {\"path\":\"/api/.env\"}",
        "Token verification failed: Token expired at 2026-09-26",
        "TypeError: Cannot read properties of undefined (reading `id`)",
    ]
    with mock.patch.object(index, "_post_to_slack") as post:
        result = index.handler(_subscription_event(msgs, "/dev/moodle/bff-server"), None)

    assert result["posted"] == 3
    text = post.call_args[0][1]
    assert "[dev] bff-server エラー 3件" in text
    assert "アクセスコントロール例外 course 12` ×2" in text
    assert "(reading 'id')" in text
    assert "AUDIT-ALERT" not in text and "Token verification" not in text


def test_same_error_is_suppressed_for_a_while():
    event = _subscription_event(["ERROR:    Exception in ASGI application"])
    with mock.patch.object(index, "_post_to_slack") as post:
        index._notify_errors(event, now=1000)
        index._notify_errors(event, now=1000 + index.SUPPRESS_SECONDS - 1)
        assert post.call_count == 1
        index._notify_errors(event, now=1000 + index.SUPPRESS_SECONDS)
        assert post.call_count == 2


def test_long_line_is_truncated():
    with mock.patch.object(index, "_post_to_slack") as post:
        index.handler(_subscription_event(["ERROR " + "x" * 1000]), None)
    assert "x" * index.MAX_LINE_CHARS not in post.call_args[0][1]
    assert "…`" in post.call_args[0][1]


def test_error_notification_caps_lines():
    msgs = [f"ERROR kind{chr(97 + i)}" for i in range(index.MAX_ERROR_LINES + 3)]
    with mock.patch.object(index, "_post_to_slack") as post:
        index.handler(_subscription_event(msgs), None)
    assert "…ほか 3 種類" in post.call_args[0][1]


def test_summary_aggregates_chat_and_apps():
    chat_rows = [
        {"status": "success", "n": "10", "users": "4", "in_tok": "1000", "out_tok": "200"},
        {"status": "error", "n": "1", "users": "1", "in_tok": "0", "out_tok": "0"},
    ]
    app_rows = [
        {"app_id": "15", "status": "success", "n": "3", "price": "0.01", "currency": "USD"},
        {"app_id": "15", "status": "timeout", "n": "1", "price": "0", "currency": ""},
        {"app_id": "19", "status": "success", "n": "1", "price": "0.002", "currency": "USD"},
    ]
    from datetime import datetime
    text = index._format_summary(datetime(2026, 9, 25, tzinfo=index.JST), chat_rows, app_rows)

    assert "2026/09/25" in text
    assert "AIチャット* 11回 (success 10, error 1)" in text
    assert "入力1,000 出力200" in text
    assert "id=15: 4回 (エラー1) / 0.0100 USD" in text
    assert "合計 0.0120 USD" in text


def test_summary_without_usage():
    from datetime import datetime
    text = index._format_summary(datetime(2026, 9, 25, tzinfo=index.JST), [], [])
    assert text.endswith("利用なし")


def _fake_insights(results_by_query):
    """_start_insightsはクエリ文字列をそのままIDとして返し、_wait_insightsでその結果を返す"""
    def start(log_group, query, start, end):
        return query
    def wait(query_id):
        for key, rows in results_by_query.items():
            if key in query_id:
                return rows
        return []
    return start, wait


def test_scheduled_event_runs_summary():
    start, wait = _fake_insights({})
    with mock.patch.object(index, "_start_insights", side_effect=start) as run, \
            mock.patch.object(index, "_wait_insights", side_effect=wait), \
            mock.patch.object(index, "_post_to_slack") as post:
        index.handler({"source": "aws.events"}, None)
    assert run.call_count == 3
    assert post.call_count == 1  # 運用レポートが無ければ期限の通知は出さない
    secret_id, text = post.call_args[0]
    assert secret_id == index.USAGE
    assert "運用レポートが見つかりません" in text
    assert "利用なし" in text


REPORT = {
    "event": "daily_report",
    "kpi": {"date": "2026-10-10", "active_users": 12, "new_users": 1, "coaching_held": 3,
            "coaching_unrecorded": 2, "coaching_today": 4, "notes_awaiting_coach": 5},
    "certificates": [
        {"host": "study.webcoach.jp", "status": "ok", "daysLeft": 120, "validTo": "2027-02-09T00:00:00Z", "error": None},
        {"host": "api.webcoach.jp", "status": "warning", "daysLeft": 20, "validTo": "2026-10-31T00:00:00Z", "error": None},
    ],
    "google": {"status": "danger", "configured": True, "connected": True, "error": "invalid_grant"},
    "model": {"id": "claude-haiku-4-5", "state": "active", "retirementOn": "2026-10-15",
              "retirementNotSoonerThan": True, "daysUntilRetirement": 4, "warning": True},
}


def test_daily_report_goes_to_usage_and_expiry_to_alert():
    start, wait = _fake_insights({"daily_report": [{"@message": json.dumps(REPORT)}]})
    with mock.patch.object(index, "_start_insights", side_effect=start), \
            mock.patch.object(index, "_wait_insights", side_effect=wait), \
            mock.patch.object(index, "_post_to_slack") as post:
        result = index.handler({"source": "aws.events"}, None)

    assert result["alerts"] == 2
    usage = post.call_args_list[0][0]
    assert usage[0] == index.USAGE
    assert "アクティブ 12人 / 新規登録 1人" in usage[1]
    assert "前日 3回・本日予定 4回" in usage[1]
    assert "実施結果の未記録 2回(直近14日) / コーチ確認待ちのAIノート 5件" in usage[1]
    assert "claude-haiku-4-5(active、2026-10-15より前には引退しない)" in usage[1]
    alert = post.call_args_list[1][0]
    assert alert[0] == index.ALERT
    assert "api.webcoach.jp: 残り20日" in alert[1]
    assert "study.webcoach.jp" not in alert[1]
    assert "invalid_grant" in alert[1]
    # 「この日より前には引退しない」は目安なので警告しない
    assert "AIモデル" not in alert[1]


def test_model_retirement_alert():
    report = dict(REPORT, certificates=[], google={"status": "ok"},
                  model={"id": "claude-haiku-4-5", "state": "deprecated", "retirementOn": "2026-12-01",
                         "retirementNotSoonerThan": False, "daysUntilRetirement": 51})
    alerts = index._expiry_alerts(report)
    assert len(alerts) == 1 and "deprecated" in alerts[0]


def test_claude_cost_estimate():
    rows = [
        # 入力100万(うちキャッシュ読み50万・書き10万)、出力10万をHaiku 4.5で
        {"model": "claude-haiku-4-5", "in_tok": "1000000", "cr_tok": "500000", "cw_tok": "100000", "out_tok": "100000"},
        {"model": "claude-unknown-9", "in_tok": "10", "out_tok": "1"},
    ]
    usd, unknown = index._claude_cost(rows)
    # 40万×$1 + 50万×$0.1 + 10万×$1.25 + 10万×$5 = 0.4+0.05+0.125+0.5
    assert round(usd, 4) == 1.075
    assert unknown == ["claude-unknown-9"]


def test_prod_log_stream_prefix_decides_service():
    def event(stream, messages):
        payload = {"logGroup": "/ecs/prod/lms", "logStream": stream,
                   "logEvents": [{"id": "1", "timestamp": 1790000000000, "message": m} for m in messages]}
        return {"awslogs": {"data": base64.b64encode(gzip.compress(json.dumps(payload).encode())).decode()}}

    with mock.patch.object(index, "_post_to_slack") as post:
        # Moodleの通常ログに"error"が含まれても、PHPの致命的エラーでなければ通知しない
        assert index.handler(event("lms/moodle-app/abc", ["Default exception handler: error/invalidlogin"]), None)["posted"] == 0
        assert index.handler(event("lms/moodle-app/abc", ["PHP Fatal error:  Allowed memory size exhausted"]), None)["posted"] == 1
        assert "moodle エラー 1件" in post.call_args[0][1]
        # bffの運用レポート行はerrorキーを含むが通知しない
        assert index.handler(event("bff/bff-server/abc", [json.dumps(REPORT, separators=(",", ":"))]), None)["posted"] == 0
        # nginxはcrit以上だけ
        assert index.handler(event("nginx/nginx/abc", ["[error] 29#29: upstream timed out"]), None)["posted"] == 0
        assert index.handler(event("api/api-server/abc", ["ERROR:root:boom"]), None)["posted"] == 1
        assert "api-server エラー" in post.call_args[0][1]


def test_quiet_hours(monkeypatch):
    monkeypatch.setattr(index, "QUIET_HOURS_JST", "22-9")
    from datetime import datetime
    at = lambda h: datetime(2026, 10, 10, h, tzinfo=index.JST).timestamp()
    assert index._in_quiet_hours(at(23)) and index._in_quiet_hours(at(3))
    assert not index._in_quiet_hours(at(9)) and not index._in_quiet_hours(at(21))
    with mock.patch.object(index, "_post_to_slack") as post:
        assert index._notify_errors(_subscription_event(["ERROR boom"]), now=at(23))["quiet"]
    post.assert_not_called()


def _sns(state, old="OK"):
    msg = {"AlarmName": "prod-alb-5xx", "AlarmDescription": "ALBの5xxが増えています",
           "NewStateValue": state, "OldStateValue": old, "NewStateReason": "Threshold Crossed: 1 datapoint [12.0]"}
    return {"Records": [{"EventSource": "aws:sns", "Sns": {"Message": json.dumps(msg)}}]}


def test_alarm_notifications():
    with mock.patch.object(index, "_post_to_slack") as post:
        assert index.handler(_sns("ALARM"), None)["posted"] == 1
        assert "ALBの5xxが増えています" in post.call_args[0][1]
        assert post.call_args[0][0] == index.ALERT
        assert index.handler(_sns("OK", old="ALARM"), None)["posted"] == 1
        assert "復旧" in post.call_args[0][1]
        assert index.handler(_sns("OK", old="INSUFFICIENT_DATA"), None)["posted"] == 0
        assert index.handler(_sns("INSUFFICIENT_DATA"), None)["posted"] == 0


BUDGET_MESSAGE = """AWS Budget Notification October 20, 2026
AWS Account 840513866884

Dear AWS Customer,

You requested that we alert you when the ACTUAL Cost associated with your prod-monthly-cost budget is greater than $480.00 for the current month. The ACTUAL Cost associated with this budget is $512.34. You can find additional details below and by accessing the AWS Budgets dashboard [1].

Budget Name: prod-monthly-cost
Budget Type: Cost
Budgeted Amount: $600.00
Alert Type: ACTUAL
Alert Threshold: > $480.00
ACTUAL Amount: $512.34

[1] https://console.aws.amazon.com/billing/home#/budgets
"""


def test_budget_notification_goes_to_alert_channel():
    event = {"Records": [{"EventSource": "aws:sns", "Sns": {
        "Subject": "AWS Budgets: prod-monthly-cost has exceeded your alert threshold",
        "Message": BUDGET_MESSAGE,
    }}]}
    with mock.patch.object(index, "_post_to_slack") as post:
        assert index.handler(event, None)["posted"] == 1
    secret_id, text = post.call_args[0]
    assert secret_id == index.ALERT
    assert "AWS費用" in text
    assert "$512.34" in text and "$600.00" in text
    assert "実績" in text
    # 本文の挨拶やURLは載せない
    assert "Dear AWS Customer" not in text


def test_budget_forecast_notification():
    message = BUDGET_MESSAGE.replace("ACTUAL", "FORECASTED").replace("$480.00", "$600.00")
    event = {"Records": [{"EventSource": "aws:sns", "Sns": {
        "Subject": "AWS Budgets: prod-monthly-cost has exceeded your alert threshold", "Message": message}}]}
    with mock.patch.object(index, "_post_to_slack") as post:
        assert index.handler(event, None)["posted"] == 1
    assert "予測" in post.call_args[0][1]


def test_non_json_sns_message_without_budget_is_ignored():
    event = {"Records": [{"EventSource": "aws:sns", "Sns": {"Subject": "hello", "Message": "plain text"}}]}
    with mock.patch.object(index, "_post_to_slack") as post:
        assert index.handler(event, None)["posted"] == 0
    post.assert_not_called()


def test_ecs_task_stopped():
    def ev(reason, containers=()):
        return {"source": "aws.ecs", "detail-type": "ECS Task State Change",
                "detail": {"lastStatus": "STOPPED", "stoppedReason": reason, "stopCode": "EssentialContainerExited",
                           "containers": list(containers)}}

    with mock.patch.object(index, "_post_to_slack") as post:
        assert index.handler(ev("Scaling activity initiated by (deployment ecs-svc/123)"), None)["posted"] == 0
        assert index.handler(ev("Essential container in task exited", [
            {"name": "api-server", "exitCode": 137, "reason": "OutOfMemoryError: Container killed due to memory usage"},
            {"name": "nginx", "exitCode": 0},
        ]), None)["posted"] == 1
    text = post.call_args[0][1]
    assert "api-server: exitCode=137 OutOfMemoryError" in text
    assert "nginx" not in text


# ---------------------------------------------------------------------------
# 送信方式(botトークン / Incoming Webhook)
# ---------------------------------------------------------------------------

class _FakeResponse:
    def __init__(self, body):
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _send(monkeypatch, secrets, response=b"ok"):
    """_post_to_slack を呼び、送ったリクエストを返す"""
    monkeypatch.setattr(index, "_secret_values", {})
    sent = []

    def fake_urlopen(req, timeout):
        sent.append(req)
        return _FakeResponse(response)

    monkeypatch.setattr(index.urllib.request, "urlopen", fake_urlopen)
    with mock.patch.object(index._secrets, "get_secret_value",
                           side_effect=lambda SecretId: {"SecretString": secrets[SecretId] + "\n"}):
        index._post_to_slack(index.ALERT, "障害です")
    return sent


def test_post_with_bot_token(monkeypatch):
    monkeypatch.setattr(index, "SLACK_BOT_TOKEN_SECRET_ID", "dev/moodle/slack-bot-token")
    monkeypatch.setattr(index, "SLACK_CHANNELS", {index.USAGE: "CUSAGE", index.ALERT: "CALERT"})
    sent = _send(monkeypatch, {"dev/moodle/slack-bot-token": "xoxb-test"}, b'{"ok": true}')
    req = sent[0]
    assert req.full_url == "https://slack.com/api/chat.postMessage"
    assert req.get_header("Authorization") == "Bearer xoxb-test"
    body = json.loads(req.data)
    assert body["channel"] == "CALERT"
    assert body["text"] == "障害です"
    # 既存アプリのbotで投稿するので、名前を変えて会員サポートの通知と見分ける
    assert body["username"] == "WebCoach Monitor"


def test_post_with_bot_token_raises_on_slack_error(monkeypatch):
    # chat.postMessage は失敗してもHTTP 200で ok:false を返すので、例外にしてLambdaのエラーとして数える
    monkeypatch.setattr(index, "SLACK_BOT_TOKEN_SECRET_ID", "dev/moodle/slack-bot-token")
    monkeypatch.setattr(index, "SLACK_CHANNELS", {index.USAGE: "CUSAGE", index.ALERT: "CALERT"})
    with pytest.raises(RuntimeError, match="channel_not_found"):
        _send(monkeypatch, {"dev/moodle/slack-bot-token": "xoxb-test"}, b'{"ok": false, "error": "channel_not_found"}')


def test_post_with_webhook_when_no_bot_token(monkeypatch):
    monkeypatch.setattr(index, "SLACK_BOT_TOKEN_SECRET_ID", "")
    sent = _send(monkeypatch, {"dev/moodle/slack-alert-webhook": "https://hooks.slack.com/services/T/B/x"})
    assert sent[0].full_url == "https://hooks.slack.com/services/T/B/x"
    assert json.loads(sent[0].data) == {"text": "障害です"}
