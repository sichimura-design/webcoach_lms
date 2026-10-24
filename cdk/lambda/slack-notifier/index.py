"""
WebCoachの監視・利用状況をSlackへ通知するLambda(dev: cdk/lib/slack-notifier-stack.ts、
本番: cdk-prod/lib/slack-notifier-stack.ts。コードはこの1つを共用する)

6種類のトリガーを1本で受け、投稿先チャンネル(=Webhook)を分ける:
- CloudWatch Logsサブスクリプションフィルタ → エラーを即時通知(アラート用チャンネル)
    - api-server / bff-server / moodle / nginx のエラーっぽい行(文字列マッチ)
    - AI利用ログ(api-server/agents/usage_log.py の1行JSON)のうち status=error/timeout
- CloudWatchアラーム(SNS経由) → ALB 5xx・ヘルスチェック失敗・RDS負荷などの状態変化(アラート用)
- AWS Budgets(SNS経由) → 月の費用の実績・予測が予算の警告ラインを超えた(アラート用、本番のみ)
- EventBridgeのECSタスク停止イベント → 予定外のタスク停止(アラート用)
- EventBridgeのGuardDuty検知イベント → 脅威の検知(アラート用、本番のみ。重要度の絞り込みはルール側)
- EventBridgeの定期実行(毎朝9時) → 前日の利用状況・運用KPI・費用(利用状況用チャンネル)と、
  証明書/Google連携/AIモデルの期限切れが近いもの(アラート用)

Slackへは、botトークン(chat.postMessage、投稿先はチャンネルID)かIncoming Webhookのどちらかで送る。
トークン・Webhook URLはSecrets Managerに文字列でそのまま入れておく。
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
# 日次集計(Logs Insights)の対象。AI利用ログはapi-server、運用レポート(daily_report)はbff-serverが出す
USAGE_LOG_GROUP_NAME = os.environ["USAGE_LOG_GROUP_NAME"]
REPORT_LOG_GROUP_NAME = os.environ.get("REPORT_LOG_GROUP_NAME", USAGE_LOG_GROUP_NAME)
# 投稿先(利用状況チャンネル / エラーチャンネル)
USAGE = "usage"
ALERT = "alert"
# botトークン方式: トークンはSecrets Managerに文字列で入れ、投稿先はチャンネルIDで指定する。
# 未設定ならIncoming Webhook方式(チャンネルごとのWebhook URLをSecrets Managerに入れる)
SLACK_BOT_TOKEN_SECRET_ID = os.environ.get("SLACK_BOT_TOKEN_SECRET_ID", "")
SLACK_CHANNELS = {USAGE: os.environ.get("SLACK_USAGE_CHANNEL", ""), ALERT: os.environ.get("SLACK_ALERT_CHANNEL", "")}
WEBHOOK_SECRET_IDS = {
    USAGE: os.environ.get("USAGE_WEBHOOK_SECRET_ID", ""),
    ALERT: os.environ.get("ALERT_WEBHOOK_SECRET_ID", ""),
}
# botトークン方式は会員サポート用の既存アプリ(notify-member-support)のbotで投稿するので、
# 名前とアイコンを変えて見分けられるようにする(chat:write.customize)
BOT_USERNAME = "WebCoach Monitor"
BOT_ICON_EMOJI = ":bar_chart:"
# AWS費用を日次集計に載せるか(devのアカウントは他案件と共用なので載せない)
COST_REPORT_ENABLED = os.environ.get("COST_REPORT_ENABLED") == "true"
# エラーのログ通知を止める時間帯(JST、"22-9"なら22:00〜翌8:59)。devはRDSを夜間止めるので接続エラーが出る
QUIET_HOURS_JST = os.environ.get("QUIET_HOURS_JST", "")

JST = timezone(timedelta(hours=9))
# 1回の通知に載せるエラー行の上限(大量障害時にSlackを埋め尽くさないため)
MAX_ERROR_LINES = 10
# 1行あたりの最大文字数(巨大なスタックトレースやレスポンス本文の垂れ流し対策)
MAX_LINE_CHARS = 300
# 同じエラー(数字を伏せた文面が同じもの)を再通知しない秒数。
# 同時実行1本のLambdaのメモリに持つだけなので、コールドスタートでリセットされる割り切り
SUPPRESS_SECONDS = 600
# Logs Insightsの結果を待つ上限(秒)。Lambdaのタイムアウトより十分短くする
INSIGHTS_WAIT_SECONDS = 60
# 期限の警告を出す残り日数
CERT_ALERT_DAYS = 30
MODEL_ALERT_DAYS = 60

# サービスごとの「エラーとみなす行」。サブスクリプションフィルタは広めに拾い、ここで絞る
ERROR_PATTERNS = {
    # Pythonのloggingの「- ERROR -」「ERROR:」、uvicornの未処理例外、Traceback
    "api-server": re.compile(r"ERROR|CRITICAL|Traceback"),
    # console.error の書式が統一されていないため広めに拾い、想定内のものはIGNORE_PATTERNSで捨てる
    "bff-server": re.compile(r"Error|ERROR|error|Exception|Failed|failed|エラー|失敗"),
    # PHPの致命的エラーだけ(Moodleの通常のNoticeやデバッグ出力は拾わない)
    "moodle": re.compile(r"PHP (Fatal|Parse) error|Fatal error"),
    # nginxのerror_logの重大なものだけ(upstreamのタイムアウト等はALBの5xxアラームで見る)
    "nginx": re.compile(r"\[(crit|alert|emerg)\]"),
}

# 文字列マッチで拾ってしまう想定内のログ。通知しない
IGNORE_PATTERNS = [re.compile(p) for p in (
    r"\[AUDIT-ALERT\]",               # 外部スキャナによる /.env 等への不審アクセス(4xxで弾いている)
    r"Token verification failed",     # トークン期限切れ・不正形式(ログイン画面へ戻すだけ)
    r'^\{"event":"daily_report"',     # 毎朝の運用レポート(中身に"error"キーがあるだけ)
)]

# ECSのタスク停止のうち、デプロイ・台数変更・手動停止による想定内のもの
EXPECTED_STOP_REASONS = re.compile(r"^Scaling activity initiated by|^Task stopped by user")

# AWSのサービス名(Cost Explorer)の短い表示名。載っていないものはそのまま出す
AWS_SERVICE_LABELS = {
    "Amazon Elastic Compute Cloud - Compute": "EC2",
    "EC2 - Other": "EC2その他(EBS・通信等)",
    "Amazon Relational Database Service": "RDS",
    "Amazon Elastic Container Service": "ECS",
    "Amazon Elastic Load Balancing": "ALB",
    "Amazon Virtual Private Cloud": "VPC(NAT等)",
    "Amazon Simple Storage Service": "S3",
    "Amazon CloudFront": "CloudFront",
    "AmazonCloudWatch": "CloudWatch",
    "Amazon Elastic File System": "EFS",
    "AWS Secrets Manager": "Secrets Manager",
    "Amazon EC2 Container Registry (ECR)": "ECR",
    "AWS Lambda": "Lambda",
    "Amazon Route 53": "Route 53",
    "Amazon Simple Email Service": "SES",
    "Amazon Cognito": "Cognito",
    "Tax": "税",
}
WEEKDAYS_JA = "月火水木金土日"
CHAT_STATUS_LABELS = {"success": "成功", "error": "エラー", "timeout": "タイムアウト", "cancelled": "中止",
                      "rejected": "拒否"}

# Claudeの単価(USD / 100万トークン)。キャッシュ読みは入力の0.1倍、書きは1.25倍。
# 載っていないモデルはトークン数だけ出す
CLAUDE_PRICES = {
    "claude-opus-5-5": (4.0, 20.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-sonnet-4-5": (3.0, 15.0),
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-haiku-4-5": (1.0, 5.0),
}

_logs = boto3.client("logs")
_secrets = boto3.client("secretsmanager")
# Secrets Managerから読んだ値(botトークン / Webhook URL)。コールドスタートまで使い回す
_secret_values = {}
# エラーの文面シグネチャ → 最後に通知した時刻(epoch秒)
_last_notified = {}

CHAT_QUERY = """
filter event = "ai_chat"
| stats count(*) as n, count_distinct(user_id) as users, sum(input_tokens) as in_tok,
        sum(output_tokens) as out_tok, sum(cache_read_tokens) as cr_tok,
        sum(cache_creation_tokens) as cw_tok, avg(duration_ms) as avg_ms by status, model
"""

# 集計結果に元のフィールドと同じ名前を付けない(latest(currency) as currency は
# Logs Insights が「Cycle found in operation dependency graph」で失敗する)
APP_QUERY = """
filter event = "ai_app_call"
| stats count(*) as n, sum(total_price) as price, latest(currency) as price_currency,
        latest(app_name) as app_label, avg(duration_ms) as avg_ms by app_id, status
"""

REPORT_QUERY = """
filter event = "daily_report"
| sort @timestamp desc
| limit 1
| fields @message
"""


def handler(event, context):
    if "awslogs" in event:
        return _notify_errors(event)
    records = event.get("Records") or []
    if records and records[0].get("EventSource") == "aws:sns":
        return _notify_alarms(records)
    if event.get("source") == "aws.ecs":
        return _notify_task_stopped(event)
    if event.get("source") == "aws.guardduty":
        return _notify_guardduty(event)
    return _post_daily_summary()


# ---------------------------------------------------------------------------
# エラー即時通知(ログ)
# ---------------------------------------------------------------------------

def _service_of(log_group, log_stream):
    """本番はロググループ1つにストリームの接頭辞(api/・bff/・lms/・nginx/)で分かれている"""
    prefix = (log_stream or "").split("/", 1)[0]
    by_prefix = {"api": "api-server", "bff": "bff-server", "lms": "moodle", "nginx": "nginx"}
    if prefix in by_prefix:
        return by_prefix[prefix]
    # devは "/dev/moodle/api-server" のようにロググループで分かれている
    return log_group.rstrip("/").rsplit("/", 1)[-1] or "?"


def _in_quiet_hours(now):
    if not QUIET_HOURS_JST:
        return False
    start, end = (int(h) for h in QUIET_HOURS_JST.split("-"))
    hour = datetime.fromtimestamp(now, JST).hour
    if start > end:  # 日をまたぐ(22-9)
        return hour >= start or hour < end
    return start <= hour < end


def _is_error_line(service, message):
    if any(p.search(message) for p in IGNORE_PATTERNS):
        return False
    record = _parse_json(message)
    if isinstance(record, dict) and record.get("event") in ("ai_chat", "ai_app_call"):
        return record.get("status") in ("error", "timeout")
    pattern = ERROR_PATTERNS.get(service)
    return bool(pattern.search(message)) if pattern else True


def _notify_errors(event, now=None):
    payload = json.loads(gzip.decompress(base64.b64decode(event["awslogs"]["data"])))
    log_group = payload.get("logGroup", "")
    service = _service_of(log_group, payload.get("logStream", ""))
    now = time.time() if now is None else now
    if _in_quiet_hours(now):
        return {"posted": 0, "suppressed": 0, "quiet": True}

    # 同じ文面のエラーは1行にまとめて件数を付ける(dictは挿入順を保つ)
    groups = {}
    for log_event in payload.get("logEvents", []):
        message = (log_event.get("message") or "").strip()
        if not message or not _is_error_line(service, message):
            continue
        sig = service + ":" + _signature(message)
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
        ALERT,
        f":rotating_light: *[{ENV_NAME}] {service} エラー {total}件*\n"
        + "\n".join(shown)
        + f"\n_同じエラーは{SUPPRESS_SECONDS // 60}分間再通知しません_"
        + f"\n<{_console_link(log_group)}|CloudWatch Logsで見る>",
    )
    return {"posted": total, "suppressed": len(groups) - len(fresh)}


def _parse_json(message):
    if not message.startswith("{"):
        return None
    try:
        return json.loads(message)
    except ValueError:
        return None


def _signature(message):
    """ID・時刻・件数などの数字を伏せ、同じ種類のエラーを同一視するためのキー"""
    return re.sub(r"\d+", "N", message[:MAX_LINE_CHARS])


def _format_error(message, timestamp_ms=None):
    record = _parse_json(message)
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
# CloudWatchアラーム(SNS経由)
# ---------------------------------------------------------------------------

def _notify_alarms(records):
    posted = 0
    for record in records:
        sns_record = record.get("Sns") or {}
        if (sns_record.get("Subject") or "").startswith("AWS Budgets"):
            posted += _notify_budget(sns_record.get("Message") or "")
            continue
        try:
            alarm = json.loads(sns_record["Message"])
        except (KeyError, ValueError):
            continue
        title = alarm.get("AlarmDescription") or alarm.get("AlarmName")
        state = alarm.get("NewStateValue")
        if state == "ALARM":
            head = f":rotating_light: *[{ENV_NAME}] {title}*"
        elif state == "OK" and alarm.get("OldStateValue") == "ALARM":
            head = f":white_check_mark: *[{ENV_NAME}] 復旧: {title}*"
        else:
            # INSUFFICIENT_DATA や 初回のOK は知らせない
            continue
        reason = (alarm.get("NewStateReason") or "")[:MAX_LINE_CHARS].replace("`", "'")
        _post_to_slack(ALERT, f"{head}\n`{alarm.get('AlarmName')}` {reason}")
        posted += 1
    return {"posted": posted}


# AWS Budgetsの通知(SNSのMessageはJSONではなく英文のメール本文)から拾う行
BUDGET_FIELDS = re.compile(
    r"^(Budget Name|Budgeted Amount|Alert Type|Alert Threshold|ACTUAL Amount|FORECASTED Amount):\s*(.+)$",
    re.MULTILINE,
)


def _notify_budget(message):
    """月の予算(cdk-prod の MonthlyBudget)の実績・予測が閾値を超えたとき"""
    fields = dict(BUDGET_FIELDS.findall(message))
    if not fields:
        return 0
    alert_type = fields.get("Alert Type", "")
    kind = "予測" if alert_type == "FORECASTED" else "実績"
    amount = fields.get(f"{alert_type} Amount", "?")
    head = f":money_with_wings: *[{ENV_NAME}] AWS費用が予算の警告ラインを超えました({kind})*"
    body = (
        f"今月の{kind} {amount} / 予算 {fields.get('Budgeted Amount', '?')}"
        f"(警告ライン {fields.get('Alert Threshold', '?')})\n"
        f"`{fields.get('Budget Name', '')}` 内訳はCost Explorerで確認"
    )
    _post_to_slack(ALERT, f"{head}\n{body}")
    return 1


# ---------------------------------------------------------------------------
# ECSタスクの停止
# ---------------------------------------------------------------------------

def _notify_task_stopped(event):
    detail = event.get("detail") or {}
    if detail.get("lastStatus") != "STOPPED":
        return {"posted": 0}
    reason = detail.get("stoppedReason") or ""
    if EXPECTED_STOP_REASONS.search(reason):
        return {"posted": 0, "expected": True}

    lines = [
        f":warning: *[{ENV_NAME}] ECSタスクが停止しました*",
        f"理由: `{reason[:MAX_LINE_CHARS]}` (stopCode={detail.get('stopCode')})",
    ]
    for c in detail.get("containers") or []:
        exit_code = c.get("exitCode")
        if exit_code in (None, 0) and not c.get("reason"):
            continue
        lines.append(f"  • {c.get('name')}: exitCode={exit_code} {c.get('reason') or ''}".rstrip())
    lines.append("_サービスが自動で代わりのタスクを起動します。続く場合はALB/ヘルスチェックの通知も確認してください_")
    _post_to_slack(ALERT, "\n".join(lines))
    return {"posted": 1}


# ---------------------------------------------------------------------------
# GuardDutyの検知
# ---------------------------------------------------------------------------

# GuardDutyの重要度(0.1〜10)の区分。下限の大きい順に見る
GUARDDUTY_SEVERITY_LABELS = ((9.0, "致命的"), (7.0, "高"), (4.0, "中"), (0.0, "低"))


def _notify_guardduty(event):
    """同じ検知が続くとGuardDutyは件数(service.count)を増やして再送してくるので、初回だけ知らせる"""
    detail = event.get("detail") or {}
    service = detail.get("service") or {}
    if (service.get("count") or 1) > 1:
        return {"posted": 0, "repeated": True}

    severity = float(detail.get("severity") or 0)
    label = next(name for floor, name in GUARDDUTY_SEVERITY_LABELS if severity >= floor)
    icon = ":rotating_light:" if severity >= 7 else ":warning:"
    sample = " (サンプル)" if (service.get("additionalInfo") or {}).get("sample") else ""
    lines = [
        f"{icon} *[{ENV_NAME}] GuardDutyが脅威を検知しました(重要度: {label} {severity:g}){sample}*",
        f"*{detail.get('title') or detail.get('type')}*",
        f"種類: `{detail.get('type')}`",
    ]
    target = _guardduty_target(detail.get("resource") or {})
    if target:
        lines.append(f"対象: {target}")
    description = (detail.get("description") or "")[:MAX_LINE_CHARS]
    if description:
        lines.append(f"> {description}")
    region = detail.get("region") or os.environ.get("AWS_REGION", "ap-northeast-1")
    lines.append(
        f"<https://{region}.console.aws.amazon.com/guardduty/home?region={region}#/findings?macros=current"
        f"&fId={detail.get('id')}|GuardDutyで詳細を見る>"
    )
    _post_to_slack(ALERT, "\n".join(lines))
    return {"posted": 1}


def _guardduty_target(resource):
    """検知の対象を1行で(EC2・IAMのキー・S3・RDS・Lambdaなど種類ごとに主なIDを拾う)"""
    kind = resource.get("resourceType") or ""
    instance = resource.get("instanceDetails") or {}
    access_key = resource.get("accessKeyDetails") or {}
    buckets = [b.get("name") for b in resource.get("s3BucketDetails") or [] if b.get("name")]
    rds = resource.get("rdsDbInstanceDetails") or {}
    lambda_fn = resource.get("lambdaDetails") or {}
    if instance.get("instanceId"):
        return f"{kind} `{instance['instanceId']}`"
    if access_key.get("userName") or access_key.get("accessKeyId"):
        return f"{kind} `{access_key.get('userName') or ''}` (キー `{access_key.get('accessKeyId') or ''}`)"
    if buckets:
        return f"{kind} `{', '.join(buckets)}`"
    if rds.get("dbInstanceIdentifier"):
        return f"{kind} `{rds['dbInstanceIdentifier']}`"
    if lambda_fn.get("functionName"):
        return f"{kind} `{lambda_fn['functionName']}`"
    return kind


# ---------------------------------------------------------------------------
# 日次集計
# ---------------------------------------------------------------------------

def _post_daily_summary():
    now = datetime.now(JST)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start, end = today - timedelta(days=1), today

    # クエリを先に全部投げてから待つ(順番に待つとLambdaのタイムアウトに近づく)
    queries = {
        "chat": _start_insights(USAGE_LOG_GROUP_NAME, CHAT_QUERY, start, end),
        "app": _start_insights(USAGE_LOG_GROUP_NAME, APP_QUERY, start, end),
        # 運用レポートはBFFが8時台に書くので、今朝分を拾えるよう終わりを今にする
        "report": _start_insights(REPORT_LOG_GROUP_NAME, REPORT_QUERY, now - timedelta(hours=20), now),
    }
    results = {name: _wait_insights(qid) for name, qid in queries.items()}
    report = _parse_json(results["report"][0].get("@message", "")) if results["report"] else None

    cost = _fetch_aws_cost(start) if COST_REPORT_ENABLED else None
    _post_to_slack(USAGE, _format_summary(start, results["chat"], results["app"], report, cost))

    alerts = _expiry_alerts(report)
    if alerts:
        _post_to_slack(
            ALERT,
            f":hourglass_flowing_sand: *[{ENV_NAME}] 期限が近いもの・確認が必要なもの*\n" + "\n".join(alerts)
            + "\n_管理画面の「期限管理」で詳細を確認できます_",
        )
    return {"chat_rows": len(results["chat"]), "app_rows": len(results["app"]), "report": report is not None,
            "alerts": len(alerts)}


def _format_summary(day, chat_rows, app_rows, report=None, cost=None):
    lines = [f":bar_chart: *[{ENV_NAME}] 日次レポート {day:%Y/%m/%d}({WEEKDAYS_JA[day.weekday()]})の1日分*", "━━━━━━━━━━━━━━━━"]
    sections = [_format_kpi(report), _format_ai_usage(chat_rows, app_rows) + _format_model(report)]
    if cost is not None:
        sections.append(_format_cost(cost))
    for section in sections:
        lines += [""] + section
    return "\n".join(lines)


def _format_kpi(report):
    # Slackのmrkdwnは *太字* / _斜体_ の前後に空白か記号が無いと効かないため、必ず空白で区切る
    head = "*:busts_in_silhouette: 利用者・コーチング*"
    if not report:
        return [head, "• 運用レポートが見つかりません _(BFFが止まっている/8時台に動いていない可能性)_"]
    kpi = report.get("kpi") or {}
    if "error" in kpi:
        return [head, f"• 取得できませんでした `{kpi['error']}`"]
    lines = [
        head,
        # active_usersはMoodleに操作が残った人数(受講生・コーチ・管理者を区別しない)
        f"• ログインして操作した人 *{kpi.get('active_users', 0)}人* _(受講生・コーチ・管理者の合計)_",
        f"• 新規登録 *{kpi.get('new_users', 0)}人*",
        f"• コーチング 前日の実施 *{kpi.get('coaching_held', 0)}回* / 本日の予定 *{kpi.get('coaching_today', 0)}回*",
    ]
    todo = []
    if kpi.get("coaching_unrecorded"):
        todo.append(f"> • 実施結果が未記録のコーチング *{kpi['coaching_unrecorded']}回* _(直近14日)_")
    if kpi.get("notes_awaiting_coach"):
        todo.append(f"> • コーチの確認待ちのAIノート *{kpi['notes_awaiting_coach']}件*")
    if todo:
        lines += ["> :memo: *要対応*"] + todo
    return lines


def _format_ai_usage(chat_rows, app_rows):
    head = "*:robot_face: AIの利用*"
    if not chat_rows and not app_rows:
        return [head, "• 利用なし"]
    lines = [head]
    chat_usd = app_usd = None
    if chat_rows:
        total = sum(_int(r, "n") for r in chat_rows)
        by_status = {}
        for r in chat_rows:
            by_status[r.get("status")] = by_status.get(r.get("status"), 0) + _int(r, "n")
        failed = {s: n for s, n in by_status.items() if s != "success" and n}
        result = ("、".join(f"{CHAT_STATUS_LABELS.get(s, s)} {n}回" for s, n in failed.items())
                  if failed else "すべて成功")
        # count_distinct は行(結果×モデル)ごとの値で、足すと同じ人を重複して数えるため最大値を出す。
        # 行が複数あるときは実際の人数がそれより多い可能性がある
        users = max((_int(r, "users") for r in chat_rows), default=0)
        users_text = f"{users}人" + ("以上" if len(chat_rows) > 1 else "")
        in_tok = sum(_int(r, "in_tok") for r in chat_rows)
        out_tok = sum(_int(r, "out_tok") for r in chat_rows)
        chat_usd, unknown = _claude_cost(chat_rows)
        lines.append(f"• AIチャット *{total}回* _({result})_ / 使った人 *{users_text}*")
        lines.append(f"      ◦ 約${chat_usd:.2f} _(Claude 入力{in_tok:,} / 出力{out_tok:,}トークン)_"
                     + (f" ※単価不明のモデルは含まず: `{', '.join(unknown)}`" if unknown else ""))

    if app_rows:
        by_app = {}
        for r in app_rows:
            app = by_app.setdefault(r.get("app_id", "?"), {"n": 0, "err": 0, "price": 0.0, "currency": "", "name": ""})
            app["n"] += _int(r, "n")
            if r.get("status") in ("error", "timeout"):
                app["err"] += _int(r, "n")
            app["price"] += _float(r, "price")
            app["currency"] = r.get("price_currency") or app["currency"]
            app["name"] = r.get("app_label") or app["name"]
        total_n = sum(a["n"] for a in by_app.values())
        app_usd = sum(a["price"] for a in by_app.values())
        currency = next((a["currency"] for a in by_app.values() if a["currency"]), "USD")
        lines.append(f"• Difyアプリ *{total_n}回* / 約{_money(app_usd, currency)}")
        for app_id, a in sorted(by_app.items(), key=lambda kv: -kv[1]["n"]):
            name = f"{a['name']} `id={app_id}`" if a["name"] else f"`id={app_id}`"
            err = f" _(うちエラー{a['err']}回)_" if a["err"] else ""
            lines.append(f"      ◦ {name} {a['n']}回{err} / {_money(a['price'], a['currency'] or currency, 4)}")
        if currency != "USD":
            app_usd = None  # 円建て等なら合計に混ぜない

    if chat_usd is not None and app_usd is not None:
        lines.append(f"• AI費用の合計 *約${chat_usd + app_usd:.2f}*")
    return lines


def _money(amount, currency, digits=2):
    """Difyの利用料はアプリ単位だと1セント未満が多いので、内訳だけ桁を増やして出す"""
    if currency == "USD":
        return f"${amount:.{digits}f}"
    return f"{amount:.{digits}f} {currency}".rstrip()


def _format_model(report):
    model = (report or {}).get("model") or {}
    if not model.get("id"):
        return []
    retire = model.get("retirementOn")
    if retire:
        retire = f"{retire}までは提供が続く" if model.get("retirementNotSoonerThan") else f"{retire}に提供終了予定"
    state = {"active": "提供中", "deprecated": "非推奨", "retired": "提供終了"}.get(model.get("state"), "状態不明")
    return [f"• 使用中のAIモデル `{model['id']}` _({state}" + (f"、{retire}" if retire else "") + ")_"]


def _claude_cost(chat_rows):
    """AIチャットのClaude利用料の概算(USD)。input_tokensはキャッシュ読み書き分を含む合計"""
    usd = 0.0
    unknown = set()
    for r in chat_rows:
        model = r.get("model") or ""
        price = CLAUDE_PRICES.get(model) or next(
            (p for name, p in CLAUDE_PRICES.items() if model.startswith(name + "-")), None)
        if price is None:
            if model and _int(r, "in_tok"):
                unknown.add(model)
            continue
        p_in, p_out = price
        cr, cw = _int(r, "cr_tok"), _int(r, "cw_tok")
        plain = max(_int(r, "in_tok") - cr - cw, 0)
        usd += (plain * p_in + cr * p_in * 0.1 + cw * p_in * 1.25 + _int(r, "out_tok") * p_out) / 1_000_000
    return usd, sorted(unknown)


def _expiry_alerts(report):
    if not report:
        return []
    alerts = []
    certs = report.get("certificates")
    if isinstance(certs, dict) and certs.get("error"):
        alerts.append(f"• 証明書を確認できませんでした: `{certs['error']}`")
    for c in certs if isinstance(certs, list) else []:
        days = c.get("daysLeft")
        if c.get("status") == "error":
            alerts.append(f"• 証明書 {c.get('host')}: 確認できませんでした `{c.get('error')}`")
        elif c.get("error"):
            alerts.append(f"• 証明書 {c.get('host')}: {c.get('error')}")
        elif days is not None and days <= CERT_ALERT_DAYS:
            alerts.append(f"• 証明書 {c.get('host')}: 残り{days}日({(c.get('validTo') or '')[:10]}まで)。"
                          "ACMの自動更新が止まっていないか確認してください")

    google = report.get("google") or {}
    if google.get("status") in ("danger", "error"):
        alerts.append(f"• Google連携(Organizer): トークンを更新できません `{google.get('error')}`。"
                      "管理画面から再接続してください")

    model = report.get("model") or {}
    days = model.get("daysUntilRetirement")
    if model.get("state") in ("deprecated", "retired"):
        alerts.append(f"• AIモデル {model.get('id')}: {model['state']}(引退予定 {model.get('retirementOn')})。"
                      "後継モデルへの切り替えが必要です")
    elif days is not None and days <= MODEL_ALERT_DAYS and not model.get("retirementNotSoonerThan"):
        alerts.append(f"• AIモデル {model.get('id')}: 引退まで残り{days}日({model.get('retirementOn')})")
    return alerts


def _fetch_aws_cost(day):
    """前日(UTCの日付)のAWS費用と今月の累計。Cost Explorerの値は速報で、後から少し増えることがある"""
    try:
        ce = boto3.client("ce", region_name="us-east-1")
        d = day.date()
        daily = ce.get_cost_and_usage(
            TimePeriod={"Start": d.isoformat(), "End": (d + timedelta(days=1)).isoformat()},
            Granularity="DAILY", Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )
        services = [
            (g["Keys"][0], float(g["Metrics"]["UnblendedCost"]["Amount"]))
            for g in daily["ResultsByTime"][0]["Groups"]
        ]
        monthly = ce.get_cost_and_usage(
            TimePeriod={"Start": d.replace(day=1).isoformat(), "End": (d + timedelta(days=1)).isoformat()},
            Granularity="MONTHLY", Metrics=["UnblendedCost"],
        )
        mtd = sum(float(r["Total"]["UnblendedCost"]["Amount"]) for r in monthly["ResultsByTime"])
        return {"services": sorted(services, key=lambda s: -s[1]), "mtd": mtd}
    except Exception as e:  # 費用が取れなくても日次レポート自体は出す
        return {"error": str(e)}


def _format_cost(cost):
    head = "*:moneybag: AWS費用*"
    if "error" in cost:
        return [head, f"• 取得できませんでした `{cost['error'][:200]}`"]
    total = sum(v for _, v in cost["services"])
    lines = [head, f"• 前日 *${total:.2f}* _(速報値。後から少し増えることがある)_",
             f"• 今月の累計 *${cost['mtd']:.2f}*"]
    top = [(name, v) for name, v in cost["services"][:5] if v >= 0.01]
    if top:
        lines.append("• 前日の内訳 _(上位)_")
        lines += [f"      ◦ {AWS_SERVICE_LABELS.get(name, name)} ${v:.2f}" for name, v in top]
    return lines


def _start_insights(log_group, query, start, end):
    return _logs.start_query(
        logGroupName=log_group,
        startTime=int(start.timestamp()),
        endTime=int(end.timestamp()),
        queryString=query,
    )["queryId"]


def _wait_insights(query_id):
    deadline = time.time() + INSIGHTS_WAIT_SECONDS
    while True:
        res = _logs.get_query_results(queryId=query_id)
        if res["status"] in ("Complete", "Failed", "Cancelled", "Timeout") or time.time() >= deadline:
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

def _secret(secret_id):
    value = _secret_values.get(secret_id)
    if value is None:
        value = _secret_values[secret_id] = _secrets.get_secret_value(SecretId=secret_id)["SecretString"].strip()
    return value


def _post_to_slack(destination, text):
    """destination は USAGE / ALERT"""
    if SLACK_BOT_TOKEN_SECRET_ID:
        req = urllib.request.Request(
            "https://slack.com/api/chat.postMessage",
            data=json.dumps({
                "channel": SLACK_CHANNELS[destination],
                "text": text,
                "username": BOT_USERNAME,
                "icon_emoji": BOT_ICON_EMOJI,
                "unfurl_links": False,
                "unfurl_media": False,
            }).encode("utf-8"),
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {_secret(SLACK_BOT_TOKEN_SECRET_ID)}",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
        # 失敗してもHTTP 200で ok:false が返る。例外にしてLambdaのエラー(アラーム)として数える
        if not result.get("ok"):
            raise RuntimeError(f"Slack chat.postMessage failed: {result.get('error')}")
        return
    req = urllib.request.Request(
        _secret(WEBHOOK_SECRET_IDS[destination]),
        data=json.dumps({"text": text}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()


def _console_link(log_group):
    region = os.environ.get("AWS_REGION", "ap-northeast-1")
    group = log_group.replace("/", "$252F")
    return f"https://{region}.console.aws.amazon.com/cloudwatch/home?region={region}#logsV2:log-groups/log-group/{group}"
