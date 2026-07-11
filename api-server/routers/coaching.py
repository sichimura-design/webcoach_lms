"""
Coach-Student Mapping endpoints
"""
from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.request import CoachStudentMappingCreate
from dto.response import CoachStudentMappingResponse, StudentListResponse, CoachResponse
from crud import (
    create_coach_student_mapping,
    get_coach_student_mapping,
    get_all_coach_student_mappings,
    get_students_by_coach,
    get_coach_by_student,
    delete_coach_student_mapping,
    restore_coach_student_mapping,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coaching", tags=["Coaching"])


# ==========================================
# Coach-Student Mapping Endpoints
# ==========================================

@router.post(
    "/mappings",
    response_model=CoachStudentMappingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="コーチと受講生のマッピング作成"
)
def create_mapping(
    request: CoachStudentMappingCreate,
    db: Session = Depends(get_db)
):
    """
    コーチと受講生のマッピングを作成します。

    Args:
        request: マッピング作成リクエスト
        db: Database session

    Returns:
        作成されたマッピング情報

    Raises:
        HTTPException: 既に有効なマッピングが存在する場合（409）
    """
    try:
        mapping = create_coach_student_mapping(
            db=db,
            coach_user_id=request.coach_user_id,
            student_user_id=request.student_user_id
        )
        return mapping
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create coach-student mapping: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create mapping"
        )


@router.get(
    "/mappings",
    response_model=List[CoachStudentMappingResponse],
    summary="全マッピング取得"
)
def get_all_mappings(
    include_deleted: bool = False,
    db: Session = Depends(get_db)
):
    """
    全てのコーチと受講生のマッピングを取得します。

    Args:
        include_deleted: 削除済みも含めるか（デフォルト: False）
        db: Database session

    Returns:
        マッピングリスト
    """
    mappings = get_all_coach_student_mappings(
        db=db,
        include_deleted=include_deleted
    )
    return mappings


@router.get(
    "/mappings/{coach_user_id}/{student_user_id}",
    response_model=CoachStudentMappingResponse,
    summary="特定のマッピング取得"
)
def get_mapping(
    coach_user_id: int,
    student_user_id: int,
    include_deleted: bool = False,
    db: Session = Depends(get_db)
):
    """
    特定のコーチと受講生のマッピングを取得します。

    Args:
        coach_user_id: コーチのMoodleユーザーID
        student_user_id: 受講生のMoodleユーザーID
        include_deleted: 削除済みも含めるか（デフォルト: False）
        db: Database session

    Returns:
        マッピング情報

    Raises:
        HTTPException: マッピングが存在しない場合（404）
    """
    mapping = get_coach_student_mapping(
        db=db,
        coach_user_id=coach_user_id,
        student_user_id=student_user_id,
        include_deleted=include_deleted
    )

    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mapping not found: coach={coach_user_id}, student={student_user_id}"
        )

    return mapping


@router.get(
    "/coaches/{coach_user_id}/students",
    response_model=StudentListResponse,
    summary="コーチの受講生一覧取得"
)
def get_coach_students(
    coach_user_id: int,
    include_deleted: bool = False,
    db: Session = Depends(get_db)
):
    """
    コーチが担当する受講生のIDリストを取得します。

    Args:
        coach_user_id: コーチのMoodleユーザーID
        include_deleted: 削除済みも含めるか（デフォルト: False）
        db: Database session

    Returns:
        受講生IDリスト
    """
    student_ids = get_students_by_coach(
        db=db,
        coach_user_id=coach_user_id,
        include_deleted=include_deleted
    )

    return StudentListResponse(
        coach_user_id=coach_user_id,
        student_user_ids=student_ids
    )


@router.get(
    "/students/{student_user_id}/coach",
    response_model=CoachResponse,
    summary="受講生のコーチ取得"
)
def get_student_coach(
    student_user_id: int,
    include_deleted: bool = False,
    db: Session = Depends(get_db)
):
    """
    受講生に割り当てられたコーチのIDを取得します。

    Args:
        student_user_id: 受講生のMoodleユーザーID
        include_deleted: 削除済みも含めるか（デフォルト: False）
        db: Database session

    Returns:
        コーチ情報（未割り当ての場合はcoach_user_id=None）
    """
    coach_user_id = get_coach_by_student(
        db=db,
        student_user_id=student_user_id,
        include_deleted=include_deleted
    )

    return CoachResponse(
        student_user_id=student_user_id,
        coach_user_id=coach_user_id
    )


@router.delete(
    "/mappings/{coach_user_id}/{student_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="マッピング削除"
)
def delete_mapping(
    coach_user_id: int,
    student_user_id: int,
    db: Session = Depends(get_db)
):
    """
    コーチと受講生のマッピングを論理削除します。

    logical_deletedが主キーに含まれるため、DELETE + INSERT方式で実装されています。

    Args:
        coach_user_id: コーチのMoodleユーザーID
        student_user_id: 受講生のMoodleユーザーID
        db: Database session

    Raises:
        HTTPException: マッピングが存在しない場合（404）
    """
    success = delete_coach_student_mapping(
        db=db,
        coach_user_id=coach_user_id,
        student_user_id=student_user_id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active mapping not found: coach={coach_user_id}, student={student_user_id}"
        )


@router.post(
    "/mappings/{coach_user_id}/{student_user_id}/restore",
    response_model=CoachStudentMappingResponse,
    status_code=status.HTTP_200_OK,
    summary="マッピング復元"
)
def restore_mapping(
    coach_user_id: int,
    student_user_id: int,
    db: Session = Depends(get_db)
):
    """
    削除されたマッピングを復元（再登録）します。

    Args:
        coach_user_id: コーチのMoodleユーザーID
        student_user_id: 受講生のMoodleユーザーID
        db: Database session

    Returns:
        復元されたマッピング情報

    Raises:
        HTTPException: 既に有効なマッピングが存在する場合（409）
    """
    try:
        mapping = restore_coach_student_mapping(
            db=db,
            coach_user_id=coach_user_id,
            student_user_id=student_user_id
        )
        return mapping
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to restore coach-student mapping: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restore mapping"
        )
