"""
管理画面(動作設定)から変えられる設定値と、その既定値。

本番ではParameter Store(/lms/prod/api-server/config/xxx-yyy)の値が起動時に
環境変数XXX_YYYとして入る。値を変えたらコンテナの再起動で反映される。
設定の説明・上限下限はBFF(config/runtimeSettings.js)が持つ。
"""
import logging
import os

logger = logging.getLogger(__name__)

DEFAULTS = {
    "AI_CHAT_MAX_OUTPUT_TOKENS": 1024,
    "AI_CHAT_MAX_INPUT_TOKENS": 5000,
    "AI_CHAT_MAX_HISTORY_MESSAGE_CHARS": 1200,
    "AI_LEGACY_CHAT_MAX_OUTPUT_TOKENS": 2048,
    "COACHING_NOTE_MAX_OUTPUT_TOKENS": 4096,
}


def get_int(name: str) -> int:
    """環境変数の値を返す。未設定・数値でないときは既定値(数値でなければログに残す)"""
    default = DEFAULTS[name]
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        logger.error("Invalid %s=%r, using default %s", name, raw, default)
        return default


def current_values() -> dict:
    return {name: get_int(name) for name in DEFAULTS}
