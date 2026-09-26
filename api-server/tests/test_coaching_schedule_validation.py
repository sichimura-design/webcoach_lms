"""
コーチングスケジュールの日付バリデーションの確認。
- 新規作成は実施日が日本時間の今日以降のみ(編集は対象外)
- 回数(coaching_no)の前後と実施日の前後が逆転しない
"""
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import routers.coaching as coaching_router
from crud import find_coaching_order_violation
from dto.request import CoachingScheduleCreate, CoachingScheduleUpdate
from entities.webcoach import WebCoachCoachingSchedule


def _today_jst():
    return datetime.now(timezone(timedelta(hours=9))).date()


def _payload(coaching_date):
    return CoachingScheduleCreate(
        coach_user_id=201,
        coaching_date=coaching_date,
        meeting_url="https://meet.google.com/test",
        meeting_provider="google_meet",
    )


def test_past_date_is_rejected(monkeypatch):
    create = MagicMock()
    monkeypatch.setattr(coaching_router, "create_coaching_schedule", create)
    monkeypatch.setattr(coaching_router, "find_coaching_order_violation", lambda *a, **k: None)

    with pytest.raises(HTTPException) as exc:
        coaching_router.create_coaching_schedule_endpoint(
            userid=101, data=_payload(_today_jst() - timedelta(days=1)), db=MagicMock()
        )

    assert exc.value.status_code == 400
    create.assert_not_called()


@pytest.mark.parametrize("offset_days", [0, 1])
def test_today_or_later_is_accepted(monkeypatch, offset_days):
    create = MagicMock(return_value=object())
    monkeypatch.setattr(coaching_router, "create_coaching_schedule", create)
    monkeypatch.setattr(coaching_router, "find_coaching_order_violation", lambda *a, **k: None)

    coaching_router.create_coaching_schedule_endpoint(
        userid=101, data=_payload(_today_jst() + timedelta(days=offset_days)), db=MagicMock()
    )

    create.assert_called_once()


# ==========================================
# 回数の前後と実施日の前後の整合チェック
# ==========================================
STUDENT, COACH = 101, 201


def _add(db, id_, no, d, status=None, coach=COACH):
    # SQLiteのテストDBではBigInteger PKが自動採番されないので明示的にidを振る
    db.add(WebCoachCoachingSchedule(
        id=id_, mdl_user_id=STUDENT, coach_user_id=coach, coaching_no=no,
        coaching_date=d, status=status, meeting_url="https://meet.google.com/x",
    ))
    db.flush()


def test_new_schedule_before_latest_is_rejected(test_db):
    _add(test_db, 1, 1, date(2030, 1, 10))
    _add(test_db, 2, 2, date(2030, 1, 20))

    assert find_coaching_order_violation(test_db, STUDENT, COACH, date(2030, 1, 15)) is not None
    # 同日は可
    assert find_coaching_order_violation(test_db, STUDENT, COACH, date(2030, 1, 20)) is None
    assert find_coaching_order_violation(test_db, STUDENT, COACH, date(2030, 1, 25)) is None


def test_rescheduled_and_other_coach_are_ignored(test_db):
    _add(test_db, 1, 1, date(2030, 1, 10))
    _add(test_db, 2, 2, date(2030, 1, 20), status='rescheduled')
    _add(test_db, 3, 1, date(2030, 2, 1), coach=999)

    assert find_coaching_order_violation(test_db, STUDENT, COACH, date(2030, 1, 15)) is None


def test_update_must_stay_between_neighbors(test_db):
    _add(test_db, 1, 1, date(2030, 1, 10))
    _add(test_db, 2, 2, date(2030, 1, 20))
    _add(test_db, 3, 3, date(2030, 1, 30))
    test_db.commit()

    def update(d):
        return coaching_router.update_coaching_schedule_endpoint(
            userid=STUDENT, schedule_id=2, data=CoachingScheduleUpdate(coaching_date=d), db=test_db,
        )

    for bad in (date(2030, 1, 5), date(2030, 2, 5)):
        with pytest.raises(HTTPException) as exc:
            update(bad)
        assert exc.value.status_code == 400

    assert update(date(2030, 1, 25)).coaching_date == date(2030, 1, 25)


def test_status_only_update_skips_order_check(test_db):
    # 既に順序が逆転しているデータでも、日付を動かさない更新は通す
    _add(test_db, 1, 1, date(2030, 1, 20))
    _add(test_db, 2, 2, date(2030, 1, 10))
    test_db.commit()

    updated = coaching_router.update_coaching_schedule_endpoint(
        userid=STUDENT, schedule_id=2, data=CoachingScheduleUpdate(status='completed'), db=test_db,
    )
    assert updated.status == 'completed'
