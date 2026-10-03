"""
AI Coaching Note endpoints

AI生成した下書きの保存（PUT /draft、システム/AI処理からの呼び出し想定）と、
コーチによる編集・確定・公開（PUT）、参照（GET）を提供する。
"""
import json
import logging
import threading
from typing import List, Set
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from dto.request import CoachingNoteUpsert, CoachingNoteUpdate, CoachingNoteGenerateRequest
from dto.response import CoachingNoteResponse, CoachingNoteGenerateAcceptedResponse, PendingNoteGenerationResponse
from crud import (
    upsert_ai_coaching_note_draft,
    get_coaching_note,
    update_coaching_note,
    get_coaching_schedule_by_id,
    sync_next_coaching_goals_from_note,
    get_schedules_pending_note_generation,
)
from coaching_note_generator import generate_coaching_note_draft

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coaching/notes", tags=["Coaching Notes"])


def _split_next_actions(text: str) -> list:
    """
    client_next_actions（1行1アクションを想定した複数行テキスト）を
    次回目標リスト用の文字列配列に分割する。

    AI生成（coaching_note_generator.py）は改行区切りで返す設計にしているが、
    コーチが自由記述で追記した分やレガシーな一段落テキストにも耐えるよう、
    改行が無ければ句点(。)区切りにフォールバックする。
    """
    if not text:
        return []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) > 1:
        return lines
    # 改行が無い一段落テキスト（フォールバック）
    return [s.strip() for s in text.replace('。', '。\n').splitlines() if s.strip()]


# 生成中のコーチング回（プロセス内のみ）。同じ回の生成依頼が重なっても二重に生成しない。
# api-serverが再起動すると消えるが、そのときは生成も止まっているので、定期同期処理の作り直しに任せてよい。
_generating_schedule_ids: Set[int] = set()
_generating_lock = threading.Lock()


def _generate_and_save_note(coaching_schedule_id: int, entries: List[dict]) -> None:
    """ノートを生成して保存する（バックグラウンドスレッドで実行）。

    失敗してもノートは保存されないので、定期同期処理(bff-server TranscriptSyncService)が
    「議事録はあるのにノートが無い回」として拾い、回数上限まで作り直す。
    """
    db = SessionLocal()
    try:
        draft = generate_coaching_note_draft(entries)
        upsert_ai_coaching_note_draft(db=db, coaching_schedule_id=coaching_schedule_id, **draft)
        logger.info(f"Generated coaching note for schedule {coaching_schedule_id}")
    except json.JSONDecodeError:
        logger.error(f"Failed to generate coaching note for schedule {coaching_schedule_id}: AI response was not valid JSON")
    except Exception as e:
        logger.error(f"Failed to generate coaching note for schedule {coaching_schedule_id}: {e}")
    finally:
        db.close()
        with _generating_lock:
            _generating_schedule_ids.discard(coaching_schedule_id)


def _start_background(target, *args) -> None:
    threading.Thread(target=target, args=args, daemon=True).start()


@router.get(
    "/pending-generation",
    response_model=List[PendingNoteGenerationResponse],
    summary="議事録取得済みでノートがまだ無いコーチング回の一覧（定期同期処理の作り直し用）"
)
def get_pending_note_generation(db: Session = Depends(get_db)):
    """
    ノート生成に失敗した（または生成中の）回を返す。bff-serverの定期同期処理専用の内部エンドポイント。

    NOTE: GET /{coaching_schedule_id} より前に置くこと（後ろだと "pending-generation" が
    {coaching_schedule_id} にマッチしてint変換失敗の422になる）。
    """
    try:
        return get_schedules_pending_note_generation(db)
    except Exception as e:
        logger.error(f"Failed to get schedules pending note generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get schedules pending note generation"
        )


@router.post(
    "/{coaching_schedule_id}/generate",
    response_model=CoachingNoteGenerateAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="文字起こしからAIコーチングノート下書きの生成を開始（バックグラウンドで生成・保存）"
)
def generate_note(
    coaching_schedule_id: int,
    request: CoachingNoteGenerateRequest,
):
    """
    文字起こし（発言単位のリスト）からAIがコーチングノート下書きを生成し、
    status=ai_suggested として保存します。AIの出力は自動確定されません。

    生成は数十秒かかり、呼び出し元(bff-server)の待ち時間を超えることがあるため、
    受け付けたらすぐ202を返してバックグラウンドで生成する。結果はノートの有無で分かる
    （GET /{coaching_schedule_id}、失敗した回は GET /pending-generation に残る）。

    Args:
        coaching_schedule_id: 対象のコーチング回（webcoach_coaching_schedule.id）
        request: 発言単位の文字起こし一覧

    Returns:
        受付結果（started / already_running）

    Raises:
        HTTPException: 文字起こしが空の場合（400）
    """
    entries = [entry.model_dump() for entry in request.transcript_entries]
    if not entries:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="transcript_entries must not be empty")

    with _generating_lock:
        if coaching_schedule_id in _generating_schedule_ids:
            return CoachingNoteGenerateAcceptedResponse(
                coaching_schedule_id=coaching_schedule_id, status="already_running"
            )
        _generating_schedule_ids.add(coaching_schedule_id)

    try:
        _start_background(_generate_and_save_note, coaching_schedule_id, entries)
    except Exception:
        with _generating_lock:
            _generating_schedule_ids.discard(coaching_schedule_id)
        raise
    return CoachingNoteGenerateAcceptedResponse(coaching_schedule_id=coaching_schedule_id, status="started")


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

        # 「受講生に公開」された時点で、Clientの次回までのアクションを
        # 次回コーチング目標リスト（webcoach_next_coaching_goal）へ反映する。
        # ai_suggested/coach_confirmedの段階では受講生にまだ見せないため同期しない。
        if request.status == "published":
            schedule = get_coaching_schedule_by_id(db, coaching_schedule_id)
            if schedule:
                sync_next_coaching_goals_from_note(
                    db,
                    coaching_schedule_id=coaching_schedule_id,
                    mdl_user_id=schedule.mdl_user_id,
                    actions=_split_next_actions(updated.client_next_actions),
                )
                db.commit()

        return updated
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update coaching note: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update coaching note"
        )
