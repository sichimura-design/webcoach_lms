"""
Study activity (集中ブース) endpoints

学習時間・ストリーク・カレンダー・ランキング・コースアクセス集計はすべて
mdl_logstore_standard_log(Moodleログ)から算出する。自前テーブルは持たない。
開始/一時停止/再開/終了/補正の書き込みはbff-serverがMoodle webservice経由で直接行うため、
ここには書き込み系エンドポイントは無い(読み取り専用)。
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.response import (
    StudySessionResponse,
    ActiveStudySessionResponse,
    StudyStatsResponse,
    StudyStreakResponse,
    StudyCalendarResponse,
    StudyRankingResponse,
    CourseAccessResponse,
    CourseMaterialAccessResponse,
)
from crud import (
    get_active_study_session,
    get_recent_study_sessions,
    get_study_stats,
    get_study_streak,
    get_study_calendar,
    get_study_ranking,
    get_course_access_summary,
    get_course_material_access,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/study", tags=["Study Activity (Focus Booth)"])


@router.get(
    "/sessions/{userid}/active",
    response_model=ActiveStudySessionResponse,
    summary="進行中の学習セッション取得"
)
def get_active_session(userid: int, db: Session = Depends(get_db)):
    """
    進行中の学習セッションを取得します(対応するstudy_session_endedがまだ無いstudy_session_started)。
    別画面遷移・タブ再読込後もタイマー状態を復元するためにフロントが起動時に呼び出します。
    """
    session = get_active_study_session(db, userid)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active study session for user {userid}"
        )
    return session


@router.get(
    "/sessions/{userid}/recent",
    response_model=list[StudySessionResponse],
    summary="直近の学習セッション一覧取得"
)
def get_recent_sessions(userid: int, limit: int = 10, db: Session = Depends(get_db)):
    """直近に完了した学習セッション(区間)を新しい順に取得します。"""
    return get_recent_study_sessions(db, userid, limit=limit)


@router.get(
    "/stats/{userid}",
    response_model=StudyStatsResponse,
    summary="今日・今週・累計の学習時間取得"
)
def get_stats(userid: int, db: Session = Depends(get_db)):
    """今日・今週(月曜始まり、JST)・累計の学習時間(分)を集計します。"""
    return get_study_stats(db, userid)


@router.get(
    "/streak/{userid}",
    response_model=StudyStreakResponse,
    summary="学習ストリーク取得"
)
def get_streak(userid: int, db: Session = Depends(get_db)):
    """
    連続で学習セッションを完了した日数(学習ストリーク)を取得します。
    ログインストリーク(/webcoach/users/{userid}/login-streak)とは独立した別指標です。
    """
    return get_study_streak(db, userid)


@router.get(
    "/calendar/{userid}",
    response_model=StudyCalendarResponse,
    summary="学習カレンダー取得"
)
def get_calendar(userid: int, year: int, month: int, db: Session = Depends(get_db)):
    """指定年月(JSTローカル日付基準)の日別学習時間・セッション数を取得します(カレンダー表示用)。"""
    if not (1 <= month <= 12):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="month must be between 1 and 12")

    days = get_study_calendar(db, userid, year, month)
    return {"userid": userid, "year": year, "month": month, "days": days}


@router.get(
    "/ranking",
    response_model=StudyRankingResponse,
    summary="学習時間ランキング取得"
)
def get_ranking(period: str = "week", limit: int = 20, db: Session = Depends(get_db)):
    """
    学習時間ランキングを取得します。

    Args:
        period: 'week' | 'month' | 'all'
        limit: 取得件数上限(デフォルト20)
    """
    if period not in ("week", "month", "all"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="period must be one of: week, month, all")

    entries = get_study_ranking(db, period=period, limit=limit)
    return {"period": period, "entries": entries}


@router.get(
    "/course-access/{userid}",
    response_model=CourseAccessResponse,
    summary="コースごとのアクセス集計取得"
)
def get_course_access(userid: int, db: Session = Depends(get_db)):
    """
    コースごとのアクセス回数・直近アクセス日時を取得します
    (Moodle標準webservice経由のcourse_module_viewedイベントの集計)。
    """
    courses = get_course_access_summary(db, userid)
    return {"userid": userid, "courses": courses}


@router.get(
    "/course-access/{userid}/{courseid}/materials",
    response_model=CourseMaterialAccessResponse,
    summary="コース内の教材ごとのアクセス集計取得"
)
def get_course_materials_access(userid: int, courseid: int, db: Session = Depends(get_db)):
    """指定コース内で、どの教材(コースモジュール)にアクセスしたかを集計します。"""
    materials = get_course_material_access(db, userid, courseid)
    return {"userid": userid, "courseid": courseid, "materials": materials}
