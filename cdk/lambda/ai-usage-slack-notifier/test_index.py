"""index.py の単体テスト(boto3・Slackへの実通信はモック)

実行: cd cdk/lambda/ai-usage-slack-notifier && python3 -m pytest test_index.py
"""
import base64
import gzip
import json
import os
import sys
from unittest import mock

os.environ.setdefault("LOG_GROUP_NAME", "/dev/moodle/api-server")
os.environ.setdefault("WEBHOOK_SECRET_ID", "dev/moodle/slack-ai-usage-webhook")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-northeast-1")
sys.path.insert(0, os.path.dirname(__file__))

import index  # noqa: E402


def _subscription_event(messages):
    payload = {"logEvents": [{"id": str(i), "timestamp": 0, "message": m} for i, m in enumerate(messages)]}
    data = base64.b64encode(gzip.compress(json.dumps(payload).encode())).decode()
    return {"awslogs": {"data": data}}


def test_error_notification_formats_each_record():
    msgs = [
        json.dumps({"event": "ai_app_call", "ts": "2026-09-26T01:00:00.000+00:00", "status": "timeout",
                    "app_id": 15, "user_id": 3, "duration_ms": 120000, "error_type": "ReadTimeout"}),
        json.dumps({"event": "ai_chat", "ts": "2026-09-26T01:00:05.000+00:00", "status": "error",
                    "user_id": 4, "error_type": "APIError"}),
        "not json",
    ]
    with mock.patch.object(index, "_post_to_slack") as post:
        result = index.handler(_subscription_event(msgs), None)

    assert result == {"posted": 2}
    text = post.call_args[0][0]
    assert "[dev] AI利用エラー 2件" in text
    assert "09/26 10:00:00 Difyアプリ id=15 `timeout`" in text
    assert "AIチャット `error` error_type=APIError user_id=4" in text


def test_error_notification_caps_lines():
    msgs = [json.dumps({"event": "ai_chat", "status": "error"})] * (index.MAX_ERROR_LINES + 3)
    with mock.patch.object(index, "_post_to_slack") as post:
        index.handler(_subscription_event(msgs), None)
    assert "…ほか 3 件" in post.call_args[0][0]


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
    assert "利用なし" in post.call_args[0][0]
