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
from .roadmap import (
    RoadmapResponse,
    RoadmapListResponse,
    RoadmapSkillResponse,
    RoadmapTodoResponse,
    RoadmapPhaseResponse,
    RoadmapProgressResponse,
    UserRoadmapResponse,
    RoadmapQuestionResponse,
    RoadmapAnswerResponse,
)
from .ai_application import AIApplicationResponse, AIApplicationListResponse
from .study import (
    StudySessionResponse,
    ActiveStudySessionResponse,
    StudyStatsResponse,
    StudyStreakResponse,
    StudyCalendarDayResponse,
    StudyCalendarResponse,
    StudyRankingEntryResponse,
    StudyRankingResponse,
    CourseAccessSummaryResponse,
    CourseAccessResponse,
    CourseMaterialAccessSummaryResponse,
    CourseMaterialAccessResponse,
)
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
    CoachingRecordingResponse,
    CoachingNoteResponse,
    MyNoteFolderResponse,
    MyNoteResponse,
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
    # Roadmap (legacy mock catalog)
    "RoadmapResponse",
    "RoadmapListResponse",
    # Career Roadmap
    "RoadmapSkillResponse",
    "RoadmapTodoResponse",
    "RoadmapPhaseResponse",
    "RoadmapProgressResponse",
    "UserRoadmapResponse",
    "RoadmapQuestionResponse",
    "RoadmapAnswerResponse",
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
    "CoachingRecordingResponse",
    "CoachingNoteResponse",
    "MyNoteFolderResponse",
    "MyNoteResponse",
    # Study Activity (集中ブース)
    "StudySessionResponse",
    "ActiveStudySessionResponse",
    "StudyStatsResponse",
    "StudyStreakResponse",
    "StudyCalendarDayResponse",
    "StudyCalendarResponse",
    "StudyRankingEntryResponse",
    "StudyRankingResponse",
    "CourseAccessSummaryResponse",
    "CourseAccessResponse",
    "CourseMaterialAccessSummaryResponse",
    "CourseMaterialAccessResponse",
]
