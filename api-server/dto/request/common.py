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


class NextCoachingGoalCreate(BaseModel):
    """次回コーチングまでの目標作成リクエスト"""
    mdl_user_id: int = Field(..., description="MoodleユーザーID")
    no: int = Field(..., description="項目番号")
    description: str = Field(..., max_length=256, description="目標内容")
    is_completed: int = Field(0, description="完了フラグ（0: 未完了, 1: 完了）")


class NextCoachingGoalUpdate(BaseModel):
    """次回コーチングまでの目標更新リクエスト"""
    description: Optional[str] = Field(None, max_length=256, description="目標内容")
    is_completed: Optional[int] = Field(None, description="完了フラグ（0: 未完了, 1: 完了）")


class NextCoachingGoalReorderRequest(BaseModel):
    """次回コーチングまでの目標並び替えリクエスト"""
    moved_item_no: int = Field(..., description="ドラッグしたアイテムの現在のno")
    target_position: int = Field(..., ge=1, description="新しい位置（1始まり）")


class NextCoachingGoalItem(BaseModel):
    """次回コーチングまでの目標アイテム"""
    no: int = Field(..., description="項目番号")
    description: Optional[str] = Field(None, max_length=256, description="目標内容")
    is_completed: int = Field(0, description="完了フラグ（0: 未完了, 1: 完了）")


class NextCoachingGoalsBulkUpsertRequest(BaseModel):
    """次回コーチングまでの目標一括更新リクエスト"""
    goals: List[NextCoachingGoalItem] = Field(..., description="目標一覧（配列の順序が表示順）")


class CoachStudentMappingCreate(BaseModel):
    """コーチと受講生のマッピング作成リクエスト"""
    coach_user_id: int = Field(..., description="コーチのMoodleユーザーID")
    student_user_id: int = Field(..., description="受講生のMoodleユーザーID")
