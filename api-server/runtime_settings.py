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
    "ANTHROPIC_MODEL": "claude-haiku-4-5-20251001",
    "DB_POOL_SIZE": 10,
    "ENABLE_DOCS": True,
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


def get_str(name: str) -> str:
    """環境変数の値を返す。未設定・空のときは既定値"""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return DEFAULTS[name]
    return raw.strip()


def get_bool(name: str) -> bool:
    """"true"(大文字小文字は問わない)だけを有効とみなす。未設定・空のときは既定値"""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return DEFAULTS[name]
    return raw.strip().lower() == "true"


def current_values() -> dict:
    getters = {bool: get_bool, str: get_str, int: get_int}
    return {name: getters[type(default)](name) for name, default in DEFAULTS.items()}
