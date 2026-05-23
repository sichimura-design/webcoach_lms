"""
Health check and root endpoints
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
from dto.response import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    """
    ヘルスチェックエンドポイント

    Returns:
        Health status and database connectivity
    """
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "Moodle User Tracking API",
        "database": db_status,
    }


@router.get("/")
def root():
    """API情報"""
    return {
        "name": "Moodle User Tracking API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "user_profile": "/api/users/{userid}/profile",
            "resume_courses": "/api/users/{userid}/resume-courses",
            "user_badges": "/api/users/{userid}/badges",
            "roadmaps": "/api/roadmaps",
            "roadmaps_search": "/api/roadmaps/search",
            "roadmaps_category": "/api/roadmaps/category/{category}",
            "course_access": "/api/course-access",
            "last_courses": "/api/users/{userid}/last-courses",
            "most_accessed_courses": "/api/users/{userid}/most-accessed-courses",
            "profile_settings": "/api/users/{userid}/profile-settings",
        }
    }
