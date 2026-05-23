"""
Moodle Tag entity models
"""
from sqlalchemy import Column, BigInteger, String, Text, SmallInteger
from database import Base


class MoodleTag(Base):
    """
    Moodle タグテーブル
    """
    __tablename__ = "mdl_tag"

    id = Column(BigInteger, primary_key=True, nullable=False)
    userid = Column(BigInteger, nullable=False)
    tagcollid = Column(BigInteger, nullable=False)
    name = Column(String(255), nullable=False)
    rawname = Column(String(255), nullable=False)
    isstandard = Column(SmallInteger, nullable=False, default=0)
    description = Column(Text, nullable=True)
    descriptionformat = Column(SmallInteger, nullable=False, default=0)
    flag = Column(SmallInteger, nullable=True, default=0)
    timemodified = Column(BigInteger, nullable=True)


class MoodleTagInstance(Base):
    """
    Moodle タグインスタンス（タグとアイテムの紐付け）
    """
    __tablename__ = "mdl_tag_instance"

    id = Column(BigInteger, primary_key=True, nullable=False)
    tagid = Column(BigInteger, nullable=False, index=True)
    component = Column(String(100), nullable=False)
    itemtype = Column(String(100), nullable=False)
    itemid = Column(BigInteger, nullable=False, index=True)
    contextid = Column(BigInteger, nullable=True)
    tiuserid = Column(BigInteger, nullable=False, default=0)
    ordering = Column(BigInteger, nullable=True)
    timecreated = Column(BigInteger, nullable=False, default=0)
    timemodified = Column(BigInteger, nullable=False, default=0)


class MoodleCourse(Base):
    """
    Moodle コーステーブル（カテゴリとの紐付け用）
    """
    __tablename__ = "mdl_course"

    id = Column(BigInteger, primary_key=True, nullable=False)
    category = Column(BigInteger, nullable=False, index=True)
    fullname = Column(String(254), nullable=False)
    shortname = Column(String(255), nullable=False)


class MoodleCourseCategories(Base):
    """
    Moodle コースカテゴリテーブル
    """
    __tablename__ = "mdl_course_categories"

    id = Column(BigInteger, primary_key=True, nullable=False)
    name = Column(String(255), nullable=False)
    parent = Column(BigInteger, nullable=False, default=0)
