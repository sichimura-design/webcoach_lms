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
    CoachStudentMappingResponse,
    StudentListResponse,
    CoachResponse,
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
    # Coaching
    "CoachStudentMappingResponse",
    "StudentListResponse",
    "CoachResponse",
]
