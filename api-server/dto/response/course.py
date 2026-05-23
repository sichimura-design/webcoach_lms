"""
Course related response DTOs
"""
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class CourseAccessResponse(BaseModel):
    """コースアクセス記録レスポンス"""
    id: int
    userid: int
    courseid: int
    lastaccess: int
    accesscount: int
    timemodified: int
    timecreated: int

    model_config = ConfigDict(from_attributes=True)


class LastAccessedCourse(BaseModel):
    """最終アクセスコース（コース情報付き）"""
    id: int
    userid: int
    courseid: int
    lastaccess: int
    accesscount: int
    course_fullname: Optional[str] = None
    course_shortname: Optional[str] = None
    course_summary: Optional[str] = None
    image_url: Optional[str] = None  # コース画像URL


class ResumeCourseResponse(BaseModel):
    """再開可能なコース"""
    courseid: int
    fullname: str
    shortname: str
    summary: Optional[str] = None
    lastaccess: int
    progress: Optional[float] = Field(default=0.0, description="進捗率 (0.0-100.0)")
    current_section: Optional[int] = Field(default=0, description="現在のセクション番号")
    accesscount: int
