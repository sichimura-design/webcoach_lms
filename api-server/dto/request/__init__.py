"""
Request DTOs for API endpoints
"""
from .profile import ProfileSettingsCreate, ProfileSettingsUpdate, WebCoachUserProfileUpdate
from .course import CourseAccessCreate, ResumeCourseUpdate
from .common import BulkUploadRequest, UpdateDBRequest, AvatarCreate, AvatarUpdate, NextCoachingGoalCreate, NextCoachingGoalUpdate, NextCoachingGoalReorderRequest, NextCoachingGoalItem, NextCoachingGoalsBulkUpsertRequest, StudyNoteUpdate, CoachingScheduleCreate, CoachingScheduleUpdate, CoachStudentMappingCreate, CoachMeetingIntegrationUpsert, CoachingRecordingUpsert, CoachingNoteUpsert, CoachingNoteUpdate, TranscriptEntryItem, CoachingNoteGenerateRequest, MyNoteFolderCreate, MyNoteFolderUpdate, MyNoteCreate, MyNoteUpdate
from .roadmap import UserRoadmapCreate, RoadmapProgressUpdate, RoadmapAnswerItem, RoadmapAnswerSubmit

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
    "CoachingNoteUpsert",
    "CoachingNoteUpdate",
    "TranscriptEntryItem",
    "CoachingNoteGenerateRequest",
    "MyNoteFolderCreate",
    "MyNoteFolderUpdate",
    "MyNoteCreate",
    "MyNoteUpdate",
    "UserRoadmapCreate",
    "RoadmapProgressUpdate",
    "RoadmapAnswerItem",
    "RoadmapAnswerSubmit",
]
