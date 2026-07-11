"""
SQLAlchemy ORM models for Moodle custom tables
"""
from sqlalchemy import Column, BigInteger, Integer, SmallInteger, String, Text, JSON, TIMESTAMP, Index, ForeignKey
from database import Base


class UserLastCourseAccess(Base):
    """
    ユーザー最終アクセスコース（既存テーブル - 互換性維持）
    """
    __tablename__ = "mdl_user_last_course_access"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    userid = Column(BigInteger, nullable=False, index=True)
    courseid = Column(BigInteger, nullable=False, index=True)
    lastaccess = Column(BigInteger, nullable=False, index=True)
    accesscount = Column(Integer, default=1)
    timemodified = Column(BigInteger, nullable=False)
    timecreated = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index('userid_courseid', 'userid', 'courseid', unique=True),
        Index('idx_user_lastaccess', 'userid', 'lastaccess'),
        Index('idx_user_accesscount', 'userid', 'accesscount'),
    )


class UserProfileSettings(Base):
    """
    ユーザープロフィール設定（既存テーブル - 互換性維持）
    """
    __tablename__ = "mdl_user_profile_settings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    userid = Column(BigInteger, nullable=False, unique=True, index=True)
    theme = Column(String(20), default='light')
    language = Column(String(10), default='ja')
    notifications_enabled = Column(Integer, default=1)  # TINYINT(1) as Integer
    email_notifications = Column(Integer, default=1)
    timezone = Column(String(50), default='Asia/Tokyo')
    items_per_page = Column(Integer, default=20)
    avatar_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    preferences = Column(JSON, nullable=True)
    timemodified = Column(BigInteger, nullable=False)
    timecreated = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index('theme', 'theme'),
        Index('language', 'language'),
    )


# ==========================================
# WebCoach専用テーブル
# ==========================================

class WebCoachUserCourseLastAccess(Base):
    """
    WebCoach: ユーザーが最後にアクセスしたコース
    """
    __tablename__ = "webcoach_user_course_lastaccess"

    mdl_user_id = Column(BigInteger, primary_key=True, nullable=False, index=True)
    courseid = Column(BigInteger, nullable=False)
    progress_percent = Column(BigInteger, nullable=False, default=0)
    create_timestamp = Column(TIMESTAMP, nullable=False)

    __table_args__ = (
        Index('idx_webcoach_user_course', 'mdl_user_id', 'courseid'),
    )


class WebCoachUserProfile(Base):
    """
    WebCoach: ユーザープロフィール
    """
    __tablename__ = "webcoach_user_profile"

    mdl_user_id = Column(BigInteger, primary_key=True, nullable=False, index=True)
    self_intro = Column(Text, nullable=True)
    target_job = Column(String(256), nullable=True)
    ideal_work_style = Column(String(256), nullable=True)
    badge_count = Column(SmallInteger, nullable=True, default=0)


class WebCoachLearningRoadmap(Base):
    """
    WebCoach: ロードマップ定義
    """
    __tablename__ = "webcoach_learning_roadmap"

    roadmap_id = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False, index=True)
    name = Column(String(256), nullable=False)
    category = Column(String(256), nullable=False)
    required_study_time = Column(BigInteger, nullable=False)
    icon_url = Column(String(1024), nullable=False)

    __table_args__ = (
        Index('idx_webcoach_roadmap_category', 'category'),
    )


class WebCoachLearningRoadmapStep(Base):
    """
    WebCoach: ロードマップステップ（各ロードマップに紐づくコース）
    """
    __tablename__ = "webcoach_learning_roadmap_step"

    roadmap_id = Column(BigInteger, primary_key=True, nullable=False, index=True)
    step_number = Column(BigInteger, primary_key=True, nullable=False, index=True)
    mdl_course_id = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index('idx_webcoach_roadmap_step', 'roadmap_id', 'step_number'),
        Index('idx_webcoach_step_course', 'mdl_course_id'),
    )
