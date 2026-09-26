"""
コーチングスケジュール新規作成で過去日を弾くことの確認。
実施日は日本時間の今日以降のみ登録できる(編集は対象外)。
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import routers.coaching as coaching_router
from dto.request import CoachingScheduleCreate


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

    coaching_router.create_coaching_schedule_endpoint(
        userid=101, data=_payload(_today_jst() + timedelta(days=offset_days)), db=MagicMock()
    )

    create.assert_called_once()
