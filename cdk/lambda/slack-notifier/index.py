"""
api-server / bff-server のログをSlackへ通知するLambda

2種類のトリガーを1本で受け、投稿先チャンネル(=Webhook)を分ける:
- CloudWatch Logsサブスクリプションフィルタ → エラーを即時通知(アラート用チャンネル)
    - api-server/bff-server のエラーっぽい行(ERROR/Traceback/Error等の文字列マッチ)
    - AI利用ログ(api-server/agents/usage_log.py の1行JSON)のうち status=error/timeout
- EventBridgeの定期実行(毎朝) → Logs Insightsで前日(JST)のAI利用状況を集計(利用状況用チャンネル)

Slack Incoming WebhookのURLはSecrets Managerに文字列でそのまま入れておく。
本番とdevで同じチャンネルに投稿するため、見出しに[ENV_NAME]を付けて区別する。
"""
import base64
import gzip
import json
import os
import re
import time
import urllib.request
from datetime import datetime, timedelta, timezone

import boto3

ENV_NAME = os.environ.get("ENV_NAME", "dev")
# 日次集計(Logs Insights)の対象。AI利用ログはapi-serverが出す
USAGE_LOG_GROUP_NAME = os.environ["USAGE_LOG_GROUP_NAME"]
USAGE_WEBHOOK_SECRET_ID = os.environ["USAGE_WEBHOOK_SECRET_ID"]
ALERT_WEBHOOK_SECRET_ID = os.environ["ALERT_WEBHOOK_SECRET_ID"]

JST = timezone(timedelta(hours=9))
# 1回の通知に載せるエラー行の上限(大量障害時にSlackを埋め尽くさないため)
MAX_ERROR_LINES = 10
# 1行あたりの最大文字数(巨大なスタックトレースやレスポンス本文の垂れ流し対策)
MAX_LINE_CHARS = 300
# 同じエラー(数字を伏せた文面が同じもの)を再通知しない秒数。
# 同時実行1本のLambdaのメモリに持つだけなので、コールドスタートでリセットされる割り切り
SUPPRESS_SECONDS = 600

# 文字列マッチで拾ってしまう想定内のログ。通知しない
IGNORE_PATTERNS = [re.compile(p) for p in (
    r"\[AUDIT-ALERT\]",               # 外部スキャナによる /.env 等への不審アクセス(4xxで弾いている)
    r"Token verification failed",     # トークン期限切れ・不正形式(ログイン画面へ戻すだけ)
)]

_logs = boto3.client("logs")
_secrets = boto3.client("secretsmanager")
_webhook_urls = {}
# エラーの文面シグネチャ → 最後に通知した時刻(epoch秒)
_last_notified = {}

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

def _notify_errors(event, now=None):
    payload = json.loads(gzip.decompress(base64.b64decode(event["awslogs"]["data"])))
    log_group = payload.get("logGroup", "")
    # "/dev/moodle/api-server" → "api-server"
    service = log_group.rstrip("/").rsplit("/", 1)[-1] or "?"
    now = time.time() if now is None else now

    # 同じ文面のエラーは1行にまとめて件数を付ける(dictは挿入順を保つ)
    groups = {}
    for log_event in payload.get("logEvents", []):
        message = (log_event.get("message") or "").strip()
        if not message or any(p.search(message) for p in IGNORE_PATTERNS):
            continue
        sig = _signature(message)
        if sig in groups:
            groups[sig]["count"] += 1
        else:
            groups[sig] = {"line": _format_error(message, log_event.get("timestamp")), "count": 1}

    fresh = {sig: g for sig, g in groups.items() if now - _last_notified.get(sig, 0) >= SUPPRESS_SECONDS}
    if not fresh:
        return {"posted": 0, "suppressed": len(groups)}
    for sig in fresh:
        _last_notified[sig] = now

    lines = [g["line"] + (f" ×{g['count']}" if g["count"] > 1 else "") for g in fresh.values()]
    total = sum(g["count"] for g in fresh.values())
    shown = lines[:MAX_ERROR_LINES]
    if len(lines) > MAX_ERROR_LINES:
        shown.append(f"…ほか {len(lines) - MAX_ERROR_LINES} 種類")

    _post_to_slack(
        ALERT_WEBHOOK_SECRET_ID,
        f":rotating_light: *[{ENV_NAME}] {service} エラー {total}件*\n"
        + "\n".join(shown)
        + f"\n_同じエラーは{SUPPRESS_SECONDS // 60}分間再通知しません_"
        + f"\n<{_console_link(log_group)}|CloudWatch Logsで見る>",
    )
    return {"posted": total, "suppressed": len(groups) - len(fresh)}


def _signature(message):
    """ID・時刻・件数などの数字を伏せ、同じ種類のエラーを同一視するためのキー"""
    return re.sub(r"\d+", "N", message[:MAX_LINE_CHARS])


def _format_error(message, timestamp_ms=None):
    record = None
    if message.startswith("{"):
        try:
            record = json.loads(message)
        except ValueError:
            pass

    if isinstance(record, dict) and record.get("event") in ("ai_chat", "ai_app_call"):
        return _format_ai_error(record)

    ts = ""
    if timestamp_ms:
        ts = datetime.fromtimestamp(timestamp_ms / 1000, JST).strftime("%m/%d %H:%M:%S") + " "
    text = message if len(message) <= MAX_LINE_CHARS else message[:MAX_LINE_CHARS] + "…"
    # バッククォートが混じるとSlackのコード表示が崩れるので置き換える
    text = text.replace("`", "'")
    return f"• {ts}`{text}`"


def _format_ai_error(r):
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
    _post_to_slack(USAGE_WEBHOOK_SECRET_ID, _format_summary(start, chat_rows, app_rows))
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
        logGroupName=USAGE_LOG_GROUP_NAME,
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

def _post_to_slack(secret_id, text):
    url = _webhook_urls.get(secret_id)
    if url is None:
        url = _webhook_urls[secret_id] = _secrets.get_secret_value(SecretId=secret_id)["SecretString"].strip()
    req = urllib.request.Request(
        url,
        data=json.dumps({"text": text}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()


def _console_link(log_group):
    region = os.environ.get("AWS_REGION", "ap-northeast-1")
    group = log_group.replace("/", "$252F")
    return f"https://{region}.console.aws.amazon.com/cloudwatch/home?region={region}#logsV2:log-groups/log-group/{group}"
