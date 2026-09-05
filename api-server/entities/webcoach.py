"""
WebCoach specific entity models
"""
from sqlalchemy import Column, BigInteger, SmallInteger, String, Text, TIMESTAMP, Date, Index, func
from database import Base


class WebCoachUserCourseLastAccess(Base):
    """
    WebCoach: ユーザーが最後にアクセスしたコース
    """
    __tablename__ = "webcoach_user_course_lastaccess"

    mdl_user_id = Column(BigInteger, primary_key=True, nullable=False, index=True)
    courseid = Column(BigInteger, nullable=False)
    progress_percent = Column(BigInteger, nullable=False, default=0)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    current_section = Column(BigInteger, nullable=True, default=0)
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

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
    secret_key = Column(String(256), nullable=True, comment='外部AI連携用の認証情報キー名（Secrets Manager JSON内のキー、Dify等）')
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


class WebCoachCoachMeetingIntegration(Base):
    """
    WebCoach: コーチのZoom/Google Meet連携情報（OAuthトークン）
    トークンはbff-server側で暗号化済みの文字列として保存される
    """
    __tablename__ = "webcoach_coach_meeting_integration"

    coach_user_id = Column(BigInteger, primary_key=True, nullable=False, index=True, comment='コーチのMoodleユーザーID')
    provider = Column(String(32), primary_key=True, nullable=False, comment='連携先 (zoom, google)')
    access_token_enc = Column(Text, nullable=False, comment='暗号化済みアクセストークン')
    refresh_token_enc = Column(Text, nullable=False, comment='暗号化済みリフレッシュトークン')
    token_expires_at = Column(TIMESTAMP, nullable=False, comment='アクセストークン有効期限')
    scope = Column(String(512), nullable=True, comment='付与されたスコープ')
    provider_account_email = Column(String(256), nullable=True, comment='連携先アカウントのメールアドレス（表示用）')
    connected_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), comment='初回連携日時')
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), comment='更新日時')

    __table_args__ = (
        Index('idx_coach_meeting_integration_coach', 'coach_user_id'),
    )


class WebCoachStudyNote(Base):
    """
    WebCoach: 教材ごとの学習メモ（1ユーザー1教材につき1件）
    """
    __tablename__ = "webcoach_study_note"

    mdl_user_id = Column(BigInteger, primary_key=True, nullable=False, comment='MoodleユーザーID')
    courseid = Column(BigInteger, primary_key=True, nullable=False, comment='MoodleコースID')
    cmid = Column(BigInteger, primary_key=True, nullable=False, comment='Moodleコースモジュール(教材)ID')
    content = Column(Text, nullable=False, comment='メモの内容')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('idx_study_note_course', 'courseid'),
    )


class WebCoachCoachingRecording(Base):
    """
    WebCoach: コーチング録画ファイルのメタデータ管理（実データはS3）
    """
    __tablename__ = "webcoach_coaching_recording"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    coaching_schedule_id = Column(BigInteger, nullable=False, comment='対象のコーチング回（webcoach_coaching_schedule.id）')
    recording_type = Column(String(32), nullable=False, comment='録画ファイルの種別 (video, audio, transcript, chat)')
    source = Column(String(32), nullable=False, comment='取得元サービス (zoom, google_meet)')
    external_recording_id = Column(String(255), nullable=True, comment='取得元サービス側の録画ID（重複取得防止用）')
    s3_bucket = Column(String(255), nullable=False, comment='保存先S3バケット名')
    s3_key = Column(String(1024), nullable=False, comment='保存先S3オブジェクトキー')
    status = Column(String(32), nullable=False, default='pending', comment='取得処理の状態 (pending, downloading, completed, failed)')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('idx_recording_schedule', 'coaching_schedule_id'),
    )


class WebCoachCoachingSchedule(Base):
    """
    WebCoach: コーチングスケジュール・実施記録
    """
    __tablename__ = "webcoach_coaching_schedule"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mdl_user_id = Column(BigInteger, nullable=False, comment='受講生のMoodleユーザーID')
    coach_user_id = Column(BigInteger, nullable=False, comment='コーチのMoodleユーザーID')
    coaching_no = Column(BigInteger, nullable=False, comment='コーチング回数（表示用連番。student-coachペア内で採番）')
    coaching_date = Column(Date, nullable=False, comment='実施日')
    status = Column(String(32), nullable=True, comment='コーチング実施結果 (completed=終了, interrupted=中断, rescheduled=リスケ)')
    meeting_url = Column(String(1024), nullable=False)
    coaching_summary = Column(Text, nullable=True, comment='コーチング内容の要約')
    todo = Column(Text, nullable=True, comment='次回までのTODO')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('uq_coaching_schedule_pair_no', 'mdl_user_id', 'coach_user_id', 'coaching_no', unique=True),
        Index('idx_coaching_schedule_coach_date', 'coach_user_id', 'coaching_date'),
    )


class WebCoachCoachingNote(Base):
    """
    WebCoach: AIコーチングノート（下書き→コーチ確認→公開）
    """
    __tablename__ = "webcoach_coaching_note"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    coaching_schedule_id = Column(BigInteger, nullable=False, comment='対象のコーチング回（webcoach_coaching_schedule.id）')
    status = Column(String(32), nullable=False, default='ai_suggested', comment='ノートの確認状態 (ai_suggested, coach_confirmed, published)')
    session_summary = Column(Text, nullable=True, comment='セッション概要')
    client_status_and_goal = Column(Text, nullable=True, comment='Clientの現状と目標')
    main_issues = Column(Text, nullable=True, comment='主な課題')
    coach_feedback = Column(Text, nullable=True, comment='Coachからのフィードバック')
    decisions = Column(Text, nullable=True, comment='今回決めたこと')
    client_next_actions = Column(Text, nullable=True, comment='Clientの次回までのアクション')
    coach_follow_up = Column(Text, nullable=True, comment='Coach側のフォロー事項')
    next_session_check = Column(Text, nullable=True, comment='次回確認すること')
    published_at = Column(TIMESTAMP, nullable=True, comment='受講生に公開された日時')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('uq_coaching_note_schedule', 'coaching_schedule_id', unique=True),
    )


class WebCoachRoadmapSkill(Base):
    """
    WebCoach: ロードマップのスキル種別マスタ
    """
    __tablename__ = "webcoach_roadmap_skill"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    code = Column(String(64), nullable=False, comment='システム内部識別子。例: web_design')
    name = Column(String(128), nullable=False, comment='表示名。例: Webデザイナー')
    goal_label = Column(String(256), nullable=False, comment='画面表示用の最終ゴール文言')
    display_order = Column(SmallInteger, nullable=False, default=0)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('uq_roadmap_skill_code', 'code', unique=True),
    )


class WebCoachRoadmapPhase(Base):
    """
    WebCoach: スキル別ロードマップのフェーズ・テンプレート
    """
    __tablename__ = "webcoach_roadmap_phase"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    skill_id = Column(BigInteger, nullable=False, comment='スキルの種類(webデザイナー/動画編集など)')
    phase_no = Column(SmallInteger, nullable=False, comment='phase no')
    name = Column(String(128), nullable=False, comment='phase名')
    goal = Column(Text, nullable=False, comment='このフェーズの目的')
    milestone = Column(Text, nullable=True, comment='完了の目安となるマイルストーン')
    duration_days = Column(SmallInteger, nullable=True, comment='想定期間(日数)。フェーズ開始時にendを自動算出する用途')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('uq_roadmap_phase_skill_no', 'skill_id', 'phase_no', unique=True),
    )


class WebCoachRoadmapTodo(Base):
    """
    WebCoach: フェーズで取り組むテーマのテンプレート
    """
    __tablename__ = "webcoach_roadmap_todo"

    phase_id = Column(BigInteger, primary_key=True, nullable=False, comment='対象フェーズ(webcoach_roadmap_phase.id)')
    todo_no = Column(SmallInteger, primary_key=True, nullable=False, comment='フェーズ内の表示順')
    description = Column(String(256), nullable=False, comment='取り組むテーマ。例: バナー制作')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())


class WebCoachUserRoadmap(Base):
    """
    WebCoach: ユーザーが選択したロードマップ（掛け持ち非対応、同時アクティブは1件のみ）
    """
    __tablename__ = "webcoach_user_roadmap"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mdl_user_id = Column(BigInteger, nullable=False, index=True, comment='userid')
    skill_id = Column(BigInteger, nullable=False, comment='スキルの種類(webデザイナー/動画編集など)')
    is_completed = Column(SmallInteger, nullable=False, default=0, comment='完了か')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    # active_markerは「未完了ロードマップは1ユーザー同時1件まで」をDBのUNIQUE制約で強制するための
    # 生成列（DDL側のみで定義。アプリからは参照・更新しないためここではマッピングしない）


class WebCoachRoadmapProgress(Base):
    """
    WebCoach: ユーザーのフェーズ進捗
    """
    __tablename__ = "webcoach_roadmap_progress"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_roadmap_id = Column(BigInteger, nullable=False, comment='対象ロードマップ(webcoach_user_roadmap.id)')
    phase_id = Column(BigInteger, nullable=False, comment='対象フェーズ(webcoach_roadmap_phase.id)')
    status = Column(String(32), nullable=False, default='not_started', comment='not_started, in_progress, completed, skipped')
    start = Column(Date, nullable=True, comment='開始日')
    end = Column(Date, nullable=True, comment='終了日（期日）。コーチが直接編集可')
    updated_by = Column(BigInteger, nullable=True, comment='期日を最後に編集したコーチのmdl_user_id')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('uq_roadmap_progress_phase', 'user_roadmap_id', 'phase_id', unique=True),
        Index('idx_roadmap_progress_status', 'user_roadmap_id', 'status'),
    )


class WebCoachRoadmapQuestion(Base):
    """
    WebCoach: 見直し用の固定質問（全ユーザー・全スキル共通）
    """
    __tablename__ = "webcoach_roadmap_question"

    review_no = Column(SmallInteger, primary_key=True, nullable=False, comment='n回目の質問か')
    question_no = Column(SmallInteger, primary_key=True, nullable=False, comment='質問番号')
    question = Column(Text, nullable=False, comment='質問')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())


class WebCoachRoadmapAnswer(Base):
    """
    WebCoach: 見直し質問への回答
    """
    __tablename__ = "webcoach_roadmap_answer"

    mdl_user_id = Column(BigInteger, primary_key=True, nullable=False, comment='userid')
    review_no = Column(SmallInteger, primary_key=True, nullable=False, comment='n回目の質問か')
    question_no = Column(SmallInteger, primary_key=True, nullable=False, comment='質問番号')
    answer = Column(SmallInteger, nullable=False, comment='解答の選択肢')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), comment='回答日時')


class WebCoachMyNoteFolder(Base):
    """
    WebCoach: マイノートのフォルダ（入れ子対応）
    """
    __tablename__ = "webcoach_my_note_folder"

    folder_id = Column(BigInteger, primary_key=True, autoincrement=True)
    mdl_user_id = Column(BigInteger, nullable=False, comment='MoodleユーザーID')
    name = Column(String(255), nullable=False, comment='フォルダ名')
    parent_folder_id = Column(BigInteger, nullable=True, comment='親フォルダ（NULLはルート直下）')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('idx_my_note_folder_user', 'mdl_user_id'),
        Index('idx_my_note_folder_parent', 'parent_folder_id'),
    )


class WebCoachMyNote(Base):
    """
    WebCoach: マイノート本体（教材に紐づかない自由記述のノート。本文はMarkdown）
    """
    __tablename__ = "webcoach_my_note"

    noteid = Column(BigInteger, primary_key=True, autoincrement=True)
    mdl_user_id = Column(BigInteger, nullable=False, comment='MoodleユーザーID')
    folder_id = Column(BigInteger, nullable=True, comment='所属フォルダ（NULLはルート直下）')
    courseid = Column(BigInteger, nullable=True, comment='関連コース（任意）')
    cmid = Column(BigInteger, nullable=True, comment='関連レッスン（Moodleコースモジュール(教材)ID）。教材画面からの逆引き用')
    favorite = Column(SmallInteger, nullable=False, default=0, comment='重要ラベル')
    from_ai = Column(SmallInteger, nullable=False, default=0, comment='AIコーチの回答から作られたか')
    from_coaching = Column(SmallInteger, nullable=False, default=0, comment='コーチングから作られたか')
    title = Column(String(255), nullable=False, comment='タイトル')
    contents = Column(Text, nullable=False, comment='Markdown形式の本文')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        Index('idx_my_note_user', 'mdl_user_id'),
        Index('idx_my_note_folder', 'folder_id'),
        Index('idx_my_note_course', 'courseid'),
        Index('idx_my_note_cmid', 'cmid'),
    )
