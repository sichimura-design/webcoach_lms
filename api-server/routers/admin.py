"""
Admin and bulk update endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.request import BulkUploadRequest
from dto.response import BulkUploadResponse, BulkUploadError
from crud import (
    upsert_webcoach_user_profile,
    upsert_webcoach_user_course_lastaccess,
)

router = APIRouter(prefix="/api", tags=["Bulk Update"])


@router.post(
    "/updatedb",
    response_model=BulkUploadResponse,
    summary="WebCoach用DB一括更新"
)
def update_database(
    request: BulkUploadRequest,
    db: Session = Depends(get_db)
):
    """
    WebCoach用のカスタムテーブルを一括更新します。

    対応しているデータタイプ:
    - users: ユーザー情報
    - categories: カテゴリ情報

    Args:
        request: アップロードデータ（data_type と records）

    Returns:
        処理結果（成功/失敗件数、エラー詳細）
    """
    errors = []
    processed_count = 0
    failed_count = 0

    try:
        for idx, record in enumerate(request.records, start=1):
            try:
                # データタイプに応じた処理
                if request.data_type == "users":
                    # ユーザープロフィール情報の処理
                    if 'user_profile' in str(record).lower() or 'self_intro' in record or 'target_job' in record:
                        # webcoach_user_profile テーブル
                        if not record.get("mdl_user_id"):
                            raise ValueError("mdl_user_id is required for user profile")
                        upsert_webcoach_user_profile(db, record)
                        processed_count += 1
                    elif 'courseid' in record or 'progress_percent' in record:
                        # webcoach_user_course_lastaccess テーブル
                        if not record.get("mdl_user_id"):
                            raise ValueError("mdl_user_id is required for user course access")
                        upsert_webcoach_user_course_lastaccess(db, record)
                        processed_count += 1
                    else:
                        raise ValueError("Unknown user data type")

                elif request.data_type == "categories":
                    # カテゴリ情報は現在未使用
                    raise ValueError("Categories data type is not yet implemented")

            except Exception as e:
                failed_count += 1
                errors.append(BulkUploadError(
                    row=idx,
                    message=str(e),
                    data=record
                ))

        # コミット
        db.commit()

        success = failed_count == 0
        message = f"処理完了: {processed_count}件成功"
        if failed_count > 0:
            message += f", {failed_count}件失敗"

        return BulkUploadResponse(
            success=success,
            recordsProcessed=processed_count,
            recordsFailed=failed_count,
            message=message,
            errors=errors if errors else None
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database update failed: {str(e)}"
        )
