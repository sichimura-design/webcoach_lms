"""
AI Application response DTOs
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class AIApplicationResponse(BaseModel):
    """AIアプリケーション情報"""
    id: int = Field(..., description="アプリケーションID")
    name: str = Field(..., description="アプリケーション名")
    category: str = Field(..., description="カテゴリ")
    description: str = Field(..., description="説明")
    url: Optional[str] = Field(None, description="アプリケーションURL")
    icon_url: Optional[str] = Field(None, description="アイコンURL")
    tags: List[str] = Field(default_factory=list, description="タグ一覧")
    created_at: datetime = Field(..., description="作成日時")
    updated_at: datetime = Field(..., description="更新日時")

    class Config:
        from_attributes = True


class AIApplicationListResponse(BaseModel):
    """AIアプリケーション一覧レスポンス"""
    total: int = Field(..., description="総件数")
    limit: int = Field(..., description="取得件数")
    offset: int = Field(..., description="オフセット")
    applications: List[AIApplicationResponse] = Field(..., description="アプリケーション一覧")

    class Config:
        from_attributes = True
