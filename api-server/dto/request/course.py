"""
Course related request DTOs
"""
from typing import Optional
from pydantic import BaseModel, Field


class CourseAccessCreate(BaseModel):
    """コースアクセス記録作成"""
    userid: int = Field(..., gt=0, description="Moodle User ID")
    courseid: int = Field(..., gt=0, description="Moodle Course ID")


class ResumeCourseUpdate(BaseModel):
    """コース再開情報更新"""
    courseid: int = Field(..., gt=0, description="Moodle Course ID")
    progress_percent: int = Field(..., ge=0, le=100, description="進捗率 (0-100)")
    current_section: Optional[int] = Field(default=0, ge=0, description="現在のセクション番号")
