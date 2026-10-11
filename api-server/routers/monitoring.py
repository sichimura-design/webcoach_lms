"""
運用の日次KPI(BFFの毎朝の定期処理が呼び、結果を1行JSONでログへ出す → Slack通知Lambdaが読む)

DBへは読むだけ。テーブル追加なし。
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter(prefix="/api", tags=["Monitoring"])

JST = timezone(timedelta(hours=9))


def _jst_day_range(day: date):
    """JSTのその日の0時〜翌0時をepoch秒で返す(Moodleの時刻列はepoch秒)"""
    start = datetime.combine(day, time(0), tzinfo=JST)
    return int(start.timestamp()), int((start + timedelta(days=1)).timestamp())


def _scalar(db: Session, sql: str, **params) -> int:
    return int(db.execute(text(sql), params).scalar() or 0)


@router.get("/monitoring/daily-kpi", summary="前日(JST)の運用KPI")
def get_daily_kpi(
    day: Optional[date] = Query(None, description="集計日(JST)。省略時は前日"),
    db: Session = Depends(get_db),
):
    today = datetime.now(JST).date()
    day = day or today - timedelta(days=1)
    start, end = _jst_day_range(day)

    return {
        "date": day.isoformat(),
        # Moodleのログに何か操作が残った人数(受講生・コーチ・管理者を区別しない)
        "active_users": _scalar(
            db,
            "SELECT COUNT(DISTINCT userid) FROM mdl_logstore_standard_log"
            " WHERE timecreated >= :start AND timecreated < :end AND userid > 0",
            start=start, end=end,
        ),
        "new_users": _scalar(
            db,
            "SELECT COUNT(*) FROM mdl_user WHERE deleted = 0 AND timecreated >= :start AND timecreated < :end",
            start=start, end=end,
        ),
        "coaching_held": _scalar(
            db,
            "SELECT COUNT(*) FROM webcoach_coaching_schedule"
            " WHERE coaching_date = :day AND (status IS NULL OR status <> 'rescheduled')",
            day=day,
        ),
        # 前日までに実施日を過ぎたのに、コーチが実施結果(終了/中断/リスケ)を付けていない回(直近14日)
        "coaching_unrecorded": _scalar(
            db,
            "SELECT COUNT(*) FROM webcoach_coaching_schedule"
            " WHERE status IS NULL AND coaching_date <= :day AND coaching_date > :since",
            day=day, since=day - timedelta(days=14),
        ),
        "coaching_today": _scalar(
            db,
            "SELECT COUNT(*) FROM webcoach_coaching_schedule"
            " WHERE coaching_date = :today AND (status IS NULL OR status <> 'rescheduled')",
            today=today,
        ),
        # AIが下書きしたまま、コーチがまだ確認していないノート
        "notes_awaiting_coach": _scalar(
            db, "SELECT COUNT(*) FROM webcoach_coaching_note WHERE status = 'ai_suggested'",
        ),
    }
