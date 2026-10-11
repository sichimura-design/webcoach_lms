"""運用の日次KPI(GET /api/monitoring/daily-kpi)のテスト"""
from datetime import date

from sqlalchemy import text

from routers.monitoring import _jst_day_range


def _setup_moodle_tables(db):
    # Moodle本体のテーブルはエンティティが無いので最小限の列だけ作る
    db.execute(text("CREATE TABLE mdl_logstore_standard_log (id INTEGER PRIMARY KEY, userid INTEGER, timecreated INTEGER)"))
    db.execute(text("CREATE TABLE mdl_user (id INTEGER PRIMARY KEY, deleted INTEGER, timecreated INTEGER)"))


def _add_schedule(db, sid, day, status=None):
    db.execute(text(
        "INSERT INTO webcoach_coaching_schedule"
        " (id, mdl_user_id, coach_user_id, coaching_no, coaching_date, status, meeting_url, created_at, updated_at)"
        " VALUES (:id, 1, 2, :id, :day, :status, 'x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ), {"id": sid, "day": day, "status": status})


def test_daily_kpi_counts(client, test_db):
    _setup_moodle_tables(test_db)
    day = date(2026, 10, 10)
    start, end = _jst_day_range(day)

    for i, (uid, ts) in enumerate([(5, start), (5, start + 10), (6, end - 1), (7, end), (0, start), (8, start - 1)]):
        test_db.execute(text("INSERT INTO mdl_logstore_standard_log VALUES (:i, :u, :t)"), {"i": i, "u": uid, "t": ts})
    test_db.execute(text("INSERT INTO mdl_user VALUES (1, 0, :t), (2, 1, :t), (3, 0, :old)"), {"t": start + 5, "old": start - 5})

    _add_schedule(test_db, 1, "2026-10-10", "completed")
    _add_schedule(test_db, 2, "2026-10-10", None)
    _add_schedule(test_db, 3, "2026-10-10", "rescheduled")
    _add_schedule(test_db, 4, "2026-10-01", None)
    _add_schedule(test_db, 5, "2026-09-01", None)  # 14日より前は未記録に数えない
    _add_schedule(test_db, 6, "2026-10-12", None)  # 未来
    test_db.execute(text(
        "INSERT INTO webcoach_coaching_note (id, coaching_schedule_id, status, created_at, updated_at)"
        " VALUES (1, 1, 'ai_suggested', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),"
        " (2, 2, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ))
    test_db.commit()

    res = client.get("/api/monitoring/daily-kpi", params={"day": "2026-10-10"})
    assert res.status_code == 200
    body = res.json()
    assert body["date"] == "2026-10-10"
    assert body["active_users"] == 2  # 5と6(7は翌日、0は除外、8は前日)
    assert body["new_users"] == 1
    assert body["coaching_held"] == 2  # リスケ回は除く
    assert body["coaching_unrecorded"] == 2  # id2とid4
    assert body["notes_awaiting_coach"] == 1
    assert "coaching_today" in body


def test_jst_day_range_is_jst_midnight():
    start, end = _jst_day_range(date(2026, 10, 10))
    assert end - start == 86400
    # 2026-10-10 00:00 JST = 2026-10-09 15:00 UTC
    assert start % 86400 == 15 * 3600
