"""
Study activity (集中ブース) endpoints

学習時間・ストリーク・カレンダー集計の正データはwebcoach_study_activityテーブル。
開始/終了イベントのMoodle側監査ログ(mdl_logstore_standard_log)への記録は
bff-server(MoodleAdapter経由)が別途担当するため、ここではDB更新のみを行う。
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.request import StudySessionStart, StudySessionFinish
from dto.response import (
    StudySessionResponse,
    StudyStatsResponse,
    StudyStreakResponse,
    StudyCalendarResponse,
)
from crud import (
    start_study_session,
    finish_study_session,
    get_active_study_session,
    get_recent_study_sessions,
    get_study_stats,
    get_study_streak,
    get_study_calendar,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/study", tags=["Study Activity (Focus Booth)"])


@router.post(
    "/sessions/{userid}",
    response_model=StudySessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="集中ブース学習セッション開始"
)
def start_session(userid: int, request: StudySessionStart, db: Session = Depends(get_db)):
    """
    学習セッションを開始し、in_progress行を1件作成します。

    Args:
        userid: 受講生のMoodleユーザーID
        request: 学習対象コース・目標時間(任意)
    """
    try:
        session = start_study_session(
            db,
            mdl_user_id=userid,
            courseid=request.courseid,
            course_title=request.course_title,
            target_minutes=request.target_minutes,
        )
        return session
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to start study session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start study session"
        )


@router.post(
    "/sessions/{userid}/{session_id}/finish",
    response_model=StudySessionResponse,
    summary="集中ブース学習セッション終了"
)
def finish_session(
    userid: int,
    session_id: int,
    request: StudySessionFinish,
    db: Session = Depends(get_db)
):
    """
    学習セッションを終了します。duration_minutesはユーザーが調整した最終値をそのまま集計に採用します。

    Args:
        userid: 受講生のMoodleユーザーID
        session_id: webcoach_study_activity.id
        request: 最終確定学習時間(分)・一時停止合計秒数
    """
    session = finish_study_session(
        db,
        session_id=session_id,
        mdl_user_id=userid,
        duration_minutes=request.duration_minutes,
        paused_seconds=request.paused_seconds,
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"In-progress study session not found: id={session_id}, userid={userid}"
        )
    return session


@router.get(
    "/sessions/{userid}/active",
    response_model=StudySessionResponse,
    summary="進行中の学習セッション取得"
)
def get_active_session(userid: int, db: Session = Depends(get_db)):
    """
    進行中(in_progress)の学習セッションを取得します。
    別画面遷移・タブ再読込後もタイマー状態を復元するためにフロントが起動時に呼び出します。

    Args:
        userid: 受講生のMoodleユーザーID
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
    """
    直近に完了した学習セッションを新しい順に取得します。

    Args:
        userid: 受講生のMoodleユーザーID
        limit: 取得件数上限(デフォルト10)
    """
    return get_recent_study_sessions(db, userid, limit=limit)


@router.get(
    "/stats/{userid}",
    response_model=StudyStatsResponse,
    summary="今日・今週・累計の学習時間取得"
)
def get_stats(userid: int, db: Session = Depends(get_db)):
    """
    今日・今週(月曜始まり、JST)・累計の学習時間(分)を集計します。

    Args:
        userid: 受講生のMoodleユーザーID
    """
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

    Args:
        userid: 受講生のMoodleユーザーID
    """
    return get_study_streak(db, userid)


@router.get(
    "/calendar/{userid}",
    response_model=StudyCalendarResponse,
    summary="学習カレンダー取得"
)
def get_calendar(userid: int, year: int, month: int, db: Session = Depends(get_db)):
    """
    指定年月(JSTローカル日付基準)の日別学習時間・セッション数を取得します(カレンダー表示用)。

    Args:
        userid: 受講生のMoodleユーザーID
        year: 対象年
        month: 対象月(1-12)
    """
    if not (1 <= month <= 12):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="month must be between 1 and 12")

    days = get_study_calendar(db, userid, year, month)
    return {"userid": userid, "year": year, "month": month, "days": days}
