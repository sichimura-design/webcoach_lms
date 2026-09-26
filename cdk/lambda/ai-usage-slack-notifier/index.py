"""
AI利用ログ(api-server/agents/usage_log.py の1行JSON)をSlackへ通知するLambda

2種類のトリガーを1本で受ける:
- CloudWatch Logsサブスクリプションフィルタ(status=error/timeout の行のみ) → エラーを即時通知
- EventBridgeの定期実行(毎朝) → Logs Insightsで前日(JST)分を集計して投稿

Slack Incoming WebhookのURLはSecrets Manager(WEBHOOK_SECRET_ID)に文字列でそのまま入れておく。
本番とdevで同じチャンネルに投稿するため、見出しに[ENV_NAME]を付けて区別する。
"""
import base64
import gzip
import json
import os
import time
import urllib.request
from datetime import datetime, timedelta, timezone

import boto3

ENV_NAME = os.environ.get("ENV_NAME", "dev")
LOG_GROUP_NAME = os.environ["LOG_GROUP_NAME"]
WEBHOOK_SECRET_ID = os.environ["WEBHOOK_SECRET_ID"]

JST = timezone(timedelta(hours=9))
# 1回の通知に載せるエラー行の上限(大量障害時にSlackを埋め尽くさないため)
MAX_ERROR_LINES = 10

_logs = boto3.client("logs")
_secrets = boto3.client("secretsmanager")
_webhook_url = None

CHAT_QUERY = """
filter event = "ai_chat"
| stats count(*) as n, count_distinct(user_id) as users, sum(input_tokens) as in_tok,
        sum(output_tokens) as out_tok, avg(duration_ms) as avg_ms by status
"""

APP_QUERY = """
filter event = "ai_app_call"
| stats count(*) as n, sum(total_price) as price, latest(currency) as currency,
        avg(duration_ms) as avg_ms by app_id, status
"""


def handler(event, context):
    if "awslogs" in event:
        return _notify_errors(event)
    return _post_daily_summary()


# ---------------------------------------------------------------------------
# エラー即時通知
# ---------------------------------------------------------------------------

def _notify_errors(event):
    payload = json.loads(gzip.decompress(base64.b64decode(event["awslogs"]["data"])))
    records = []
    for log_event in payload.get("logEvents", []):
        try:
            records.append(json.loads(log_event["message"]))
        except (ValueError, KeyError):
            continue
    if not records:
        return {"posted": 0}

    lines = [_format_error(r) for r in records[:MAX_ERROR_LINES]]
    if len(records) > MAX_ERROR_LINES:
        lines.append(f"…ほか {len(records) - MAX_ERROR_LINES} 件")

    _post_to_slack(
        f":rotating_light: *[{ENV_NAME}] AI利用エラー {len(records)}件*\n"
        + "\n".join(lines)
        + f"\n<{_console_link()}|CloudWatch Logsで見る>"
    )
    return {"posted": len(records)}


def _format_error(r):
    ts = r.get("ts", "")
    try:
        ts = datetime.fromisoformat(ts).astimezone(JST).strftime("%m/%d %H:%M:%S")
    except ValueError:
        pass
    target = "AIチャット" if r.get("event") == "ai_chat" else f"Difyアプリ id={r.get('app_id')}"
    detail = " ".join(
        f"{k}={r[k]}" for k in ("error_type", "http_status", "user_id", "duration_ms") if r.get(k) is not None
    )
    return f"• {ts} {target} `{r.get('status')}` {detail}"


# ---------------------------------------------------------------------------
# 日次集計
# ---------------------------------------------------------------------------

def _post_daily_summary():
    today = datetime.now(JST).replace(hour=0, minute=0, second=0, microsecond=0)
    start, end = today - timedelta(days=1), today

    chat_rows = _run_insights(CHAT_QUERY, start, end)
    app_rows = _run_insights(APP_QUERY, start, end)
    _post_to_slack(_format_summary(start, chat_rows, app_rows))
    return {"chat_rows": len(chat_rows), "app_rows": len(app_rows)}


def _format_summary(day, chat_rows, app_rows):
    lines = [f":bar_chart: *[{ENV_NAME}] AI利用 日次集計 {day:%Y/%m/%d}(JST)*"]

    if not chat_rows and not app_rows:
        lines.append("利用なし")
        return "\n".join(lines)

    total = sum(_int(r, "n") for r in chat_rows)
    in_tok = sum(_int(r, "in_tok") for r in chat_rows)
    out_tok = sum(_int(r, "out_tok") for r in chat_rows)
    by_status = ", ".join(f"{r.get('status')} {_int(r, 'n')}" for r in chat_rows)
    lines.append(f"*AIチャット* {total}回 ({by_status})")
    # count_distinct はstatus別の値なので、合計ではなく最大値を「少なくとも」として出す
    lines.append(f"  利用者 {max((_int(r, 'users') for r in chat_rows), default=0)}人以上"
                 f" / Claudeトークン 入力{in_tok:,} 出力{out_tok:,}")

    if app_rows:
        lines.append("*Difyアプリ*")
        by_app = {}
        for r in app_rows:
            app = by_app.setdefault(r.get("app_id", "?"), {"n": 0, "err": 0, "price": 0.0, "currency": ""})
            app["n"] += _int(r, "n")
            if r.get("status") in ("error", "timeout"):
                app["err"] += _int(r, "n")
            app["price"] += _float(r, "price")
            app["currency"] = r.get("currency") or app["currency"]
        for app_id, a in sorted(by_app.items(), key=lambda kv: -kv[1]["n"]):
            err = f" (エラー{a['err']})" if a["err"] else ""
            lines.append(f"  • id={app_id}: {a['n']}回{err} / {a['price']:.4f} {a['currency']}".rstrip())
        total_price = sum(a["price"] for a in by_app.values())
        currency = next((a["currency"] for a in by_app.values() if a["currency"]), "")
        lines.append(f"  合計 {total_price:.4f} {currency}".rstrip())

    return "\n".join(lines)


def _run_insights(query, start, end):
    query_id = _logs.start_query(
        logGroupName=LOG_GROUP_NAME,
        startTime=int(start.timestamp()),
        endTime=int(end.timestamp()),
        queryString=query,
    )["queryId"]
    for _ in range(50):
        res = _logs.get_query_results(queryId=query_id)
        if res["status"] in ("Complete", "Failed", "Cancelled", "Timeout"):
            break
        time.sleep(1)
    if res["status"] != "Complete":
        raise RuntimeError(f"Logs Insights query {res['status']}: {query_id}")
    return [{f["field"]: f["value"] for f in row} for row in res["results"]]


def _int(row, key):
    try:
        return int(float(row.get(key) or 0))
    except ValueError:
        return 0


def _float(row, key):
    try:
        return float(row.get(key) or 0)
    except ValueError:
        return 0.0


# ---------------------------------------------------------------------------
# Slack
# ---------------------------------------------------------------------------

def _post_to_slack(text):
    global _webhook_url
    if _webhook_url is None:
        _webhook_url = _secrets.get_secret_value(SecretId=WEBHOOK_SECRET_ID)["SecretString"].strip()
    req = urllib.request.Request(
        _webhook_url,
        data=json.dumps({"text": text}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()


def _console_link():
    region = os.environ.get("AWS_REGION", "ap-northeast-1")
    group = LOG_GROUP_NAME.replace("/", "$252F")
    return f"https://{region}.console.aws.amazon.com/cloudwatch/home?region={region}#logsV2:log-groups/log-group/{group}"
