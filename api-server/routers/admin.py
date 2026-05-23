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
    upsert_webcoach_learning_roadmap,
    upsert_webcoach_learning_roadmap_step,
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
    - courses: コース情報
    - enrollments: 受講登録情報
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

                elif request.data_type == "courses":
                    # ロードマップ情報の処理
                    if 'roadmap' in str(record).lower() or 'name' in record:
                        # webcoach_learning_roadmap テーブル
                        if not record.get("name"):
                            raise ValueError("name is required for roadmap")
                        if not record.get("category"):
                            raise ValueError("category is required for roadmap")
                        if not record.get("required_study_time"):
                            raise ValueError("required_study_time is required for roadmap")
                        if not record.get("icon_url"):
                            raise ValueError("icon_url is required for roadmap")
                        upsert_webcoach_learning_roadmap(db, record)
                        processed_count += 1
                    else:
                        raise ValueError("Unknown course data type")

                elif request.data_type == "enrollments":
                    # ロードマップステップ情報の処理
                    if not record.get("roadmap_id"):
                        raise ValueError("roadmap_id is required for roadmap step")
                    if not record.get("step_number"):
                        raise ValueError("step_number is required for roadmap step")
                    if not record.get("mdl_course_id"):
                        raise ValueError("mdl_course_id is required for roadmap step")
                    upsert_webcoach_learning_roadmap_step(db, record)
                    processed_count += 1

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
