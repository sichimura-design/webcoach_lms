"""
User profile related entity models
"""
from sqlalchemy import Column, BigInteger, Integer, String, Text, JSON, Index
from database import Base


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
