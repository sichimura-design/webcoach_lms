"""
Badge related response DTOs
"""
from typing import Optional, List
from pydantic import BaseModel


class BadgeResponse(BaseModel):
    """バッジ情報"""
    id: int
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    date_issued: Optional[int] = None
    issuer_name: Optional[str] = None


class UserBadgesResponse(BaseModel):
    """ユーザーバッジ一覧"""
    userid: int
    total_badges: int
    badges: List[BadgeResponse]
