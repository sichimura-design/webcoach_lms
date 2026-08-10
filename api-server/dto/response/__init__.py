"""
Response DTOs for API endpoints
"""
from .profile import (
    ProfileSettingsResponse,
    UserProfileResponse,
    WebCoachUserProfileResponse,
)
from .course import (
    CourseAccessResponse,
    LastAccessedCourse,
    ResumeCourseResponse,
)
from .badge import BadgeResponse, UserBadgesResponse
from .roadmap import RoadmapResponse, RoadmapListResponse
from .ai_application import AIApplicationResponse, AIApplicationListResponse
from .common import (
    HealthResponse,
    ErrorResponse,
    BulkUploadError,
    BulkUploadResponse,
    AvatarResponse,
    NextCoachingGoalResponse,
    StudyNoteResponse,
    CoachingScheduleResponse,
    CoachStudentMappingResponse,
    StudentListResponse,
    CoachResponse,
    CoachMeetingIntegrationResponse,
    CoachMeetingIntegrationStatusResponse,
    LoginStreakResponse,
)

__all__ = [
    # Profile
    "ProfileSettingsResponse",
    "UserProfileResponse",
    "WebCoachUserProfileResponse",
    # Course
    "CourseAccessResponse",
    "LastAccessedCourse",
    "ResumeCourseResponse",
    # Badge
    "BadgeResponse",
    "UserBadgesResponse",
    # Roadmap
    "RoadmapResponse",
    "RoadmapListResponse",
    # AI Application
    "AIApplicationResponse",
    "AIApplicationListResponse",
    # Common
    "HealthResponse",
    "ErrorResponse",
    "BulkUploadError",
    "BulkUploadResponse",
    "AvatarResponse",
    "NextCoachingGoalResponse",
    "StudyNoteResponse",
    "CoachingScheduleResponse",
    # Coaching
    "CoachStudentMappingResponse",
    "StudentListResponse",
    "CoachResponse",
    "CoachMeetingIntegrationResponse",
    "CoachMeetingIntegrationStatusResponse",
    "LoginStreakResponse",
]
