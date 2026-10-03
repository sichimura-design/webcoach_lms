"""
定期処理(議事録の取得・リマインドメール)を、複数タスクのうち1台だけで動かすための担当決め

本番はタスクが2台あり、BFFの定期処理が両方で走ると議事録の重複登録やメールの二重送信になる。
MySQLの名前付きロック(GET_LOCK)を専用の接続で持ち続け、持っているプロセスを担当とする。
担当のタスクが止まると接続が切れてロックが外れ、次の確認で残ったタスクが引き継ぐ。
テーブルは使わない。
"""
import logging
import os
import threading

import pymysql

from database import (
    MOODLE_DB_HOST,
    MOODLE_DB_NAME,
    MOODLE_DB_PASSWORD,
    MOODLE_DB_PORT,
    MOODLE_DB_USER,
)

logger = logging.getLogger(__name__)

# ロック名はDBサーバー全体で共通なので、同じRDSを使う別環境とぶつからないようDB名を入れる
LOCK_NAME = os.getenv("SCHEDULER_LOCK_NAME") or f"lms_scheduler:{MOODLE_DB_NAME}"

# 確認の間隔(最大1440分)より長くしておかないと、待ちの間にRDSが接続を切ってロックが外れる
_SESSION_WAIT_TIMEOUT_SECONDS = 2 * 24 * 60 * 60

_mutex = threading.Lock()
_conn = None


def _connect():
    conn = pymysql.connect(
        host=MOODLE_DB_HOST,
        port=int(MOODLE_DB_PORT),
        user=MOODLE_DB_USER,
        password=MOODLE_DB_PASSWORD,
        database=MOODLE_DB_NAME,
        connect_timeout=5,
        read_timeout=5,
        autocommit=True,
    )
    with conn.cursor() as cur:
        cur.execute("SET SESSION wait_timeout = %s", (_SESSION_WAIT_TIMEOUT_SECONDS,))
    return conn


def _close():
    global _conn
    if _conn is not None:
        try:
            _conn.close()
        except Exception:
            pass
    _conn = None


def _try_hold(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT IS_USED_LOCK(%s) = CONNECTION_ID()", (LOCK_NAME,))
        if cur.fetchone()[0] == 1:
            return True
        cur.execute("SELECT GET_LOCK(%s, 0)", (LOCK_NAME,))
        return cur.fetchone()[0] == 1


def is_leader() -> bool:
    """このプロセスが定期処理の担当ならTrue。DBにつながらないときは担当しない。"""
    global _conn
    with _mutex:
        # 前回の接続が切れていたら、つなぎ直して1回だけやり直す
        for attempt in range(2):
            try:
                if _conn is None:
                    _conn = _connect()
                return _try_hold(_conn)
            except pymysql.err.Error as exc:
                _close()
                if attempt == 1:
                    logger.warning("[SchedulerLock] DBにつながらないため定期処理を担当しません: %s", exc)
        return False
