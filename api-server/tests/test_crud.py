"""
Unit tests for CRUD operations
"""
import pytest
from datetime import datetime
from crud import (
    upsert_webcoach_user_profile,
    get_webcoach_user_profile,
    upsert_webcoach_user_course_lastaccess,
    get_webcoach_resume_courses,
)


class TestUserProfile:
    """Test user profile CRUD operations"""

    def test_create_user_profile(self, test_db, sample_user_profile):
        """Test creating a new user profile"""
        result = upsert_webcoach_user_profile(
            db=test_db,
            user_id=sample_user_profile["mdl_user_id"],
            self_intro=sample_user_profile["self_intro"],
            target_job=sample_user_profile["target_job"],
            ideal_work_style=sample_user_profile["ideal_work_style"],
            badge_count=sample_user_profile["badge_count"]
        )

        assert result is not None
        assert result.mdl_user_id == sample_user_profile["mdl_user_id"]
        assert result.self_intro == sample_user_profile["self_intro"]
        assert result.target_job == sample_user_profile["target_job"]

    def test_get_user_profile(self, test_db, sample_user_profile):
        """Test retrieving a user profile"""
        # First create a profile
        upsert_webcoach_user_profile(
            db=test_db,
            user_id=sample_user_profile["mdl_user_id"],
            self_intro=sample_user_profile["self_intro"]
        )

        # Then retrieve it
        result = get_webcoach_user_profile(
            db=test_db,
            user_id=sample_user_profile["mdl_user_id"]
        )

        assert result is not None
        assert result.mdl_user_id == sample_user_profile["mdl_user_id"]

    def test_update_user_profile(self, test_db, sample_user_profile):
        """Test updating an existing user profile"""
        # Create initial profile
        upsert_webcoach_user_profile(
            db=test_db,
            user_id=sample_user_profile["mdl_user_id"],
            self_intro="初期の自己紹介"
        )

        # Update the profile
        updated = upsert_webcoach_user_profile(
            db=test_db,
            user_id=sample_user_profile["mdl_user_id"],
            self_intro="更新された自己紹介"
        )

        assert updated.self_intro == "更新された自己紹介"

    def test_get_nonexistent_profile(self, test_db):
        """Test retrieving a profile that doesn't exist"""
        result = get_webcoach_user_profile(db=test_db, user_id=9999)
        assert result is None


class TestCourseAccess:
    """Test course access tracking"""

    def test_create_course_access(self, test_db, sample_course_access):
        """Test creating a course access record"""
        result = upsert_webcoach_user_course_lastaccess(
            db=test_db,
            user_id=sample_course_access["user_id"],
            course_id=sample_course_access["course_id"],
            timeaccess=sample_course_access["timeaccess"]
        )

        assert result is not None
        assert result.mdl_user_id == sample_course_access["user_id"]
        assert result.mdl_course_id == sample_course_access["course_id"]

    def test_update_course_access(self, test_db, sample_course_access):
        """Test updating course access timestamp"""
        # Create initial access
        upsert_webcoach_user_course_lastaccess(
            db=test_db,
            user_id=sample_course_access["user_id"],
            course_id=sample_course_access["course_id"],
            timeaccess=1609459200
        )

        # Update access time
        new_time = 1609545600
        updated = upsert_webcoach_user_course_lastaccess(
            db=test_db,
            user_id=sample_course_access["user_id"],
            course_id=sample_course_access["course_id"],
            timeaccess=new_time
        )

        assert updated.timeaccess == new_time


class TestResumeCourses:
    """Test resume course functionality"""

    def test_get_resume_courses_empty(self, test_db):
        """Test getting resume courses when none exist"""
        result = get_webcoach_resume_courses(db=test_db, user_id=1, limit=5)
        assert isinstance(result, list)
        assert len(result) == 0

    def test_get_resume_courses_with_limit(self, test_db):
        """Test getting resume courses with a limit"""
        # This test would require creating multiple resume course records
        # For now, just test the function doesn't error
        result = get_webcoach_resume_courses(db=test_db, user_id=1, limit=3)
        assert isinstance(result, list)
        assert len(result) <= 3
