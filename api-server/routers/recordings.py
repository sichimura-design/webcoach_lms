"""
Coaching recording metadata endpoints

録画の実データはS3に保存され、ここではメタデータのみを管理する。
S3への保存自体（Zoom/Google Meet APIからの取得）は別処理（Lambda等）が行い、
保存完了後にこのエンドポイントを呼び出してDBへ記録する想定。
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.request import CoachingRecordingUpsert
from dto.response import CoachingRecordingResponse
from crud import upsert_coaching_recording, get_coaching_recordings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coaching/recordings", tags=["Coaching Recordings"])


@router.put(
    "/{coaching_schedule_id}/{recording_type}",
    response_model=CoachingRecordingResponse,
    summary="コーチング録画のメタデータを保存"
)
def upsert_recording(
    coaching_schedule_id: int,
    recording_type: str,
    request: CoachingRecordingUpsert,
    db: Session = Depends(get_db)
):
    """
    コーチング録画のメタデータを保存します（既存の場合は更新）。

    Args:
        coaching_schedule_id: 対象のコーチング回（webcoach_coaching_schedule.id）
        recording_type: 録画ファイルの種別 (video, audio, transcript, chat)
        request: 録画メタデータ保存リクエスト
        db: Database session

    Returns:
        保存された録画メタデータ
    """
    try:
        recording = upsert_coaching_recording(
            db=db,
            coaching_schedule_id=coaching_schedule_id,
            recording_type=recording_type,
            source=request.source,
            s3_bucket=request.s3_bucket,
            s3_key=request.s3_key,
            external_recording_id=request.external_recording_id,
            status=request.status,
        )
        return recording
    except Exception as e:
        logger.error(f"Failed to save coaching recording: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save recording"
        )


@router.get(
    "/{coaching_schedule_id}",
    response_model=list[CoachingRecordingResponse],
    summary="コーチング回に紐づく録画一覧を取得"
)
def get_recordings(
    coaching_schedule_id: int,
    db: Session = Depends(get_db)
):
    """
    コーチング回に紐づく録画一覧を取得します。

    Args:
        coaching_schedule_id: 対象のコーチング回（webcoach_coaching_schedule.id）
        db: Database session

    Returns:
        録画メタデータ一覧
    """
    return get_coaching_recordings(db=db, coaching_schedule_id=coaching_schedule_id)
