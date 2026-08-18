"""
Request DTOs for API endpoints
"""
from .profile import ProfileSettingsCreate, ProfileSettingsUpdate, WebCoachUserProfileUpdate
from .course import CourseAccessCreate, ResumeCourseUpdate
from .common import BulkUploadRequest, UpdateDBRequest, AvatarCreate, AvatarUpdate, NextCoachingGoalCreate, NextCoachingGoalUpdate, NextCoachingGoalReorderRequest, NextCoachingGoalItem, NextCoachingGoalsBulkUpsertRequest, StudyNoteUpdate, CoachingScheduleCreate, CoachingScheduleUpdate, CoachStudentMappingCreate, CoachMeetingIntegrationUpsert, CoachingRecordingUpsert
from .study import StudySessionStart, StudySessionFinish

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
    "StudyNoteUpdate",
    "CoachingScheduleCreate",
    "CoachingScheduleUpdate",
    "CoachStudentMappingCreate",
    "CoachMeetingIntegrationUpsert",
    "CoachingRecordingUpsert",
    "StudySessionStart",
    "StudySessionFinish",
]
