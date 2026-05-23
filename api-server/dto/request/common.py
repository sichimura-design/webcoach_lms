"""
Common request DTOs
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class BulkUploadRequest(BaseModel):
    """一括アップロードリクエスト"""
    data_type: str = Field(..., pattern="^(users|courses|enrollments|categories)$", description="データタイプ")
    records: List[Dict[str, Any]] = Field(..., description="アップロードするレコード一覧")


class UpdateDBRequest(BaseModel):
    """WebCoachカスタムテーブル更新リクエスト"""
    data_type: str = Field(..., description="データタイプ (ai_applications, roadmaps, profiles, など)")
    records: List[Dict[str, Any]] = Field(..., description="更新するレコード一覧")
    table_name: Optional[str] = Field(None, description="オプション: テーブル名を明示的に指定")


class AvatarCreate(BaseModel):
    """アバター作成リクエスト"""
    url: str = Field(..., max_length=512, description="アバター画像のS3 URL")


class AvatarUpdate(BaseModel):
    """アバター更新リクエスト"""
    url: str = Field(..., max_length=512, description="アバター画像のS3 URL")
