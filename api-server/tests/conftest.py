"""
Pytest configuration and fixtures for API testing
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import your application components
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Patch database module to prevent MySQL connection on import
import unittest.mock
# Create test engine first
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Mock database.engine before importing
with unittest.mock.patch.dict('sys.modules', {'database': unittest.mock.MagicMock(engine=test_engine)}):
    pass

# Now import with patched database
import database
database.engine = test_engine  # Override the MySQL engine with SQLite
from database import Base, get_db
from main import app

# Test database URL - using SQLite in-memory for tests
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_engine():
    """
    Create a test database engine
    Uses SQLite in-memory for fast testing
    """
    engine = create_engine(
        SQLALCHEMY_TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_db(test_engine):
    """
    Provide a test database session
    Each test gets a fresh database
    """
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine
    )
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client(test_db):
    """
    FastAPI test client with test database
    Override the database dependency to use test database
    """
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def base_url():
    """
    Base URL for API testing
    """
    return "http://testserver"


@pytest.fixture
def sample_user_profile():
    """
    Sample user profile data for testing
    """
    return {
        "mdl_user_id": 1,
        "self_intro": "テストユーザーです",
        "target_job": "エンジニア",
        "ideal_work_style": "リモートワーク",
        "badge_count": 5
    }


@pytest.fixture
def sample_course_access():
    """
    Sample course access data for testing
    """
    return {
        "user_id": 1,
        "course_id": 1,
        "timeaccess": 1609459200
    }


@pytest.fixture
def sample_resume_course():
    """
    Sample resume course data for testing
    """
    return {
        "mdl_user_id": 1,
        "mdl_course_id": 1,
        "coursename": "Python入門",
        "progress_percent": 50,
        "last_accessed": 1609459200
    }
