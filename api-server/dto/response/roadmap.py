"""
Roadmap related response DTOs
"""
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict


class RoadmapResponse(BaseModel):
    """ロードマップ情報（レガシー: /api/roadmaps 系のモックカタログ用）"""
    id: int
    title: str
    description: Optional[str] = None
    category: str
    difficulty: Optional[str] = Field(default="beginner", pattern="^(beginner|intermediate|advanced)$")
    estimated_hours: Optional[int] = None
    courses: List[Dict[str, Any]] = []
    created_at: Optional[int] = None


class RoadmapListResponse(BaseModel):
    """ロードマップ一覧（レガシー: /api/roadmaps 系のモックカタログ用）"""
    total: int
    roadmaps: List[RoadmapResponse]


# ==========================================
# Career Roadmap (フェーズ制・スキル別テンプレートの学習ロードマップ)
# ==========================================

class RoadmapSkillResponse(BaseModel):
    """スキル種別マスタ"""
    id: int
    code: str
    name: str
    goal_label: str
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class RoadmapTodoResponse(BaseModel):
    """フェーズで取り組むテーマ"""
    todo_no: int
    description: str

    model_config = ConfigDict(from_attributes=True)


class RoadmapPhaseResponse(BaseModel):
    """フェーズ・テンプレート"""
    id: int
    skill_id: int
    phase_no: int
    name: str
    goal: str
    milestone: Optional[str] = None
    duration_days: Optional[int] = None
    todos: List[RoadmapTodoResponse] = []

    model_config = ConfigDict(from_attributes=True)


class RoadmapProgressResponse(BaseModel):
    """ユーザーのフェーズ進捗（フェーズ・テンプレートを埋め込んで返す）"""
    id: int
    phase_id: int
    status: str
    start: Optional[date] = None
    end: Optional[date] = None
    updated_by: Optional[int] = None
    phase: RoadmapPhaseResponse

    model_config = ConfigDict(from_attributes=True)


class UserRoadmapResponse(BaseModel):
    """ユーザーのロードマップ（画面表示用の集約データ）"""
    id: int
    mdl_user_id: int
    is_completed: bool
    skill: RoadmapSkillResponse
    target_date: Optional[date] = Field(None, description="最終フェーズの終了日(期日)を目標期限として扱う")
    phases: List[RoadmapProgressResponse]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoadmapQuestionResponse(BaseModel):
    """見直し用の固定質問"""
    review_no: int
    question_no: int
    question: str

    model_config = ConfigDict(from_attributes=True)


class RoadmapAnswerResponse(BaseModel):
    """見直し質問への回答"""
    mdl_user_id: int
    review_no: int
    question_no: int
    answer: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
