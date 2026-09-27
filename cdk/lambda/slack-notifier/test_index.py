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
    assert secret_id == "dev/moodle/slack-alert-webhook"
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


def test_scheduled_event_runs_summary():
    with mock.patch.object(index, "_run_insights", return_value=[]) as run, \
            mock.patch.object(index, "_post_to_slack") as post:
        index.handler({"source": "aws.events"}, None)
    assert run.call_count == 2
    secret_id, text = post.call_args[0]
    assert secret_id == "dev/moodle/slack-usage-webhook"
    assert "利用なし" in text
