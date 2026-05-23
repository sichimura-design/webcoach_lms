"""
Common response DTOs
"""
from typing import Optional, List, Dict, Any
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
