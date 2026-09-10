"""
Study activity (集中ブース) related response DTOs

mdl_logstore_standard_log(study_session_started/ended/correctedイベント)を正データとして
集計した結果を返す。自前テーブルは持たないため、DB行idの概念は無い。
"""
from typing import Optional, List, Any
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


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


# ------------------------------------------------------------------
# GET /api/study/stats-summary/{userid}
#
# frontend/src/types/studyActivity.ts の StudyStatsSummary(dev/miyabe由来、camelCase契約)を
# そのまま満たす。api-server内の他のレスポンスと違いフィールド名をcamelCaseで返すのは、
# この契約がフロントの広い範囲(マイページ・/study-log)から既に camelCase 前提で
# 参照されているため。populate_by_name=True にしてあるので、crud.py 側は
# 他の関数と同じsnake_caseキーの辞書を返せばよい(alias側は自動で使われる)。
# ------------------------------------------------------------------

class StudyPeriodTotalResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    minutes: int
    session_count: int = Field(alias="sessionCount")
    longest_minutes: int = Field(alias="longestMinutes")


class StudyStreakSummaryResponse(BaseModel):
    """StudyStreakResponse(/api/study/streak)とは別物。定義の違いはcrud.get_study_stats_summary参照"""
    model_config = ConfigDict(populate_by_name=True)
    current_days: int = Field(alias="currentDays")
    best_days: int = Field(alias="bestDays")
    month_study_days: int = Field(alias="monthStudyDays")
    today_achieved: bool = Field(alias="todayAchieved")
    today_minutes: int = Field(alias="todayMinutes")
    threshold_minutes: int = Field(alias="thresholdMinutes")


class StudyDayTotalResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    date: date
    minutes: int
    session_count: int = Field(alias="sessionCount")
    longest_minutes: int = Field(alias="longestMinutes")
    is_study_day: bool = Field(alias="isStudyDay")


class StudyMonthTotalResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    month: str
    minutes: int
    session_count: int = Field(alias="sessionCount")
    study_days: int = Field(alias="studyDays")


class StudyCourseTotalResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    course_id: Optional[int] = Field(default=None, alias="courseId")
    course_title: str = Field(alias="courseTitle")
    minutes: int
    session_count: int = Field(alias="sessionCount")
    last_studied_at: datetime = Field(alias="lastStudiedAt")


class StudyStatsSummaryResponse(BaseModel):
    """
    今日/今週/先週/今月/累計の学習時間・ストリーク・日別/月別・コース別内訳のまとめ。
    byCategory・recentはまだ実データの取得元が無いため常に空配列を返す
    (実装範囲はmemory: project_dev-miyabe-ai-app-gap.md参照。UI側はunavailable相当の
    縮退表示を既に持っているため、空配列を渡せば「内訳なし」として自然に縮退する)。
    """
    model_config = ConfigDict(populate_by_name=True)
    today: StudyPeriodTotalResponse
    week: StudyPeriodTotalResponse
    last_week: StudyPeriodTotalResponse = Field(alias="lastWeek")
    month: StudyPeriodTotalResponse
    all_time: StudyPeriodTotalResponse = Field(alias="allTime")
    streak: StudyStreakSummaryResponse
    daily_totals: List[StudyDayTotalResponse] = Field(alias="dailyTotals")
    by_course: List[StudyCourseTotalResponse] = Field(alias="byCourse")
    by_category: List[Any] = Field(default_factory=list, alias="byCategory")
    recent: List[Any] = Field(default_factory=list)
    first_study_date: Optional[date] = Field(default=None, alias="firstStudyDate")
    monthly_totals: List[StudyMonthTotalResponse] = Field(alias="monthlyTotals")
    generated_at: datetime = Field(alias="generatedAt")
