"""
Study activity (集中ブース) related response DTOs

mdl_logstore_standard_log(study_session_started/ended/correctedイベント)を正データとして
集計した結果を返す。自前テーブルは持たないため、DB行idの概念は無い。
"""
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel


class StudySessionResponse(BaseModel):
    """完了した学習セッション(区間)1件。started/endedイベントのペアリング結果"""
    courseid: Optional[int] = None
    started_at: datetime
    ended_at: datetime
    duration_minutes: int


class ActiveStudySessionResponse(BaseModel):
    """進行中の学習セッション(対応するendedイベントがまだ無いstartedイベント)"""
    courseid: Optional[int] = None
    started_at: datetime


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


class StudyRankingEntryResponse(BaseModel):
    """ランキング1件"""
    rank: int
    userid: int
    total_minutes: int


class StudyRankingResponse(BaseModel):
    """期間別ランキング"""
    period: str
    entries: List[StudyRankingEntryResponse]


class CourseAccessSummaryResponse(BaseModel):
    """コース単位のアクセス集計1件(course_module_viewed系イベントの集計)"""
    courseid: int
    access_count: int
    last_accessed: datetime


class CourseAccessResponse(BaseModel):
    """ユーザーのコース別アクセス集計一覧"""
    userid: int
    courses: List[CourseAccessSummaryResponse]


class CourseMaterialAccessSummaryResponse(BaseModel):
    """教材(コースモジュール)単位のアクセス集計1件"""
    cmid: int
    access_count: int
    last_accessed: datetime


class CourseMaterialAccessResponse(BaseModel):
    """指定コース内の教材別アクセス集計一覧"""
    userid: int
    courseid: int
    materials: List[CourseMaterialAccessSummaryResponse]
