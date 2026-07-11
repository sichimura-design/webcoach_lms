"""
Request DTOs for API endpoints
"""
from .profile import ProfileSettingsCreate, ProfileSettingsUpdate, WebCoachUserProfileUpdate
from .course import CourseAccessCreate, ResumeCourseUpdate
from .common import BulkUploadRequest, UpdateDBRequest, AvatarCreate, AvatarUpdate, NextCoachingGoalCreate, NextCoachingGoalUpdate, NextCoachingGoalReorderRequest, NextCoachingGoalItem, NextCoachingGoalsBulkUpsertRequest, CoachStudentMappingCreate

__all__ = [
    "ProfileSettingsCreate",
    "ProfileSettingsUpdate",
    "WebCoachUserProfileUpdate",
    "CourseAccessCreate",
    "ResumeCourseUpdate",
    "BulkUploadRequest",
    "UpdateDBRequest",
    "AvatarCreate",
    "AvatarUpdate",
    "NextCoachingGoalCreate",
    "NextCoachingGoalUpdate",
    "NextCoachingGoalReorderRequest",
    "NextCoachingGoalItem",
    "NextCoachingGoalsBulkUpsertRequest",
    "CoachStudentMappingCreate",
]
