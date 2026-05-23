"""
WebCoach specific endpoints (Resume courses, profiles, etc.)
"""
from typing import List
from datetime import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from database import get_db
from dto.request import WebCoachUserProfileUpdate, ResumeCourseUpdate, UpdateDBRequest, AvatarCreate, AvatarUpdate
from dto.response import WebCoachUserProfileResponse, AvatarResponse
import crud
from crud import (
    get_webcoach_user_profile,
    upsert_webcoach_user_profile,
    get_webcoach_resume_courses,
    upsert_webcoach_user_course_lastaccess,
    get_moodle_user_info,
    get_image_url,
    upsert_image_url,
    delete_image_url,
    get_image_urls_by_category,
    create_avatar,
    get_avatar,
    get_all_avatars,
    update_avatar,
    delete_avatar,
)
from entities.webcoach import WebCoachAIApplication

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["WebCoach"])


# ==========================================
# Resume Course Endpoints
# ==========================================

@router.get(
    "/users/{userid}/resume-courses",
    response_model=List[dict],
    summary="再開可能なコース取得"
)
def get_resume_courses(
    userid: int,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """
    ユーザーの再開可能なコース一覧を取得します。

    最後にアクセスしたコースで、まだ完了していないものを返します。

    Args:
        userid: ユーザーID
        limit: 取得件数（デフォルト: 5）

    Returns:
        再開可能なコース一覧
    """
    try:
        courses = crud.get_user_last_accessed_courses(db, userid, limit)

        # Transform to resume course format
        resume_courses = []
        for course in courses:
            # courseは辞書形式
            courseid = course.get("courseid") if isinstance(course, dict) else course.courseid
            # コース画像URLを取得 (category_id=1 はコース)
            image_url = get_image_url(db, category_id=1, target_id=courseid)

            if isinstance(course, dict):
                resume_courses.append({
                    "courseid": course.get("courseid"),
                    "fullname": course.get("course_fullname") or f"Course {course.get('courseid')}",
                    "shortname": course.get("course_shortname") or "",
                    "summary": course.get("course_summary"),
                    "lastaccess": course.get("lastaccess"),
                    "progress": 0.0,  # TODO: Calculate actual progress from Moodle
                    "accesscount": course.get("accesscount"),
                    "image_url": image_url  # 画像URL追加
                })
            else:
                resume_courses.append({
                    "courseid": course.courseid,
                    "fullname": course.course_fullname or f"Course {course.courseid}",
                    "shortname": course.course_shortname or "",
                    "summary": course.course_summary,
                    "lastaccess": course.lastaccess,
                    "progress": 0.0,  # TODO: Calculate actual progress from Moodle
                    "accesscount": course.accesscount,
                    "image_url": image_url  # 画像URL追加
                })

        return resume_courses
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get resume courses: {str(e)}"
        )


# ==========================================
# WebCoach User Profile Endpoints
# ==========================================

@router.get(
    "/webcoach/profile/{userid}",
    response_model=WebCoachUserProfileResponse,
    response_model_exclude_none=False,
    summary="WebCoachユーザープロフィール取得"
)
def get_webcoach_profile_endpoint(
    userid: int,
    db: Session = Depends(get_db)
):
    """
    WebCoachユーザープロフィールを取得します。

    Args:
        userid: ユーザーID (Moodle User ID)

    Returns:
        WebCoachUserProfile: プロフィール情報
    """
    try:
        profile = get_webcoach_user_profile(db, userid)

        if not profile:
            # プロフィールが存在しない場合は、空のプロフィールを返す
            return WebCoachUserProfileResponse(
                mdl_user_id=userid,
                nick_name=None,
                self_intro=None,
                target_job=None,
                ideal_career=None,
                today_small_step=None,
                goal=None,
                badge_count=0,
                avatar_id=None
            )

        # Convert profile to dict
        profile_dict = {
            "mdl_user_id": profile.mdl_user_id,
            "nick_name": profile.nick_name,
            "self_intro": profile.self_intro,
            "target_job": profile.target_job,
            "ideal_career": profile.ideal_career,
            "today_small_step": profile.today_small_step,
            "goal": profile.goal,
            "badge_count": profile.badge_count,
            "avatar_id": profile.avatar_id
        }
        return WebCoachUserProfileResponse(**profile_dict)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get WebCoach profile: {str(e)}"
        )


@router.post(
    "/webcoach/profile/{userid}",
    response_model=WebCoachUserProfileResponse,
    summary="WebCoachユーザープロフィール更新"
)
def update_webcoach_profile_endpoint(
    userid: int,
    data: WebCoachUserProfileUpdate,
    db: Session = Depends(get_db)
):
    """
    WebCoachユーザープロフィールを更新します。
    プロフィールが存在しない場合は新規作成します。

    Args:
        userid: ユーザーID (Moodle User ID)
        data: 更新するプロフィール情報

    Returns:
        WebCoachUserProfile: 更新されたプロフィール情報
    """
    try:
        # 更新データを辞書に変換
        update_dict = data.model_dump(exclude_unset=True)
        update_dict['mdl_user_id'] = userid

        # upsert実行
        profile = upsert_webcoach_user_profile(db, update_dict)
        db.commit()
        db.refresh(profile)

        return WebCoachUserProfileResponse.model_validate(profile)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update WebCoach profile: {str(e)}"
        )


# ==========================================
# Alias Endpoints (for compatibility)
# ==========================================

@router.get(
    "/profile/{userid}",
    response_model=WebCoachUserProfileResponse,
    response_model_exclude_none=False,
    summary="WebCoachプロフィール情報取得"
)
def get_profile_alias(userid: int, db: Session = Depends(get_db)):
    """
    WebCoachプロフィール情報取得
    BFF /api/webcoach/profile からの呼び出し用
    """
    profile = get_webcoach_user_profile(db, userid)

    if not profile:
        # プロフィールが存在しない場合は、空のプロフィールを返す
        return WebCoachUserProfileResponse(
            mdl_user_id=userid,
            nick_name=None,
            self_intro=None,
            target_job=None,
            ideal_career=None,
            today_small_step=None,
            goal=None,
            badge_count=0,
            avatar_id=None
        )

    # Convert profile to dict
    profile_dict = {
        "mdl_user_id": profile.mdl_user_id,
        "nick_name": profile.nick_name,
        "self_intro": profile.self_intro,
        "target_job": profile.target_job,
        "ideal_career": profile.ideal_career,
        "today_small_step": profile.today_small_step,
        "goal": profile.goal,
        "badge_count": profile.badge_count,
        "avatar_id": profile.avatar_id
    }
    return WebCoachUserProfileResponse(**profile_dict)


@router.post(
    "/updateprofile/{userid}",
    response_model=WebCoachUserProfileResponse,
    summary="WebCoachプロフィール情報更新"
)
def update_profile_alias(userid: int, data: WebCoachUserProfileUpdate, db: Session = Depends(get_db)):
    """
    WebCoachプロフィール情報更新
    BFF /api/webcoach/updateprofile からの呼び出し用
    """
    try:
        # Convert data to dict and add mdl_user_id
        record = data.model_dump(exclude_unset=True)
        record['mdl_user_id'] = userid
        profile = upsert_webcoach_user_profile(db, record)
        db.commit()
        db.refresh(profile)
        return WebCoachUserProfileResponse.model_validate(profile)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update WebCoach profile: {str(e)}"
        )


@router.get(
    "/resumecourse/{userid}",
    response_model=List[dict],
    summary="コース再開情報取得（エイリアス）"
)
def get_resume_course_alias(
    userid: int,
    days: int = None,
    db: Session = Depends(get_db)
):
    """
    コース再開情報取得のエイリアスエンドポイント
    webcoach_user_course_lastaccess テーブルから取得

    Args:
        userid: Moodle User ID
        days: 最後のN日間にアクセスしたコースのみを取得（オプション）

    注: このテーブルは1ユーザー1レコードなので、常に1件のみ返します
    """
    try:
        courses = get_webcoach_resume_courses(db, userid, limit=1, days=days)

        # Transform to resume course format
        resume_courses = []
        for course in courses:
            # コース画像URLを取得 (category_id=1 はコース)
            image_url = get_image_url(db, category_id=1, target_id=course["courseid"])

            resume_courses.append({
                "courseid": course["courseid"],
                "fullname": course["course_fullname"] or f"Course {course['courseid']}",
                "shortname": course["course_shortname"] or "",
                "summary": course["course_summary"],
                "progress": course["progress_percent"],
                "current_section": course["current_section"],
                "last_access_time": str(course["create_timestamp"]) if course["create_timestamp"] else None,
                "image_url": image_url  # 画像URL追加
            })

        return resume_courses
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get resume courses: {str(e)}"
        )


@router.post(
    "/resumecourse/{userid}",
    response_model=dict,
    summary="コース再開情報更新"
)
def update_resume_course(
    userid: int,
    data: ResumeCourseUpdate,
    db: Session = Depends(get_db)
):
    """
    ユーザーの最終アクセスコースと進捗率を更新します。

    webcoach_user_course_lastaccess テーブルに、1ユーザー1レコードで保存します。
    既存レコードがある場合は上書き、ない場合は新規作成します。

    Args:
        userid: ユーザーID (Moodle User ID)
        data: 更新するコースID、進捗率、現在のセクション番号

    Returns:
        更新結果
    """
    try:
        # Convert data to dict and add mdl_user_id
        record = {
            'mdl_user_id': userid,
            'courseid': data.courseid,
            'progress_percent': data.progress_percent,
            'current_section': data.current_section,
            'create_timestamp': func.now()
        }

        # Upsert resume course record
        result = upsert_webcoach_user_course_lastaccess(db, record)
        db.commit()

        return {
            "success": True,
            "message": "Resume course updated successfully",
            "userid": userid,
            "courseid": data.courseid,
            "progress": data.progress_percent,
            "current_section": data.current_section
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update resume course: {str(e)}"
        )


# ==========================================
# UpdateDB Endpoint
# ==========================================

@router.post(
    "/updatedb",
    response_model=dict,
    summary="WebCoachカスタムテーブル一括更新"
)
def update_webcoach_database(
    data: UpdateDBRequest,
    db: Session = Depends(get_db)
):
    """
    WebCoachカスタムテーブルを一括更新します。

    対応データタイプ:
    - ai_applications: AIアプリケーション情報

    Args:
        data: 更新リクエスト（data_type, records, table_name）

    Returns:
        更新結果（recordsProcessed, recordsFailed, errors）
    """
    try:
        data_type = data.data_type
        records = data.records

        # データタイプからテーブルマッピング
        table_mapping = {
            'ai_applications': WebCoachAIApplication,
            'ai_application': WebCoachAIApplication,
        }

        # テーブル名が明示的に指定されている場合はそれを使用
        if data.table_name:
            entity_class = table_mapping.get(data.table_name)
        else:
            entity_class = table_mapping.get(data_type)

        if not entity_class:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported data_type: {data_type}"
            )

        records_processed = 0
        records_failed = 0
        errors = []

        for idx, record in enumerate(records):
            try:
                # ai_applicationsの処理
                if entity_class == WebCoachAIApplication:
                    # delete_flagのチェック（物理削除）
                    delete_flag = record.get('delete_flag') or record.get('deleteflag')

                    if delete_flag == 1 or delete_flag == '1' or delete_flag is True:
                        # 削除処理
                        # 必須フィールドチェック (削除の場合はname + categoryのみ必要)
                        if not all(k in record for k in ['name', 'category']):
                            raise ValueError("Missing required fields for deletion: name, category")

                        # 既存レコードをチェック
                        existing = db.query(WebCoachAIApplication).filter(
                            WebCoachAIApplication.name == record['name'],
                            WebCoachAIApplication.category == record['category']
                        ).first()

                        if existing:
                            # 物理削除
                            db.delete(existing)
                            logger.info(f"Deleted AI application: {record['name']} ({record['category']})")
                        else:
                            logger.warning(f"AI application not found for deletion: {record['name']} ({record['category']})")
                    else:
                        # 通常の作成/更新処理
                        # 必須フィールドチェック
                        if not all(k in record for k in ['name', 'category', 'description']):
                            raise ValueError("Missing required fields: name, category, description")

                        # 既存レコードをチェック (name + category で一意)
                        existing = db.query(WebCoachAIApplication).filter(
                            WebCoachAIApplication.name == record['name'],
                            WebCoachAIApplication.category == record['category']
                        ).first()

                        if existing:
                            # 更新
                            existing.description = record['description']
                            existing.url = record.get('url')
                            existing.icon_url = record.get('icon_url')
                            existing.tags = record.get('tags')
                            existing.updated_at = func.now()
                        else:
                            # 新規作成
                            new_app = WebCoachAIApplication(
                                name=record['name'],
                                category=record['category'],
                                description=record['description'],
                                url=record.get('url'),
                                icon_url=record.get('icon_url'),
                                tags=record.get('tags'),
                                created_at=func.now(),
                                updated_at=func.now()
                            )
                            db.add(new_app)

                    records_processed += 1

            except Exception as e:
                records_failed += 1
                errors.append({
                    'row': idx + 1,
                    'message': str(e)
                })
                logger.error(f"Failed to process record {idx + 1}: {str(e)}")
                continue

        # コミット
        db.commit()

        return {
            'success': records_failed == 0,
            'recordsProcessed': records_processed,
            'recordsFailed': records_failed,
            'errors': errors if errors else None
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update database: {str(e)}"
        )


# ==========================================
# Image URL Endpoints
# ==========================================

@router.get(
    "/image-url/{category_id}/{target_id}",
    response_model=dict,
    summary="画像URL取得"
)
def get_image_url_endpoint(
    category_id: int,
    target_id: int,
    db: Session = Depends(get_db)
):
    """
    コース/カテゴリ/タグの画像URLを取得します。

    Args:
        category_id: カテゴリタイプ (1=コース, 2=カテゴリ, 3=タグ)
        target_id: コース/カテゴリ/タグのID

    Returns:
        画像URL情報
    """
    try:
        image_url = get_image_url(db, category_id, target_id)

        if not image_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Image URL not found for category_id={category_id}, target_id={target_id}"
            )

        return {
            "category_id": category_id,
            "target_id": target_id,
            "image_url": image_url
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get image URL: {str(e)}"
        )


@router.post(
    "/image-url/{category_id}/{target_id}",
    response_model=dict,
    summary="画像URL登録・更新"
)
def upsert_image_url_endpoint(
    category_id: int,
    target_id: int,
    data: dict,
    db: Session = Depends(get_db)
):
    """
    コース/カテゴリ/タグの画像URLを登録または更新します。

    Args:
        category_id: カテゴリタイプ (1=コース, 2=カテゴリ, 3=タグ)
        target_id: コース/カテゴリ/タグのID
        data: {"image_url": "https://..."}

    Returns:
        登録・更新結果
    """
    try:
        if "image_url" not in data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="image_url is required"
            )

        image_url = data["image_url"]
        result = upsert_image_url(db, category_id, target_id, image_url)
        db.commit()

        return {
            "success": True,
            "category_id": result.category_id,
            "target_id": result.target_id,
            "image_url": result.image_url,
            "created_at": result.created_at,
            "updated_at": result.updated_at
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upsert image URL: {str(e)}"
        )


@router.delete(
    "/image-url/{category_id}/{target_id}",
    response_model=dict,
    summary="画像URL削除"
)
def delete_image_url_endpoint(
    category_id: int,
    target_id: int,
    db: Session = Depends(get_db)
):
    """
    コース/カテゴリ/タグの画像URLを削除します。

    Args:
        category_id: カテゴリタイプ (1=コース, 2=カテゴリ, 3=タグ)
        target_id: コース/カテゴリ/タグのID

    Returns:
        削除結果
    """
    try:
        success = delete_image_url(db, category_id, target_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Image URL not found for category_id={category_id}, target_id={target_id}"
            )

        db.commit()

        return {
            "success": True,
            "message": "Image URL deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete image URL: {str(e)}"
        )


@router.get(
    "/image-urls/category/{category_id}",
    response_model=List[dict],
    summary="カテゴリ別画像URL一覧取得"
)
def get_image_urls_by_category_endpoint(
    category_id: int,
    db: Session = Depends(get_db)
):
    """
    カテゴリタイプ別に画像URL一覧を取得します。

    Args:
        category_id: カテゴリタイプ (1=コース, 2=カテゴリ, 3=タグ)

    Returns:
        画像URL一覧
    """
    try:
        image_urls = get_image_urls_by_category(db, category_id)
        return image_urls
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get image URLs: {str(e)}"
        )


# ==========================================
# Avatar Endpoints
# ==========================================

@router.post(
    "/avatar",
    response_model=AvatarResponse,
    status_code=status.HTTP_201_CREATED,
    summary="アバター登録"
)
def create_avatar_endpoint(
    data: AvatarCreate,
    db: Session = Depends(get_db)
):
    """
    新しいアバターを登録します。

    Args:
        data: アバター作成データ（URL）

    Returns:
        作成されたアバター情報
    """
    try:
        avatar = create_avatar(db, data.url)
        db.commit()
        db.refresh(avatar)

        return AvatarResponse(
            avatar_id=avatar.avatar_id,
            url=avatar.url,
            created_at=str(avatar.created_at),
            updated_at=str(avatar.updated_at)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create avatar: {str(e)}"
        )


@router.get(
    "/avatar/{avatar_id}",
    response_model=AvatarResponse,
    summary="アバター取得"
)
def get_avatar_endpoint(
    avatar_id: int,
    db: Session = Depends(get_db)
):
    """
    アバター情報を取得します。

    Args:
        avatar_id: アバターID

    Returns:
        アバター情報
    """
    try:
        avatar = get_avatar(db, avatar_id)

        if not avatar:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Avatar not found: {avatar_id}"
            )

        return AvatarResponse(
            avatar_id=avatar.avatar_id,
            url=avatar.url,
            created_at=str(avatar.created_at),
            updated_at=str(avatar.updated_at)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get avatar: {str(e)}"
        )


@router.get(
    "/avatars",
    response_model=List[AvatarResponse],
    summary="アバター一覧取得"
)
def get_avatars_endpoint(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    アバター一覧を取得します。

    Args:
        limit: 取得件数（デフォルト: 100）
        offset: オフセット（デフォルト: 0）

    Returns:
        アバター一覧
    """
    try:
        avatars = get_all_avatars(db, limit, offset)

        return [
            AvatarResponse(
                avatar_id=avatar.avatar_id,
                url=avatar.url,
                created_at=str(avatar.created_at),
                updated_at=str(avatar.updated_at)
            )
            for avatar in avatars
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get avatars: {str(e)}"
        )


@router.put(
    "/avatar/{avatar_id}",
    response_model=AvatarResponse,
    summary="アバター更新"
)
def update_avatar_endpoint(
    avatar_id: int,
    data: AvatarUpdate,
    db: Session = Depends(get_db)
):
    """
    アバター情報を更新します。

    Args:
        avatar_id: アバターID
        data: 更新するアバターデータ（URL）

    Returns:
        更新されたアバター情報
    """
    try:
        avatar = update_avatar(db, avatar_id, data.url)

        if not avatar:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Avatar not found: {avatar_id}"
            )

        db.commit()
        db.refresh(avatar)

        return AvatarResponse(
            avatar_id=avatar.avatar_id,
            url=avatar.url,
            created_at=str(avatar.created_at),
            updated_at=str(avatar.updated_at)
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update avatar: {str(e)}"
        )


@router.delete(
    "/avatar/{avatar_id}",
    response_model=dict,
    summary="アバター削除"
)
def delete_avatar_endpoint(
    avatar_id: int,
    db: Session = Depends(get_db)
):
    """
    アバターを削除します。

    Args:
        avatar_id: アバターID

    Returns:
        削除結果
    """
    try:
        success = delete_avatar(db, avatar_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Avatar not found: {avatar_id}"
            )

        db.commit()

        return {
            "success": True,
            "message": "Avatar deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete avatar: {str(e)}"
        )
