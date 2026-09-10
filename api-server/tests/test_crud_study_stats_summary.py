"""
crud.get_study_stats_summary のユニットテスト。

mdl_logstore_standard_log / mdl_course はMoodle本体のテーブルで、このアプリのORM Base配下に
無く、SQLiteのテスト用インメモリDBには存在しない。他のstudy系関数(get_study_streak等)と同じく
このプロジェクトでは実DB前提の関数として扱われ、ここではdb.executeをモックして
Python側の集計ロジック(ストリーク判定・期間集計・日別穴埋め・コース別内訳)を検証する。
"""
from datetime import datetime, timezone, timedelta, date as date_cls
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

import crud

JST = timezone(timedelta(hours=9))


def _ts(y, m, d, h=10):
    """指定したJSTの壁時計時刻をUnix秒に変換する(crud.pyのdatetime.fromtimestamp(ts, tz=JST)と対応)"""
    return int(datetime(y, m, d, h, 0, 0, tzinfo=JST).timestamp())


def _segment(courseid, y, m, d, minutes, h=10):
    return SimpleNamespace(courseid=courseid, started_at=_ts(y, m, d, h), duration_minutes=minutes)


class _FixedDatetime(datetime):
    """crud.datetime.now(JST)だけを固定し、fromtimestamp等は実装を継承する"""
    _fixed_now = None

    @classmethod
    def now(cls, tz=None):
        return cls._fixed_now


def _run_with_fixed_now(fixed_now, segment_rows, course_title_rows=None, **kwargs):
    fixed_cls = type("_FixedDatetime", (_FixedDatetime,), {"_fixed_now": fixed_now})

    db = MagicMock()
    results = [MagicMock(fetchall=MagicMock(return_value=segment_rows))]
    if course_title_rows is not None:
        results.append(MagicMock(fetchall=MagicMock(return_value=course_title_rows)))
    db.execute.side_effect = results

    with patch("crud.datetime", fixed_cls):
        return crud.get_study_stats_summary(db, mdl_user_id=1, **kwargs)


def test_streak_continues_when_today_not_yet_studied():
    """今日まだ学習していなくても、昨日まで連続していればcurrent_streakは0にならない"""
    now = datetime(2026, 9, 10, 8, 0, 0, tzinfo=JST)  # 朝、まだ今日は学習していない
    segments = [
        _segment(None, 2026, 9, 9, 20),
        _segment(None, 2026, 9, 8, 15),
        _segment(None, 2026, 9, 5, 30),  # 3日前より前なので連続には含まれない
    ]
    result = _run_with_fixed_now(now, segments, course_title_rows=[])

    assert result["streak"]["current_days"] == 2
    assert result["streak"]["today_achieved"] is False
    assert result["streak"]["today_minutes"] == 0


def test_streak_resets_when_last_activity_is_two_or_more_days_ago():
    now = datetime(2026, 9, 10, 8, 0, 0, tzinfo=JST)
    segments = [_segment(None, 2026, 9, 7, 20)]  # 3日前が最後
    result = _run_with_fixed_now(now, segments, course_title_rows=[])

    assert result["streak"]["current_days"] == 0
    assert result["streak"]["best_days"] == 1


def test_threshold_minutes_boundary():
    """STUDY_DAY_MIN_MINUTES(10分)ちょうどは成立、9分は不成立で連続が切れる"""
    now = datetime(2026, 9, 10, 8, 0, 0, tzinfo=JST)
    segments = [
        _segment(None, 2026, 9, 9, 10),  # ちょうど10分 → 成立
        _segment(None, 2026, 9, 8, 9),   # 9分 → 不成立
    ]
    result = _run_with_fixed_now(now, segments, course_title_rows=[])

    # 9/8が不成立のため、9/9からの連続は1日のみ
    assert result["streak"]["current_days"] == 1

    daily_by_date = {d["date"]: d for d in result["daily_totals"]}
    assert daily_by_date[date_cls(2026, 9, 9)]["is_study_day"] is True
    assert daily_by_date[date_cls(2026, 9, 8)]["is_study_day"] is False


def test_daily_totals_fill_gaps_with_zero():
    now = datetime(2026, 9, 10, 8, 0, 0, tzinfo=JST)
    segments = [_segment(None, 2026, 9, 8, 12)]
    result = _run_with_fixed_now(now, segments, course_title_rows=[], days=5)

    daily = result["daily_totals"]
    assert [d["date"] for d in daily] == [
        date_cls(2026, 9, 6), date_cls(2026, 9, 7), date_cls(2026, 9, 8),
        date_cls(2026, 9, 9), date_cls(2026, 9, 10),
    ]
    by_date = {d["date"]: d for d in daily}
    assert by_date[date_cls(2026, 9, 8)]["minutes"] == 12
    assert by_date[date_cls(2026, 9, 8)]["is_study_day"] is True
    assert by_date[date_cls(2026, 9, 7)]["minutes"] == 0
    assert by_date[date_cls(2026, 9, 7)]["is_study_day"] is False


def test_by_course_resolves_titles_and_null_course_is_unspecified():
    now = datetime(2026, 9, 10, 8, 0, 0, tzinfo=JST)
    segments = [
        _segment(101, 2026, 9, 9, 20),
        _segment(101, 2026, 9, 8, 10),
        _segment(None, 2026, 9, 8, 5),
    ]
    course_titles = [SimpleNamespace(id=101, fullname="Pythonコース")]
    result = _run_with_fixed_now(now, segments, course_title_rows=course_titles)

    by_course = {c["course_id"]: c for c in result["by_course"]}
    assert by_course[101]["course_title"] == "Pythonコース"
    assert by_course[101]["minutes"] == 30
    assert by_course[101]["session_count"] == 2
    assert by_course[None]["course_title"] == "教材を指定しない"
    assert by_course[None]["minutes"] == 5
    # minutes降順
    assert result["by_course"][0]["course_id"] == 101


def test_period_totals_respect_week_and_month_boundaries():
    # 2026-09-10は木曜。週の開始(月曜)は2026-09-07
    now = datetime(2026, 9, 10, 20, 0, 0, tzinfo=JST)
    segments = [
        _segment(None, 2026, 9, 10, 15),  # today / this week / this month
        _segment(None, 2026, 9, 7, 25),   # this week (月曜) / this month
        _segment(None, 2026, 9, 1, 40),   # this month(先週ではない、9/7週より前)
        _segment(None, 2026, 8, 31, 50),  # last week(8/31-9/6) / 先月(8月)
    ]
    result = _run_with_fixed_now(now, segments, course_title_rows=[])

    assert result["today"]["minutes"] == 15
    assert result["week"]["minutes"] == 40  # 9/10 + 9/7
    assert result["month"]["minutes"] == 80  # 9/10 + 9/7 + 9/1(9月ぶんのみ)
    assert result["all_time"]["minutes"] == 130
    assert result["last_week"]["minutes"] == 90  # 8/31週(8/31-9/6)は8/31分+9/1分
    assert result["first_study_date"] == date_cls(2026, 8, 31)
