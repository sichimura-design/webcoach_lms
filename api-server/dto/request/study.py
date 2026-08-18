"""
Study activity (集中ブース) related request DTOs
"""
from typing import Optional
from pydantic import BaseModel, Field


class StudySessionStart(BaseModel):
    """学習セッション開始リクエスト"""
    courseid: Optional[int] = Field(None, description="学習対象のMoodleコースID")
    course_title: Optional[str] = Field(None, max_length=256, description="表示用コース名")
    target_minutes: Optional[int] = Field(None, ge=1, description="開始時に選択した目標時間(分)")


class StudySessionFinish(BaseModel):
    """学習セッション終了リクエスト"""
    duration_minutes: int = Field(..., ge=0, description="最終確定学習時間(分)。ユーザーが修正した値も含む集計の正データ")
    paused_seconds: int = Field(0, ge=0, description="一時停止した合計秒数")
