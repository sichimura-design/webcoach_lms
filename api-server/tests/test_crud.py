"""
Unit tests for CRUD operations
"""
import pytest
from sqlalchemy import text

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
        result = upsert_webcoach_user_profile(db=test_db, record=sample_user_profile)

        assert result is not None
        assert result.mdl_user_id == sample_user_profile["mdl_user_id"]
        assert result.self_intro == sample_user_profile["self_intro"]
        assert result.target_job == sample_user_profile["target_job"]

    def test_get_user_profile(self, test_db, sample_user_profile):
        """Test retrieving a user profile"""
        upsert_webcoach_user_profile(
            db=test_db,
            record={"mdl_user_id": sample_user_profile["mdl_user_id"], "self_intro": sample_user_profile["self_intro"]},
        )

        result = get_webcoach_user_profile(db=test_db, mdl_user_id=sample_user_profile["mdl_user_id"])

        assert result is not None
        assert result.mdl_user_id == sample_user_profile["mdl_user_id"]

    def test_update_user_profile(self, test_db, sample_user_profile):
        """Test updating an existing user profile"""
        user_id = sample_user_profile["mdl_user_id"]
        upsert_webcoach_user_profile(
            db=test_db, record={"mdl_user_id": user_id, "self_intro": "初期の自己紹介", "target_job": "エンジニア"}
        )

        updated = upsert_webcoach_user_profile(
            db=test_db, record={"mdl_user_id": user_id, "self_intro": "更新された自己紹介"}
        )

        assert updated.self_intro == "更新された自己紹介"
        # 渡さなかった項目はそのまま残る
        assert updated.target_job == "エンジニア"

    def test_get_nonexistent_profile(self, test_db):
        """Test retrieving a profile that doesn't exist"""
        result = get_webcoach_user_profile(db=test_db, mdl_user_id=9999)
        assert result is None


class TestCourseAccess:
    """Test course access tracking (1ユーザー1行で、最後に開いたコースを持つ)"""

    def test_create_course_access(self, test_db):
        """Test creating a course access record"""
        result = upsert_webcoach_user_course_lastaccess(
            db=test_db, record={"mdl_user_id": 1, "courseid": 10, "progress_percent": 20}
        )

        assert result is not None
        assert result.mdl_user_id == 1
        assert result.courseid == 10
        assert result.progress_percent == 20

    def test_update_course_access(self, test_db):
        """Test updating the last accessed course"""
        upsert_webcoach_user_course_lastaccess(db=test_db, record={"mdl_user_id": 1, "courseid": 10})

        updated = upsert_webcoach_user_course_lastaccess(
            db=test_db, record={"mdl_user_id": 1, "courseid": 20, "current_section": 3}
        )

        assert updated.courseid == 20
        assert updated.current_section == 3


class TestResumeCourses:
    """Test resume course functionality"""

    @pytest.fixture
    def mdl_course(self, test_db):
        # ORMのmdl_courseには、実際のMoodleにあって結合で読むsummary列が無い
        test_db.execute(text("ALTER TABLE mdl_course ADD COLUMN summary TEXT"))
        test_db.execute(text("INSERT INTO mdl_course (id, category, fullname, shortname, summary) VALUES (10, 1, 'Python入門', 'py', '')"))

    def test_get_resume_courses_empty(self, test_db, mdl_course):
        """Test getting resume courses when none exist"""
        result = get_webcoach_resume_courses(db=test_db, mdl_user_id=1, limit=5)
        assert result == []

    def test_get_resume_courses_returns_last_accessed_course(self, test_db, mdl_course):
        upsert_webcoach_user_course_lastaccess(db=test_db, record={"mdl_user_id": 1, "courseid": 10})

        result = get_webcoach_resume_courses(db=test_db, mdl_user_id=1, limit=3)

        assert len(result) == 1
        assert result[0]["courseid"] == 10
        assert result[0]["course_fullname"] == "Python入門"
