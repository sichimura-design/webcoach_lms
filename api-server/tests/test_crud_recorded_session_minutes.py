"""
crud.get_recorded_session_minutes のユニットテスト。

mdl_logstore_standard_log はSQLiteのテスト用DBに無いため、他のstudy系テストと同じく
db.executeをモックし、窓の計算とPython側の集計を検証する。
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import crud


def _db_returning(rows):
    db = MagicMock()
    db.execute.return_value.fetchall.return_value = rows
    return db


def test_sums_segments_and_reports_last_segment():
    # 7分20秒×2 → 区間ごとに丸めて7+7。画面の「全体を丸めた15分」ではなく14分が返ること
    db = _db_returning([
        SimpleNamespace(ended_log_id=101, duration_minutes=7, courseid=None),
        SimpleNamespace(ended_log_id=105, duration_minutes=7, courseid=12),
    ])
    with patch.object(crud.time, "time", return_value=1_000_000):
        result = crud.get_recorded_session_minutes(db, 42, since_seconds=900)

    assert result == {
        "recorded_minutes": 14,
        "last_segment_minutes": 7,
        "segment_count": 2,
        "segments": [
            {"ended_log_id": 101, "duration_minutes": 7, "courseid": None},
            {"ended_log_id": 105, "duration_minutes": 7, "courseid": 12},
        ],
    }
    params = db.execute.call_args.args[1]
    assert params["userid"] == 42
    assert params["since"] == 1_000_000 - 900 - crud._SESSION_WINDOW_SLACK_SECONDS


def test_no_segments_in_window():
    db = _db_returning([])
    result = crud.get_recorded_session_minutes(db, 42, since_seconds=60)
    assert result == {"recorded_minutes": 0, "last_segment_minutes": 0, "segment_count": 0, "segments": []}


def test_negative_since_seconds_is_clamped():
    db = _db_returning([])
    with patch.object(crud.time, "time", return_value=1_000_000):
        crud.get_recorded_session_minutes(db, 42, since_seconds=-5)
    assert db.execute.call_args.args[1]["since"] == 1_000_000 - crud._SESSION_WINDOW_SLACK_SECONDS


def test_cte_prefers_explicit_ended_log_id():
    # 名指しされた区間への補正を、直前の区間より優先する(前の区間まで減らせるように)
    sql = crud._segment_totals_cte(user_scoped=True)
    assert "'$.endedlogid'" in sql
    assert "COALESCE(NULLIF(" in sql


def test_cte_applies_latest_course_override():
    # 終了カードで選び直した教材(補正イベントのcourseid列)で、区間の教材を置き換える
    sql = crud._segment_totals_cte(user_scoped=True)
    assert "course_overrides" in sql
    assert "ORDER BY id DESC" in sql
    assert "COALESCE(co.courseid, s.courseid) AS courseid" in sql
