"""
Course access related entity models
"""
from sqlalchemy import Column, BigInteger, Integer, Index
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
