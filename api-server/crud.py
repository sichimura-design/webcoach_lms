"""
CRUD operations for user course access and profile settings
"""
import time
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from entities import (
    UserLastCourseAccess,
    UserProfileSettings,
    WebCoachUserCourseLastAccess,
    WebCoachUserProfile,
    WebCoachLearningRoadmap,
    WebCoachLearningRoadmapStep,
    WebCoachImageUrl,
    WebCoachAvatar,
    WebCoachStudentCoachMapping,
)
from dto.request import (
    CourseAccessCreate,
    ProfileSettingsCreate,
    ProfileSettingsUpdate,
)
from dto.response import AIApplicationResponse
from mappers import ProfileMapper, CourseMapper


# ==========================================
# Course Access CRUD
# ==========================================

def record_course_access(db: Session, data: CourseAccessCreate) -> UserLastCourseAccess:
    """
    コースアクセスを記録（既存の場合は更新）

    Args:
        db: Database session
        data: Course access data

    Returns:
        UserLastCourseAccess: Created or updated record
    """
    current_time = int(time.time())

    # Check if record already exists
    existing = db.query(UserLastCourseAccess).filter(
        UserLastCourseAccess.userid == data.userid,
        UserLastCourseAccess.courseid == data.courseid
    ).first()

    if existing:
        # Update existing record using mapper
        CourseMapper.update_access(existing, current_time)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new record using mapper
        db_record = CourseMapper.from_create_request(data, current_time)
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        return db_record


def get_user_last_accessed_courses(
    db: Session,
    userid: int,
    limit: int = 10
) -> List[dict]:
    """
    ユーザーの最終アクセスコース一覧を取得（コース情報付き）

    Args:
        db: Database session
        userid: User ID
        limit: Maximum number of courses to return

    Returns:
        List of courses with access information
    """
    # Join with mdl_course table to get course details
    query = text("""
        SELECT
            a.id,
            a.userid,
            a.courseid,
            a.lastaccess,
            a.accesscount,
            c.fullname as course_fullname,
            c.shortname as course_shortname,
            c.summary as course_summary
        FROM mdl_user_last_course_access a
        LEFT JOIN mdl_course c ON a.courseid = c.id
        WHERE a.userid = :userid
        ORDER BY a.lastaccess DESC
        LIMIT :limit
    """)

    result = db.execute(query, {"userid": userid, "limit": limit})
    rows = result.fetchall()

    return [
        {
            "id": row[0],
            "userid": row[1],
            "courseid": row[2],
            "lastaccess": row[3],
            "accesscount": row[4],
            "course_fullname": row[5],
            "course_shortname": row[6],
            "course_summary": row[7],
        }
        for row in rows
    ]


def get_most_accessed_courses(
    db: Session,
    userid: int,
    limit: int = 5
) -> List[dict]:
    """
    ユーザーの最もアクセスの多いコース一覧を取得

    Args:
        db: Database session
        userid: User ID
        limit: Maximum number of courses to return

    Returns:
        List of courses ordered by access count
    """
    query = text("""
        SELECT
            a.id,
            a.userid,
            a.courseid,
            a.lastaccess,
            a.accesscount,
            c.fullname as course_fullname,
            c.shortname as course_shortname
        FROM mdl_user_last_course_access a
        LEFT JOIN mdl_course c ON a.courseid = c.id
        WHERE a.userid = :userid
        ORDER BY a.accesscount DESC, a.lastaccess DESC
        LIMIT :limit
    """)

    result = db.execute(query, {"userid": userid, "limit": limit})
    rows = result.fetchall()

    return [
        {
            "id": row[0],
            "userid": row[1],
            "courseid": row[2],
            "lastaccess": row[3],
            "accesscount": row[4],
            "course_fullname": row[5],
            "course_shortname": row[6],
        }
        for row in rows
    ]


# ==========================================
# Profile Settings CRUD
# ==========================================

def create_profile_settings(
    db: Session,
    data: ProfileSettingsCreate
) -> UserProfileSettings:
    """
    プロフィール設定を作成

    Args:
        db: Database session
        data: Profile settings data

    Returns:
        UserProfileSettings: Created record
    """
    current_time = int(time.time())

    # Create entity using mapper
    db_settings = ProfileMapper.from_create_request(data, current_time)

    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings


def get_profile_settings(db: Session, userid: int) -> Optional[UserProfileSettings]:
    """
    プロフィール設定を取得

    Args:
        db: Database session
        userid: User ID

    Returns:
        UserProfileSettings or None
    """
    return db.query(UserProfileSettings).filter(
        UserProfileSettings.userid == userid
    ).first()


def update_profile_settings(
    db: Session,
    userid: int,
    data: ProfileSettingsUpdate
) -> Optional[UserProfileSettings]:
    """
    プロフィール設定を更新（部分更新対応）

    Args:
        db: Database session
        userid: User ID
        data: Profile settings update data

    Returns:
        Updated UserProfileSettings or None if not found
    """
    db_settings = get_profile_settings(db, userid)

    if not db_settings:
        return None

    # Update entity using mapper
    ProfileMapper.update_from_request(db_settings, data)

    db.commit()
    db.refresh(db_settings)
    return db_settings


def get_or_create_profile_settings(
    db: Session,
    userid: int
) -> UserProfileSettings:
    """
    プロフィール設定を取得（存在しない場合はデフォルト値で作成）

    Args:
        db: Database session
        userid: User ID

    Returns:
        UserProfileSettings: Existing or newly created settings
    """
    settings = get_profile_settings(db, userid)

    if settings:
        return settings

    # Create default settings
    default_data = ProfileSettingsCreate(userid=userid)
    return create_profile_settings(db, default_data)


# ==========================================
# WebCoach CRUD Operations
# ==========================================

def upsert_webcoach_user_course_lastaccess(
    db: Session,
    record: Dict[str, Any]
) -> WebCoachUserCourseLastAccess:
    """
    WebCoach: ユーザーコース最終アクセスを登録/更新

    Args:
        db: Database session
        record: Record data

    Returns:
        WebCoachUserCourseLastAccess: Created or updated record
    """
    mdl_user_id = record.get('mdl_user_id')
    courseid = record.get('courseid')
    progress_percent = record.get('progress_percent', 0)
    current_section = record.get('current_section', 0)
    create_timestamp = record.get('create_timestamp', text('CURRENT_TIMESTAMP'))

    # Check if record exists
    existing = db.query(WebCoachUserCourseLastAccess).filter(
        WebCoachUserCourseLastAccess.mdl_user_id == mdl_user_id
    ).first()

    if existing:
        # Update existing record
        existing.courseid = courseid
        existing.progress_percent = progress_percent
        existing.current_section = current_section
        existing.create_timestamp = create_timestamp
    else:
        # Create new record
        existing = WebCoachUserCourseLastAccess(
            mdl_user_id=mdl_user_id,
            courseid=courseid,
            progress_percent=progress_percent,
            current_section=current_section,
            create_timestamp=create_timestamp
        )
        db.add(existing)

    db.flush()
    return existing


def get_webcoach_user_profile(
    db: Session,
    mdl_user_id: int
) -> Optional[WebCoachUserProfile]:
    """
    WebCoach: ユーザープロフィールを取得

    Args:
        db: Database session
        mdl_user_id: Moodle User ID

    Returns:
        WebCoachUserProfile or None
    """
    return db.query(WebCoachUserProfile).filter(
        WebCoachUserProfile.mdl_user_id == mdl_user_id
    ).first()


def upsert_webcoach_user_profile(
    db: Session,
    record: Dict[str, Any]
) -> WebCoachUserProfile:
    """
    WebCoach: ユーザープロフィールを登録/更新

    Args:
        db: Database session
        record: Record data

    Returns:
        WebCoachUserProfile: Created or updated record
    """
    mdl_user_id = record.get('mdl_user_id')
    nick_name = record.get('nick_name')
    self_intro = record.get('self_intro')
    target_job = record.get('target_job')
    ideal_career = record.get('ideal_career')
    today_small_step = record.get('today_small_step')
    goal = record.get('goal')
    badge_count = record.get('badge_count', 0)
    avatar_id = record.get('avatar_id')

    # Check if record exists
    existing = db.query(WebCoachUserProfile).filter(
        WebCoachUserProfile.mdl_user_id == mdl_user_id
    ).first()

    if existing:
        # Update existing record
        if nick_name is not None:
            existing.nick_name = nick_name
        if self_intro is not None:
            existing.self_intro = self_intro
        if target_job is not None:
            existing.target_job = target_job
        if ideal_career is not None:
            existing.ideal_career = ideal_career
        if today_small_step is not None:
            existing.today_small_step = today_small_step
        if goal is not None:
            existing.goal = goal
        if badge_count is not None:
            existing.badge_count = badge_count
        if avatar_id is not None:
            existing.avatar_id = avatar_id
    else:
        # Create new record
        existing = WebCoachUserProfile(
            mdl_user_id=mdl_user_id,
            nick_name=nick_name,
            self_intro=self_intro,
            target_job=target_job,
            ideal_career=ideal_career,
            today_small_step=today_small_step,
            goal=goal,
            badge_count=badge_count,
            avatar_id=avatar_id
        )
        db.add(existing)

    db.flush()
    return existing


def upsert_webcoach_learning_roadmap(
    db: Session,
    record: Dict[str, Any]
) -> WebCoachLearningRoadmap:
    """
    WebCoach: ロードマップを登録/更新

    Args:
        db: Database session
        record: Record data

    Returns:
        WebCoachLearningRoadmap: Created or updated record
    """
    roadmap_id = record.get('roadmap_id')
    name = record.get('name')
    category = record.get('category')
    required_study_time = record.get('required_study_time')
    icon_url = record.get('icon_url')

    if roadmap_id:
        # Update existing roadmap
        existing = db.query(WebCoachLearningRoadmap).filter(
            WebCoachLearningRoadmap.roadmap_id == roadmap_id
        ).first()

        if existing:
            existing.name = name
            existing.category = category
            existing.required_study_time = required_study_time
            existing.icon_url = icon_url
        else:
            # Create with specific ID
            existing = WebCoachLearningRoadmap(
                roadmap_id=roadmap_id,
                name=name,
                category=category,
                required_study_time=required_study_time,
                icon_url=icon_url
            )
            db.add(existing)
    else:
        # Create new roadmap (auto-increment ID)
        existing = WebCoachLearningRoadmap(
            name=name,
            category=category,
            required_study_time=required_study_time,
            icon_url=icon_url
        )
        db.add(existing)

    db.flush()
    return existing


def upsert_webcoach_learning_roadmap_step(
    db: Session,
    record: Dict[str, Any]
) -> WebCoachLearningRoadmapStep:
    """
    WebCoach: ロードマップステップを登録/更新

    Args:
        db: Database session
        record: Record data

    Returns:
        WebCoachLearningRoadmapStep: Created or updated record
    """
    roadmap_id = record.get('roadmap_id')
    step_number = record.get('step_number')
    mdl_course_id = record.get('mdl_course_id')

    # Check if record exists
    existing = db.query(WebCoachLearningRoadmapStep).filter(
        WebCoachLearningRoadmapStep.roadmap_id == roadmap_id,
        WebCoachLearningRoadmapStep.step_number == step_number
    ).first()

    if existing:
        # Update existing record
        existing.mdl_course_id = mdl_course_id
    else:
        # Create new record
        existing = WebCoachLearningRoadmapStep(
            roadmap_id=roadmap_id,
            step_number=step_number,
            mdl_course_id=mdl_course_id
        )
        db.add(existing)

    db.flush()
    return existing


def get_webcoach_resume_courses(
    db: Session,
    mdl_user_id: int,
    limit: int = 5,
    days: int = None
) -> List[dict]:
    """
    WebCoach: ユーザーの再開可能なコース一覧を取得

    Args:
        db: Database session
        mdl_user_id: Moodle User ID
        limit: Maximum number of courses to return
        days: Filter courses accessed within the last N days (optional)

    Returns:
        List of resume courses with course information
    """
    # Build WHERE clause with optional date filter
    where_clause = "WHERE w.mdl_user_id = :mdl_user_id"
    if days is not None:
        where_clause += " AND w.create_timestamp >= DATE_SUB(NOW(), INTERVAL :days DAY)"

    # Join with mdl_course table to get course details
    query = text(f"""
        SELECT
            w.mdl_user_id,
            w.courseid,
            w.progress_percent,
            w.current_section,
            w.create_timestamp,
            c.fullname as course_fullname,
            c.shortname as course_shortname,
            c.summary as course_summary
        FROM webcoach_user_course_lastaccess w
        LEFT JOIN mdl_course c ON w.courseid = c.id
        {where_clause}
        ORDER BY w.create_timestamp DESC
        LIMIT :limit
    """)

    params = {"mdl_user_id": mdl_user_id, "limit": limit}
    if days is not None:
        params["days"] = days

    result = db.execute(query, params)
    rows = result.fetchall()

    courses = []
    for row in rows:
        courses.append({
            "mdl_user_id": row[0],
            "courseid": row[1],
            "progress_percent": row[2],
            "current_section": row[3],
            "create_timestamp": row[4],
            "course_fullname": row[5],
            "course_shortname": row[6],
            "course_summary": row[7]
        })

    return courses


# ==========================================
# Moodle User Information CRUD Operations
# ==========================================

def get_moodle_user_info(
    db: Session,
    userid: int
) -> Optional[dict]:
    """
    Moodleユーザー情報を取得

    Args:
        db: Database session
        userid: User ID

    Returns:
        User info dict with firstname, lastname, etc. or None
    """
    query = text("""
        SELECT
            id,
            username,
            firstname,
            lastname,
            email
        FROM mdl_user
        WHERE id = :userid
        LIMIT 1
    """)

    result = db.execute(query, {"userid": userid})
    row = result.fetchone()

    if not row:
        return None

    return {
        "id": row[0],
        "username": row[1],
        "firstname": row[2],
        "lastname": row[3],
        "email": row[4]
    }


# ==========================================
# Badge Recommendation CRUD Operations
# ==========================================

def get_recommended_badges(
    db: Session,
    userid: int,
    limit: int = 10
) -> List[dict]:
    """
    ユーザーにおすすめのバッジを取得

    推薦ロジック:
    1. ユーザーが最後にアクセスしたコースに関連するバッジを取得
    2. ユーザーが未取得のバッジのみをフィルタリング
    3. アクティブなバッジ（status=1または3）のみを対象

    Args:
        db: Database session
        userid: User ID
        limit: Maximum number of badges to return

    Returns:
        List of recommended badges with course information
    """
    query = text("""
        SELECT DISTINCT
            b.id as badge_id,
            b.name as badge_name,
            b.description as badge_description,
            b.type as badge_type,
            b.courseid,
            c.fullname as course_fullname,
            c.shortname as course_shortname,
            b.timecreated,
            b.timemodified
        FROM mdl_badge b
        LEFT JOIN mdl_course c ON b.courseid = c.id
        WHERE b.status IN (1, 3)
          AND b.id NOT IN (
              SELECT bi.badgeid
              FROM mdl_badge_issued bi
              WHERE bi.userid = :userid
          )
          AND (
              b.courseid IN (
                  SELECT wc.courseid
                  FROM webcoach_user_course_lastaccess wc
                  WHERE wc.mdl_user_id = :userid
              )
              OR b.type = 1
          )
        ORDER BY
            CASE WHEN b.type = 2 THEN 0 ELSE 1 END,
            b.timemodified DESC
        LIMIT :limit
    """)

    result = db.execute(query, {"userid": userid, "limit": limit})
    rows = result.fetchall()

    badges = []
    for row in rows:
        badges.append({
            "badge_id": row[0],
            "badge_name": row[1],
            "badge_description": row[2],
            "badge_type": row[3],  # 1=site badge, 2=course badge
            "courseid": row[4],
            "course_fullname": row[5],
            "course_shortname": row[6],
            "timecreated": row[7],
            "timemodified": row[8]
        })

    return badges


def get_user_issued_badges(
    db: Session,
    userid: int,
    limit: int = 50
) -> List[dict]:
    """
    ユーザーが取得済みのバッジ一覧を取得

    Args:
        db: Database session
        userid: User ID
        limit: Maximum number of badges to return

    Returns:
        List of issued badges
    """
    query = text("""
        SELECT
            bi.id as issued_id,
            bi.badgeid,
            bi.userid,
            bi.dateissued,
            bi.dateexpire,
            bi.visible,
            b.name as badge_name,
            b.description as badge_description,
            b.type as badge_type,
            b.courseid,
            c.fullname as course_fullname
        FROM mdl_badge_issued bi
        JOIN mdl_badge b ON bi.badgeid = b.id
        LEFT JOIN mdl_course c ON b.courseid = c.id
        WHERE bi.userid = :userid
        ORDER BY bi.dateissued DESC
        LIMIT :limit
    """)

    result = db.execute(query, {"userid": userid, "limit": limit})
    rows = result.fetchall()

    badges = []
    for row in rows:
        badges.append({
            "issued_id": row[0],
            "badge_id": row[1],
            "userid": row[2],
            "date_issued": row[3],
            "date_expire": row[4],
            "visible": row[5],
            "badge_name": row[6],
            "badge_description": row[7],
            "badge_type": row[8],
            "courseid": row[9],
            "course_fullname": row[10]
        })

    return badges


def get_ai_applications(
    db: Session,
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
) -> List[AIApplicationResponse]:
    """
    AIアプリケーション一覧を取得

    Args:
        db: Database session
        category: カテゴリフィルタ（オプション）
        limit: 取得件数
        offset: オフセット

    Returns:
        AIアプリケーション一覧
    """
    from entities.webcoach import WebCoachAIApplication

    query = db.query(WebCoachAIApplication)

    # カテゴリフィルタ
    if category:
        query = query.filter(WebCoachAIApplication.category == category)

    # ページネーション
    query = query.order_by(WebCoachAIApplication.id)
    query = query.offset(offset).limit(limit)

    applications = query.all()

    # Pydanticモデルに変換
    result = []
    for app in applications:
        result.append(AIApplicationResponse(
            id=app.id,
            name=app.name,
            category=app.category,
            description=app.description,
            url=app.url,
            icon_url=app.icon_url,
            tags=app.tags.split(',') if app.tags else [],
            created_at=app.created_at,
            updated_at=app.updated_at
        ))

    return result


def get_ai_application_by_id(
    db: Session,
    application_id: int
) -> Optional[AIApplicationResponse]:
    """
    AIアプリケーションをIDで取得

    Args:
        db: Database session
        application_id: アプリケーションID

    Returns:
        AIアプリケーション情報
    """
    from entities.webcoach import WebCoachAIApplication

    app = db.query(WebCoachAIApplication).filter(
        WebCoachAIApplication.id == application_id
    ).first()

    if not app:
        return None

    return AIApplicationResponse(
        id=app.id,
        name=app.name,
        category=app.category,
        description=app.description,
        url=app.url,
        icon_url=app.icon_url,
        tags=app.tags.split(',') if app.tags else [],
        created_at=app.created_at,
        updated_at=app.updated_at
    )


# ==========================================
# WebCoach Image URL CRUD
# ==========================================

def get_image_url(db: Session, category_id: int, target_id: int) -> Optional[str]:
    """
    コース/カテゴリの画像URLを取得（レガシー互換）

    Args:
        db: Database session
        category_id: カテゴリタイプ (1=コース, 2=カテゴリ)
        target_id: コース/カテゴリのID

    Returns:
        画像URL (存在しない場合はNone)
    """
    from crud_normalized import get_image

    # category_id をentity_typeに変換
    entity_type_map = {1: 'course', 2: 'category'}
    entity_type = entity_type_map.get(category_id)

    if not entity_type:
        return None

    return get_image(db, entity_type, target_id)


def upsert_image_url(
    db: Session,
    category_id: int,
    target_id: int,
    image_url: Optional[str] = None,
    associated_category_id: Optional[int] = None
):
    """
    コース/カテゴリの画像URLを作成または更新（レガシー互換）

    Args:
        db: Database session
        category_id: カテゴリタイプ (1=コース, 2=カテゴリ)
        target_id: コース/カテゴリのID
        image_url: 画像URL（任意、後から設定可能）
        associated_category_id: 未使用（互換性のため残されている）

    Returns:
        作成または更新された画像URLレコード
    """
    from crud_normalized import upsert_image

    # category_id をentity_typeに変換
    entity_type_map = {1: 'course', 2: 'category'}
    entity_type = entity_type_map.get(category_id)

    if not entity_type:
        raise ValueError(f"Invalid category_id: {category_id}. Must be 1 (course) or 2 (category)")

    # 画像URLを登録（URLがある場合のみ）
    if image_url:
        upsert_image(db, entity_type, target_id, image_url)

    # レガシー互換のため、ダミーオブジェクトを返す
    class LegacyResult:
        def __init__(self):
            self.category_id = category_id
            self.target_id = target_id
            self.image_url = image_url
            self.associated_category_id = associated_category_id

    return LegacyResult()


def delete_image_url(db: Session, category_id: int, target_id: int) -> bool:
    """
    コース/カテゴリの画像URLを削除

    Args:
        db: Database session
        category_id: カテゴリタイプ (1=コース, 2=カテゴリ)
        target_id: コース/カテゴリのID

    Returns:
        削除成功時True、レコードが存在しない場合False
    """
    existing = db.query(WebCoachImageUrl).filter(
        WebCoachImageUrl.category_id == category_id,
        WebCoachImageUrl.target_id == target_id
    ).first()

    if existing:
        db.delete(existing)
        db.flush()
        return True
    return False


def get_image_urls_by_category(db: Session, category_id: int) -> List[Dict[str, Any]]:
    """
    カテゴリタイプ別に画像URL一覧を取得（正規化テーブルから取得）

    Args:
        db: Database session
        category_id: カテゴリタイプ (1=コース, 2=カテゴリ)

    Returns:
        画像URL一覧
    """
    from crud_normalized import get_images_by_type

    # category_id をentity_typeに変換
    entity_type_map = {1: 'course', 2: 'category'}
    entity_type = entity_type_map.get(category_id)

    if not entity_type:
        raise ValueError(f"Invalid category_id: {category_id}")

    # 正規化テーブルから取得
    records = get_images_by_type(db, entity_type)

    # レガシー形式に変換して返す（互換性のため）
    return [
        {
            'category_id': category_id,
            'target_id': record['entity_id'],
            'image_url': record['image_url'],
            'created_at': record['created_at'],
            'updated_at': record['updated_at']
        }
        for record in records
    ]


# ==========================================
# Tag URL Mapping CRUD
# ==========================================


# ==========================================
# Avatar CRUD
# ==========================================

def create_avatar(db: Session, url: str) -> WebCoachAvatar:
    """
    アバターを新規作成

    Args:
        db: Database session
        url: アバター画像のS3 URL

    Returns:
        WebCoachAvatar: 作成されたアバター
    """
    avatar = WebCoachAvatar(url=url)
    db.add(avatar)
    db.flush()
    return avatar


def get_avatar(db: Session, avatar_id: int) -> Optional[WebCoachAvatar]:
    """
    アバターを取得

    Args:
        db: Database session
        avatar_id: アバターID

    Returns:
        WebCoachAvatar or None
    """
    return db.query(WebCoachAvatar).filter(
        WebCoachAvatar.avatar_id == avatar_id
    ).first()


def get_all_avatars(db: Session, limit: int = 100, offset: int = 0) -> List[WebCoachAvatar]:
    """
    アバター一覧を取得

    Args:
        db: Database session
        limit: 取得件数（デフォルト: 100）
        offset: オフセット（デフォルト: 0）

    Returns:
        List[WebCoachAvatar]: アバター一覧
    """
    return db.query(WebCoachAvatar).order_by(
        desc(WebCoachAvatar.created_at)
    ).limit(limit).offset(offset).all()


def update_avatar(db: Session, avatar_id: int, url: str) -> Optional[WebCoachAvatar]:
    """
    アバターを更新

    Args:
        db: Database session
        avatar_id: アバターID
        url: 新しいアバター画像のS3 URL

    Returns:
        WebCoachAvatar or None
    """
    avatar = get_avatar(db, avatar_id)
    if avatar:
        avatar.url = url
        db.flush()
    return avatar


def delete_avatar(db: Session, avatar_id: int) -> bool:
    """
    アバターを削除

    Args:
        db: Database session
        avatar_id: アバターID

    Returns:
        bool: 削除成功時True、失敗時False
    """
    avatar = get_avatar(db, avatar_id)
    if avatar:
        db.delete(avatar)
        db.flush()
        return True
    return False


# ==========================================
# Next Coaching Goal CRUD
# ==========================================

def create_next_coaching_goal(db: Session, mdl_user_id: int, no: int, description: str, is_completed: int = 0) -> "WebCoachNextCoachingGoal":
    """
    次回コーチングまでの目標を新規作成

    Args:
        db: Database session
        mdl_user_id: MoodleユーザーID
        no: 項目番号
        description: 目標内容
        is_completed: 完了フラグ（デフォルト: 0）

    Returns:
        WebCoachNextCoachingGoal: 作成された目標
    """
    from entities.webcoach import WebCoachNextCoachingGoal
    from sqlalchemy import func

    # 既存の目標の最大display_orderを取得
    max_order = db.query(func.max(WebCoachNextCoachingGoal.display_order)).filter(
        WebCoachNextCoachingGoal.mdl_user_id == mdl_user_id
    ).scalar()

    # 新しいdisplay_orderを設定（既存がない場合は1、ある場合は+1）
    new_display_order = (max_order or 0) + 1

    goal = WebCoachNextCoachingGoal(
        mdl_user_id=mdl_user_id,
        no=no,
        display_order=new_display_order,
        description=description,
        is_completed=is_completed
    )
    db.add(goal)
    db.flush()
    return goal


def get_next_coaching_goal(db: Session, mdl_user_id: int, no: int) -> Optional["WebCoachNextCoachingGoal"]:
    """
    次回コーチングまでの目標を取得

    Args:
        db: Database session
        mdl_user_id: MoodleユーザーID
        no: 項目番号

    Returns:
        WebCoachNextCoachingGoal or None
    """
    from entities.webcoach import WebCoachNextCoachingGoal

    return db.query(WebCoachNextCoachingGoal).filter(
        WebCoachNextCoachingGoal.mdl_user_id == mdl_user_id,
        WebCoachNextCoachingGoal.no == no
    ).first()


def get_user_next_coaching_goals(db: Session, mdl_user_id: int) -> List["WebCoachNextCoachingGoal"]:
    """
    ユーザーの次回コーチングまでの目標一覧を取得

    Args:
        db: Database session
        mdl_user_id: MoodleユーザーID

    Returns:
        List[WebCoachNextCoachingGoal]: 目標一覧
    """
    from entities.webcoach import WebCoachNextCoachingGoal

    return db.query(WebCoachNextCoachingGoal).filter(
        WebCoachNextCoachingGoal.mdl_user_id == mdl_user_id
    ).order_by(WebCoachNextCoachingGoal.display_order).all()


def get_all_next_coaching_goals(db: Session) -> List["WebCoachNextCoachingGoal"]:
    """
    全ユーザーの次回コーチングまでの目標一覧を取得

    Args:
        db: Database session

    Returns:
        List[WebCoachNextCoachingGoal]: 全目標一覧
    """
    from entities.webcoach import WebCoachNextCoachingGoal

    return db.query(WebCoachNextCoachingGoal).order_by(
        WebCoachNextCoachingGoal.mdl_user_id,
        WebCoachNextCoachingGoal.display_order
    ).all()


def update_next_coaching_goal(db: Session, mdl_user_id: int, no: int, description: str = None, is_completed: int = None) -> Optional["WebCoachNextCoachingGoal"]:
    """
    次回コーチングまでの目標を更新

    Args:
        db: Database session
        mdl_user_id: MoodleユーザーID
        no: 項目番号
        description: 新しい目標内容（Noneの場合は更新しない）
        is_completed: 新しい完了フラグ（Noneの場合は更新しない）

    Returns:
        WebCoachNextCoachingGoal or None
    """
    goal = get_next_coaching_goal(db, mdl_user_id, no)
    if goal:
        if description is not None:
            goal.description = description
        if is_completed is not None:
            goal.is_completed = is_completed
        db.flush()
    return goal


def delete_next_coaching_goal(db: Session, mdl_user_id: int, no: int) -> bool:
    """
    次回コーチングまでの目標を削除

    Args:
        db: Database session
        mdl_user_id: MoodleユーザーID
        no: 項目番号

    Returns:
        bool: 削除成功時True、失敗時False
    """
    goal = get_next_coaching_goal(db, mdl_user_id, no)
    if goal:
        db.delete(goal)
        db.flush()
        return True
    return False


def reorder_next_coaching_goals(db: Session, mdl_user_id: int, moved_item_no: int, target_position: int) -> List["WebCoachNextCoachingGoal"]:
    """
    次回コーチングまでの目標を並び替え

    Args:
        db: Database session
        mdl_user_id: MoodleユーザーID
        moved_item_no: ドラッグしたアイテムの現在のno
        target_position: 新しい位置（1始まり）

    Returns:
        List[WebCoachNextCoachingGoal]: 並び替え後の目標一覧
    """
    from entities.webcoach import WebCoachNextCoachingGoal

    # ユーザーの全ての目標を取得（display_orderでソート）
    goals = db.query(WebCoachNextCoachingGoal).filter(
        WebCoachNextCoachingGoal.mdl_user_id == mdl_user_id
    ).order_by(WebCoachNextCoachingGoal.display_order).all()

    if not goals:
        return []

    # 移動対象のアイテムを見つける
    moved_goal = None
    for goal in goals:
        if goal.no == moved_item_no:
            moved_goal = goal
            break

    if not moved_goal:
        raise ValueError(f"Goal with no={moved_item_no} not found for user {mdl_user_id}")

    # リストから移動対象を削除
    goals.remove(moved_goal)

    # target_position（1始まり）をインデックス（0始まり）に変換
    target_index = target_position - 1

    # 範囲チェック
    if target_index < 0:
        target_index = 0
    elif target_index > len(goals):
        target_index = len(goals)

    # 新しい位置に挿入
    goals.insert(target_index, moved_goal)

    # display_orderを1, 2, 3...と再割り当て
    for index, goal in enumerate(goals):
        goal.display_order = index + 1

    db.flush()

    return goals


def bulk_upsert_next_coaching_goals(db: Session, mdl_user_id: int, goals_data: List[Dict[str, Any]]) -> List["WebCoachNextCoachingGoal"]:
    """
    次回コーチングまでの目標を一括更新（作成・更新・削除・並び替え）

    Args:
        db: Database session
        mdl_user_id: MoodleユーザーID
        goals_data: 目標データのリスト（配列の順序が表示順）
                    例: [{"no": 1, "description": "...", "is_completed": 0}, ...]

    Returns:
        List[WebCoachNextCoachingGoal]: 更新後の目標一覧

    動作:
        - リクエストに含まれるnoは作成/更新される
        - リクエストに含まれないnoは削除される
        - 配列の順序がdisplay_orderになる（0番目がdisplay_order=1）
    """
    from entities.webcoach import WebCoachNextCoachingGoal

    # ユーザーの既存の全目標を取得
    existing_goals = db.query(WebCoachNextCoachingGoal).filter(
        WebCoachNextCoachingGoal.mdl_user_id == mdl_user_id
    ).all()

    # 既存の目標をnoでマッピング
    existing_goals_map = {goal.no: goal for goal in existing_goals}

    # リクエストに含まれるnoのセット
    request_nos = {item['no'] for item in goals_data}

    # リクエストに含まれないnoを削除
    for existing_no, existing_goal in existing_goals_map.items():
        if existing_no not in request_nos:
            db.delete(existing_goal)

    # リクエストの各アイテムを処理
    result_goals = []
    for index, goal_data in enumerate(goals_data):
        no = goal_data['no']
        description = goal_data.get('description')
        is_completed = goal_data.get('is_completed', 0)
        display_order = index + 1  # 配列の順序がdisplay_order

        if no in existing_goals_map:
            # 既存の目標を更新
            existing_goal = existing_goals_map[no]
            if description is not None:
                existing_goal.description = description
            existing_goal.is_completed = is_completed
            existing_goal.display_order = display_order
            result_goals.append(existing_goal)
        else:
            # 新しい目標を作成
            new_goal = WebCoachNextCoachingGoal(
                mdl_user_id=mdl_user_id,
                no=no,
                display_order=display_order,
                description=description,
                is_completed=is_completed
            )
            db.add(new_goal)
            result_goals.append(new_goal)

    db.flush()

    return result_goals


# ==========================================
# Coach-Student Mapping CRUD
# ==========================================

def create_coach_student_mapping(
    db: Session,
    coach_user_id: int,
    student_user_id: int
) -> WebCoachStudentCoachMapping:
    """
    コーチと受講生のマッピングを作成

    Args:
        db: Database session
        coach_user_id: コーチのMoodleユーザーID
        student_user_id: 受講生のMoodleユーザーID

    Returns:
        WebCoachStudentCoachMapping: Created mapping

    Raises:
        ValueError: 既に有効なマッピングが存在する場合
    """
    # 既に有効なマッピングが存在するかチェック
    existing = db.query(WebCoachStudentCoachMapping).filter(
        WebCoachStudentCoachMapping.coach_user_id == coach_user_id,
        WebCoachStudentCoachMapping.student_user_id == student_user_id,
        WebCoachStudentCoachMapping.logical_deleted == 0
    ).first()

    if existing:
        raise ValueError(
            f"Active mapping already exists: coach={coach_user_id}, student={student_user_id}"
        )

    # 新規マッピングを作成
    mapping = WebCoachStudentCoachMapping(
        coach_user_id=coach_user_id,
        student_user_id=student_user_id,
        logical_deleted=0
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


def get_coach_student_mapping(
    db: Session,
    coach_user_id: int,
    student_user_id: int,
    include_deleted: bool = False
) -> Optional[WebCoachStudentCoachMapping]:
    """
    特定のコーチと受講生のマッピングを取得

    Args:
        db: Database session
        coach_user_id: コーチのMoodleユーザーID
        student_user_id: 受講生のMoodleユーザーID
        include_deleted: 削除済みも含めるか（デフォルト: False）

    Returns:
        Optional[WebCoachStudentCoachMapping]: マッピング（存在しない場合はNone）
    """
    query = db.query(WebCoachStudentCoachMapping).filter(
        WebCoachStudentCoachMapping.coach_user_id == coach_user_id,
        WebCoachStudentCoachMapping.student_user_id == student_user_id
    )

    if not include_deleted:
        query = query.filter(WebCoachStudentCoachMapping.logical_deleted == 0)

    return query.first()


def get_all_coach_student_mappings(
    db: Session,
    include_deleted: bool = False
) -> List[WebCoachStudentCoachMapping]:
    """
    全てのコーチと受講生のマッピングを取得

    Args:
        db: Database session
        include_deleted: 削除済みも含めるか（デフォルト: False）

    Returns:
        List[WebCoachStudentCoachMapping]: マッピングリスト
    """
    query = db.query(WebCoachStudentCoachMapping)

    if not include_deleted:
        query = query.filter(WebCoachStudentCoachMapping.logical_deleted == 0)

    return query.all()


def get_students_by_coach(
    db: Session,
    coach_user_id: int,
    include_deleted: bool = False
) -> List[int]:
    """
    コーチが担当する受講生のIDリストを取得

    Args:
        db: Database session
        coach_user_id: コーチのMoodleユーザーID
        include_deleted: 削除済みも含めるか（デフォルト: False）

    Returns:
        List[int]: 受講生のユーザーIDリスト
    """
    query = db.query(WebCoachStudentCoachMapping.student_user_id).filter(
        WebCoachStudentCoachMapping.coach_user_id == coach_user_id
    )

    if not include_deleted:
        query = query.filter(WebCoachStudentCoachMapping.logical_deleted == 0)

    results = query.all()
    return [row[0] for row in results]


def get_coach_by_student(
    db: Session,
    student_user_id: int,
    include_deleted: bool = False
) -> Optional[int]:
    """
    受講生に割り当てられたコーチのIDを取得

    Args:
        db: Database session
        student_user_id: 受講生のMoodleユーザーID
        include_deleted: 削除済みも含めるか（デフォルト: False）

    Returns:
        Optional[int]: コーチのユーザーID（存在しない場合はNone）

    Note:
        受講生は通常1人のコーチのみが割り当てられることを想定
        複数存在する場合は最初の1件を返す
    """
    query = db.query(WebCoachStudentCoachMapping.coach_user_id).filter(
        WebCoachStudentCoachMapping.student_user_id == student_user_id
    )

    if not include_deleted:
        query = query.filter(WebCoachStudentCoachMapping.logical_deleted == 0)

    result = query.first()
    return result[0] if result else None


def delete_coach_student_mapping(
    db: Session,
    coach_user_id: int,
    student_user_id: int
) -> bool:
    """
    コーチと受講生のマッピングを論理削除（DELETE + INSERT）

    logical_deletedが主キーに含まれるため、UPDATEではなくDELETE+INSERTで実装

    Args:
        db: Database session
        coach_user_id: コーチのMoodleユーザーID
        student_user_id: 受講生のMoodleユーザーID

    Returns:
        bool: 削除成功の場合True、対象が存在しない場合False
    """
    # 有効なマッピングを検索
    existing = db.query(WebCoachStudentCoachMapping).filter(
        WebCoachStudentCoachMapping.coach_user_id == coach_user_id,
        WebCoachStudentCoachMapping.student_user_id == student_user_id,
        WebCoachStudentCoachMapping.logical_deleted == 0
    ).first()

    if not existing:
        return False

    # トランザクション内でDELETE + INSERT
    # 1. 有効なレコードを削除
    db.delete(existing)
    db.flush()

    # 2. 削除済みレコードを挿入
    deleted_mapping = WebCoachStudentCoachMapping(
        coach_user_id=coach_user_id,
        student_user_id=student_user_id,
        logical_deleted=1
    )
    db.add(deleted_mapping)
    db.commit()

    return True


def restore_coach_student_mapping(
    db: Session,
    coach_user_id: int,
    student_user_id: int
) -> WebCoachStudentCoachMapping:
    """
    削除されたマッピングを復元（再登録）

    Args:
        db: Database session
        coach_user_id: コーチのMoodleユーザーID
        student_user_id: 受講生のMoodleユーザーID

    Returns:
        WebCoachStudentCoachMapping: 復元されたマッピング

    Raises:
        ValueError: 既に有効なマッピングが存在する場合
    """
    # 既に有効なマッピングが存在するかチェック
    existing_active = db.query(WebCoachStudentCoachMapping).filter(
        WebCoachStudentCoachMapping.coach_user_id == coach_user_id,
        WebCoachStudentCoachMapping.student_user_id == student_user_id,
        WebCoachStudentCoachMapping.logical_deleted == 0
    ).first()

    if existing_active:
        raise ValueError(
            f"Active mapping already exists: coach={coach_user_id}, student={student_user_id}"
        )

    # 新しい有効なマッピングを作成
    restored_mapping = WebCoachStudentCoachMapping(
        coach_user_id=coach_user_id,
        student_user_id=student_user_id,
        logical_deleted=0
    )
    db.add(restored_mapping)
    db.commit()
    db.refresh(restored_mapping)
    return restored_mapping

