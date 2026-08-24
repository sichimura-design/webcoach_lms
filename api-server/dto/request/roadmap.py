"""
Roadmap related request DTOs
"""
from typing import List, Optional
from datetime import date
from pydantic import BaseModel, Field


class UserRoadmapCreate(BaseModel):
    """ロードマップ開始リクエスト"""
    skill_id: int = Field(..., description="開始するスキルのID(webcoach_roadmap_skill.id)")


class RoadmapProgressUpdate(BaseModel):
    """フェーズ進捗の更新リクエスト（コーチによる期日修正・ステータス変更）"""
    status: Optional[str] = Field(None, pattern="^(not_started|in_progress|completed|skipped)$")
    start: Optional[date] = None
    end: Optional[date] = None
    updated_by: Optional[int] = Field(None, description="編集したコーチのmdl_user_id")


class RoadmapAnswerItem(BaseModel):
    """見直し質問1問への回答"""
    question_no: int
    answer: int


class RoadmapAnswerSubmit(BaseModel):
    """見直し質問への回答をまとめて送信するリクエスト"""
    review_no: int
    answers: List[RoadmapAnswerItem] = Field(..., min_length=1)
