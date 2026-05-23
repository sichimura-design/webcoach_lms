"""
Roadmap related response DTOs
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class RoadmapResponse(BaseModel):
    """ロードマップ情報"""
    id: int
    title: str
    description: Optional[str] = None
    category: str
    difficulty: Optional[str] = Field(default="beginner", pattern="^(beginner|intermediate|advanced)$")
    estimated_hours: Optional[int] = None
    courses: List[Dict[str, Any]] = []
    created_at: Optional[int] = None


class RoadmapListResponse(BaseModel):
    """ロードマップ一覧"""
    total: int
    roadmaps: List[RoadmapResponse]
