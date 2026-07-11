"""
Common response DTOs
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class HealthResponse(BaseModel):
    """ヘルスチェックレスポンス"""
    status: str
    timestamp: str
    service: str
    database: str


class ErrorResponse(BaseModel):
    """エラーレスポンス"""
    error: str
    detail: Optional[str] = None


class BulkUploadError(BaseModel):
    """一括アップロードエラー"""
    row: int = Field(..., description="エラーが発生した行番号")
    message: str = Field(..., description="エラーメッセージ")
    data: Optional[Dict[str, Any]] = Field(default=None, description="エラーが発生したデータ")


class BulkUploadResponse(BaseModel):
    """一括アップロードレスポンス"""
    success: bool
    records_processed: int = Field(..., alias="recordsProcessed")
    records_failed: int = Field(..., alias="recordsFailed")
    message: Optional[str] = None
    errors: Optional[List[BulkUploadError]] = None

    model_config = ConfigDict(populate_by_name=True)


class AvatarResponse(BaseModel):
    """アバターレスポンス"""
    avatar_id: int
    url: str
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class NextCoachingGoalResponse(BaseModel):
    """次回コーチングまでの目標レスポンス"""
    mdl_user_id: int
    no: int
    display_order: int
    description: Optional[str] = None
    is_completed: int

    model_config = ConfigDict(from_attributes=True)


class CoachStudentMappingResponse(BaseModel):
    """コーチと受講生のマッピングレスポンス"""
    coach_user_id: int
    student_user_id: int
    logical_deleted: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentListResponse(BaseModel):
    """受講生一覧レスポンス"""
    coach_user_id: int
    student_user_ids: List[int] = Field(..., description="担当受講生のユーザーIDリスト")


class CoachResponse(BaseModel):
    """コーチ情報レスポンス"""
    student_user_id: int
    coach_user_id: Optional[int] = Field(None, description="コーチのユーザーID（未割り当ての場合None）")
