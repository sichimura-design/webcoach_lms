"""
Profile settings and user profile endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.request import ProfileSettingsCreate, ProfileSettingsUpdate
from dto.response import ProfileSettingsResponse
import crud

router = APIRouter(prefix="/api", tags=["Profile Settings"])


@router.post(
    "/profile-settings",
    response_model=ProfileSettingsResponse,
    status_code=status.HTTP_201_CREATED,
    summary="プロフィール設定を作成"
)
def create_profile_settings(
    data: ProfileSettingsCreate,
    db: Session = Depends(get_db)
):
    """
    新しいプロフィール設定を作成します。

    Args:
        data: プロフィール設定データ

    Returns:
        作成されたプロフィール設定
    """
    try:
        # Check if settings already exist
        existing = crud.get_profile_settings(db, data.userid)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Profile settings already exist for user {data.userid}"
            )

        result = crud.create_profile_settings(db, data)
        return ProfileSettingsResponse.from_orm_model(result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create profile settings: {str(e)}"
        )


@router.get(
    "/users/{userid}/profile-settings",
    response_model=ProfileSettingsResponse,
    summary="プロフィール設定を取得"
)
def get_profile_settings(
    userid: int,
    auto_create: bool = False,
    db: Session = Depends(get_db)
):
    """
    ユーザーのプロフィール設定を取得します。

    Args:
        userid: ユーザーID
        auto_create: 設定が存在しない場合に自動作成するか（デフォルト: False）

    Returns:
        プロフィール設定
    """
    try:
        if auto_create:
            settings = crud.get_or_create_profile_settings(db, userid)
        else:
            settings = crud.get_profile_settings(db, userid)

        if not settings:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile settings not found for user {userid}"
            )

        return ProfileSettingsResponse.from_orm_model(settings)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get profile settings: {str(e)}"
        )


@router.put(
    "/users/{userid}/profile-settings",
    response_model=ProfileSettingsResponse,
    summary="プロフィール設定を更新"
)
def update_profile_settings(
    userid: int,
    data: ProfileSettingsUpdate,
    db: Session = Depends(get_db)
):
    """
    ユーザーのプロフィール設定を更新します（部分更新対応）。

    Args:
        userid: ユーザーID
        data: 更新するプロフィール設定（変更する項目のみ指定）

    Returns:
        更新されたプロフィール設定
    """
    try:
        settings = crud.update_profile_settings(db, userid, data)

        if not settings:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile settings not found for user {userid}"
            )

        return ProfileSettingsResponse.from_orm_model(settings)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile settings: {str(e)}"
        )


# ==========================================
# User Profile Endpoints (統合プロフィール)
# ==========================================

@router.get(
    "/users/{userid}/profile",
    response_model=dict,
    summary="ユーザープロフィール取得",
    tags=["User Profile"]
)
def get_user_profile(
    userid: int,
    db: Session = Depends(get_db)
):
    """
    ユーザーの統合プロフィール情報を取得します。

    プロフィール設定が存在しない場合は、基本情報のみ返します。
    実際のMoodleユーザー情報は、BFF経由でMoodle APIから取得する必要があります。

    Args:
        userid: ユーザーID

    Returns:
        統合プロフィール情報
    """
    try:
        # Get profile settings from DB
        settings = crud.get_profile_settings(db, userid)

        response = {
            "userid": userid,
            "settings": ProfileSettingsResponse.from_orm_model(settings) if settings else None
        }

        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user profile: {str(e)}"
        )


@router.post(
    "/users/{userid}/profile",
    response_model=dict,
    summary="ユーザープロフィール更新",
    tags=["User Profile"]
)
def update_user_profile(
    userid: int,
    data: ProfileSettingsUpdate,
    db: Session = Depends(get_db)
):
    """
    ユーザープロフィールを更新します。

    設定が存在しない場合は自動作成します。

    Args:
        userid: ユーザーID
        data: 更新するプロフィール設定

    Returns:
        更新されたプロフィール情報
    """
    try:
        # Get or create settings
        settings = crud.get_or_create_profile_settings(db, userid)

        # Update settings
        settings = crud.update_profile_settings(db, userid, data)

        return {
            "userid": userid,
            "settings": ProfileSettingsResponse.from_orm_model(settings)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user profile: {str(e)}"
        )
