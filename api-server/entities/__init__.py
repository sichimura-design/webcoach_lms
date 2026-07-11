"""
Database entity models (SQLAlchemy ORM)
"""
from .profile import UserProfileSettings
from .course import UserLastCourseAccess
from .webcoach import (
    WebCoachUserCourseLastAccess,
    WebCoachUserProfile,
    WebCoachLearningRoadmap,
    WebCoachLearningRoadmapStep,
    WebCoachImageUrl,  # Legacy - 後方互換性のため残す
    WebCoachAvatar,
    WebCoachStudentCoachMapping,
)
from .webcoach_normalized import (
    WebCoachImage,
)
from .tag import (
    MoodleTag,
    MoodleTagInstance,
    MoodleCourse,
    MoodleCourseCategories,
)

__all__ = [
    "UserProfileSettings",
    "UserLastCourseAccess",
    "WebCoachUserCourseLastAccess",
    "WebCoachUserProfile",
    "WebCoachLearningRoadmap",
    "WebCoachLearningRoadmapStep",
    "WebCoachImageUrl",  # Legacy
    "WebCoachImage",
    "WebCoachAvatar",
    "WebCoachStudentCoachMapping",
    "MoodleTag",
    "MoodleTagInstance",
    "MoodleCourse",
    "MoodleCourseCategories",
]
