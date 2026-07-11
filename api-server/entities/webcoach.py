"""
WebCoach specific entity models
"""
from sqlalchemy import Column, BigInteger, SmallInteger, String, Text, TIMESTAMP, Index, func
from database import Base


class WebCoachUserCourseLastAccess(Base):
    """
    WebCoach: ユーザーが最後にアクセスしたコース
    """
    __tablename__ = "webcoach_user_course_lastaccess"

    mdl_user_id = Column(BigInteger, primary_key=True, nullable=False, index=True)
    courseid = Column(BigInteger, nullable=False)
    progress_percent = Column(BigInteger, nullable=False, default=0)
    create_timestamp = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    current_section = Column(BigInteger, nullable=True, default=0)

    __table_args__ = (
        Index('idx_webcoach_user_course', 'mdl_user_id', 'courseid'),
    )


class WebCoachUserProfile(Base):
    """
    WebCoach: ユーザープロフィール
    """
    __tablename__ = "webcoach_user_profile"

    mdl_user_id = Column(BigInteger, primary_key=True, nullable=False, index=True)
    nick_name = Column(String(256), nullable=True)
    self_intro = Column(Text, nullable=True)
    target_job = Column(String(256), nullable=True)
    ideal_career = Column(String(256), nullable=True)
    today_small_step = Column(String(256), nullable=True)
    goal = Column(Text, nullable=True)
    badge_count = Column(SmallInteger, nullable=True, default=0)
    avatar_id = Column(BigInteger, nullable=True, index=True)


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


class WebCoachAIApplication(Base):
    """
    WebCoach: AIアプリケーション情報
    """
    __tablename__ = "webcoach_ai_application"

    id = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False, index=True)
    name = Column(String(256), nullable=False)
    category = Column(String(256), nullable=False)
    description = Column(String(256), nullable=False)
    url = Column(String(512), nullable=True)
    icon_url = Column(String(512), nullable=True)
    tags = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('idx_category', 'category'),
        Index('idx_name', 'name'),
    )


class WebCoachImageUrl(Base):
    """
    WebCoach: コース/カテゴリ/タグの画像URL
    """
    __tablename__ = "webcoach_image_url"

    category_id = Column(BigInteger, primary_key=True, nullable=False, index=True, comment='カテゴリタイプ: 1=コース, 2=カテゴリ, 3=タグ')
    target_id = Column(BigInteger, primary_key=True, nullable=False, index=True, comment='コース/カテゴリ/タグのID')
    image_url = Column(String(512), nullable=True, comment='画像URL（後から設定可能）')
    associated_category_id = Column(BigInteger, nullable=True, comment='WebCoachカテゴリID（タグのみ使用）')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), comment='作成日時')
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), comment='更新日時')

    __table_args__ = (
        Index('idx_category_id', 'category_id'),
        Index('idx_target_id', 'target_id'),
        Index('idx_tag_category', 'category_id', 'associated_category_id'),
    )


class WebCoachAvatar(Base):
    """
    WebCoach: アバター画像URL情報
    """
    __tablename__ = "webcoach_avatar"

    avatar_id = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False, index=True, comment='アバターID')
    url = Column(String(512), nullable=False, comment='S3 URL')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), comment='作成日時')
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), comment='更新日時')

    __table_args__ = (
        Index('idx_avatar_id', 'avatar_id'),
    )


class WebCoachNextCoachingGoal(Base):
    """
    WebCoach: 次回コーチングまでの目標
    """
    __tablename__ = "webcoach_next_coaching_goal"

    mdl_user_id = Column(BigInteger, primary_key=True, nullable=False, index=True, comment='MoodleユーザーID')
    no = Column(BigInteger, primary_key=True, nullable=False, index=True, comment='項目番号')
    display_order = Column(BigInteger, nullable=False, default=0, comment='表示順序')
    is_completed = Column(SmallInteger, nullable=False, default=0, comment='完了フラグ')
    description = Column(String(256), nullable=True, comment='内容')

    __table_args__ = (
        Index('idx_webcoach_next_goal_user', 'mdl_user_id', 'no'),
    )


class WebCoachStudentCoachMapping(Base):
    """
    WebCoach: コーチと受講生のマッピング
    logical_deletedを主キーに含めることで削除後の再登録を可能にする
    """
    __tablename__ = "webcoach_student_coach_mapping"

    coach_user_id = Column(BigInteger, primary_key=True, nullable=False, index=True, comment='コーチのMoodleユーザーID')
    student_user_id = Column(BigInteger, primary_key=True, nullable=False, index=True, comment='受講生のMoodleユーザーID')
    logical_deleted = Column(SmallInteger, primary_key=True, nullable=False, default=0, comment='論理削除フラグ (0=有効, 1=削除済み)')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), comment='レコード作成時刻')
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), comment='レコード更新時刻')

    __table_args__ = (
        Index('idx_coach_active', 'coach_user_id', 'logical_deleted'),
        Index('idx_student_active', 'student_user_id', 'logical_deleted'),
        Index('idx_deleted', 'logical_deleted'),
    )
