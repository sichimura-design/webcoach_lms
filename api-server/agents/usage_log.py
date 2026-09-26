"""
AI利用ログ（AIチャット・AIアプリ(Dify)の利用回数/エラー/トークン/APIコストの後日集計用）

1イベント=1行のJSONを標準出力へそのまま書き出す。本番ECSではawslogsドライバ経由で
CloudWatch Logsに入り、Logs InsightsがJSONのフィールドを自動で認識するため、
`filter event = "ai_chat"` 等でそのまま集計できる（あとからDBへ流し込む前提。
リアルタイム性・完全性は求めない割り切り）。

- event=ai_chat       : /api/ai/chat 1リクエストにつき1行（routers/ai_langgraph.py）
- event=ai_app_call   : Difyアプリ呼び出し1回につき1行（agents/tools_langchain.py）

プライバシーのため、ユーザーの発言本文やAIの回答本文は出力しない（文字数のみ）。
ログ出力の失敗でAIチャット本体を止めないよう、例外はすべて握りつぶす。
"""
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

# 既存のbasicConfig(「INFO:name:message」形式)を通すとJSONの前に接頭辞が付き、
# Logs Insightsで自動パースできなくなるため、専用ロガーで素のJSONだけを出す。
_usage_logger = logging.getLogger("ai_usage")
_usage_logger.setLevel(logging.INFO)
_usage_logger.propagate = False
if not _usage_logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter("%(message)s"))
    _usage_logger.addHandler(_handler)


def log_ai_usage(event: str, **fields: Any) -> None:
    """AI利用イベントを1行JSONで出力する（値がNoneの項目は省略する）"""
    try:
        record = {
            "event": event,
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            **{k: v for k, v in fields.items() if v is not None},
        }
        _usage_logger.info(json.dumps(record, ensure_ascii=False, default=str))
    except Exception:
        pass
