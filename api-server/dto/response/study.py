"""
Study activity (集中ブース) related response DTOs
"""
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class StudySessionResponse(BaseModel):
    """学習セッション1件"""
    id: int
    mdl_user_id: int
    courseid: Optional[int] = None
    course_title: Optional[str] = None
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    local_date: date
    target_minutes: Optional[int] = None
    duration_minutes: Optional[int] = None
    measured_seconds: Optional[int] = None
    paused_seconds: int

    model_config = ConfigDict(from_attributes=True)


class StudyStatsResponse(BaseModel):
    """今日・今週・累計の学習時間(分)"""
    userid: int
    today_minutes: int
    week_minutes: int
    total_minutes: int


class StudyStreakResponse(BaseModel):
    """学習ストリーク(連続で学習セッションを完了した日数)"""
    userid: int
    current_streak: int
    last_active_date: Optional[date] = None


class StudyCalendarDayResponse(BaseModel):
    """カレンダー表示用の日別学習時間"""
    date: date
    total_minutes: int
    session_count: int


class StudyCalendarResponse(BaseModel):
    """指定年月のカレンダーデータ"""
    userid: int
    year: int
    month: int
    days: List[StudyCalendarDayResponse]
