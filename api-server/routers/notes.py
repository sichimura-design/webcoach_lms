"""
AI Coaching Note endpoints

AI生成した下書きの保存（PUT /draft、システム/AI処理からの呼び出し想定）と、
コーチによる編集・確定・公開（PUT）、参照（GET）を提供する。
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.request import CoachingNoteUpsert, CoachingNoteUpdate, CoachingNoteGenerateRequest
from dto.response import CoachingNoteResponse
from crud import upsert_ai_coaching_note_draft, get_coaching_note, update_coaching_note
from coaching_note_generator import generate_coaching_note_draft

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coaching/notes", tags=["Coaching Notes"])


@router.post(
    "/{coaching_schedule_id}/generate",
    response_model=CoachingNoteResponse,
    summary="文字起こしからAIコーチングノート下書きを生成・保存"
)
def generate_note(
    coaching_schedule_id: int,
    request: CoachingNoteGenerateRequest,
    db: Session = Depends(get_db)
):
    """
    文字起こし（発言単位のリスト）からAIがコーチングノート下書きを生成し、
    status=ai_suggested として保存します。AIの出力は自動確定されません。

    Args:
        coaching_schedule_id: 対象のコーチング回（webcoach_coaching_schedule.id）
        request: 発言単位の文字起こし一覧
        db: Database session

    Returns:
        保存されたコーチングノート下書き

    Raises:
        HTTPException: ANTHROPIC_API_KEY未設定など生成に失敗した場合（500）
    """
    try:
        entries = [entry.model_dump() for entry in request.transcript_entries]
        draft = generate_coaching_note_draft(entries)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI response was not valid JSON"
        )
    except Exception as e:
        logger.error(f"Failed to generate coaching note: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate coaching note"
        )

    try:
        note = upsert_ai_coaching_note_draft(
            db=db,
            coaching_schedule_id=coaching_schedule_id,
            **draft,
        )
        return note
    except Exception as e:
        logger.error(f"Failed to save generated coaching note: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save generated coaching note"
        )


@router.put(
    "/{coaching_schedule_id}/draft",
    response_model=CoachingNoteResponse,
    summary="AIコーチングノート下書きを保存"
)
def upsert_note_draft(
    coaching_schedule_id: int,
    request: CoachingNoteUpsert,
    db: Session = Depends(get_db)
):
    """
    AIが生成したコーチングノートの下書きを保存します（既存の場合は内容のみ上書き、statusは変更しません）。

    Args:
        coaching_schedule_id: 対象のコーチング回（webcoach_coaching_schedule.id）
        request: AI生成した8項目
        db: Database session

    Returns:
        保存されたコーチングノート
    """
    try:
        note = upsert_ai_coaching_note_draft(
            db=db,
            coaching_schedule_id=coaching_schedule_id,
            session_summary=request.session_summary,
            client_status_and_goal=request.client_status_and_goal,
            main_issues=request.main_issues,
            coach_feedback=request.coach_feedback,
            decisions=request.decisions,
            client_next_actions=request.client_next_actions,
            coach_follow_up=request.coach_follow_up,
            next_session_check=request.next_session_check,
        )
        return note
    except Exception as e:
        logger.error(f"Failed to save coaching note draft: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save coaching note draft"
        )


@router.get(
    "/{coaching_schedule_id}",
    response_model=CoachingNoteResponse,
    summary="コーチングノートを取得"
)
def get_note(
    coaching_schedule_id: int,
    db: Session = Depends(get_db)
):
    """
    コーチング回に紐づくコーチングノートを取得します。

    Args:
        coaching_schedule_id: 対象のコーチング回（webcoach_coaching_schedule.id）
        db: Database session

    Returns:
        コーチングノート

    Raises:
        HTTPException: ノートが存在しない場合（404）
    """
    note = get_coaching_note(db=db, coaching_schedule_id=coaching_schedule_id)

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Coaching note not found: coaching_schedule_id={coaching_schedule_id}"
        )

    return note


@router.put(
    "/{coaching_schedule_id}",
    response_model=CoachingNoteResponse,
    summary="コーチングノートを編集・確定・公開"
)
def update_note(
    coaching_schedule_id: int,
    request: CoachingNoteUpdate,
    db: Session = Depends(get_db)
):
    """
    コーチによるコーチングノートの編集・確定（coach_confirmed）・公開（published）を保存します。

    Args:
        coaching_schedule_id: 対象のコーチング回（webcoach_coaching_schedule.id）
        request: 更新内容
        db: Database session

    Returns:
        更新後のコーチングノート

    Raises:
        HTTPException: ノートが存在しない場合（404）
    """
    note = get_coaching_note(db=db, coaching_schedule_id=coaching_schedule_id)

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Coaching note not found: coaching_schedule_id={coaching_schedule_id}"
        )

    try:
        updated = update_coaching_note(
            db=db,
            note_id=note.id,
            status=request.status,
            session_summary=request.session_summary,
            client_status_and_goal=request.client_status_and_goal,
            main_issues=request.main_issues,
            coach_feedback=request.coach_feedback,
            decisions=request.decisions,
            client_next_actions=request.client_next_actions,
            coach_follow_up=request.coach_follow_up,
            next_session_check=request.next_session_check,
        )
        return updated
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update coaching note: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update coaching note"
        )
