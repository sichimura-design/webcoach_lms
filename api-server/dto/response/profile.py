"""
Profile related response DTOs
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class ProfileSettingsResponse(BaseModel):
    """プロフィール設定レスポンス"""
    id: int
    userid: int
    theme: str
    language: str
    notifications_enabled: bool
    email_notifications: bool
    timezone: str
    items_per_page: int
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    timemodified: int
    timecreated: int

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_model(cls, db_model):
        """Convert SQLAlchemy model to Pydantic model"""
        return cls(
            id=db_model.id,
            userid=db_model.userid,
            theme=db_model.theme,
            language=db_model.language,
            notifications_enabled=bool(db_model.notifications_enabled),
            email_notifications=bool(db_model.email_notifications),
            timezone=db_model.timezone,
            items_per_page=db_model.items_per_page,
            avatar_url=db_model.avatar_url,
            bio=db_model.bio,
            preferences=db_model.preferences,
            timemodified=db_model.timemodified,
            timecreated=db_model.timecreated
        )


class UserProfileResponse(BaseModel):
    """ユーザープロフィール統合レスポンス"""
    userid: int
    username: Optional[str] = None
    email: Optional[str] = None
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    fullname: Optional[str] = None
    settings: Optional[ProfileSettingsResponse] = None


class WebCoachUserProfileResponse(BaseModel):
    """WebCoachユーザープロフィールレスポンス"""
    mdl_user_id: int
    nick_name: Optional[str] = None
    self_intro: Optional[str] = None
    target_job: Optional[str] = None
    ideal_career: Optional[str] = None
    today_small_step: Optional[str] = None
    goal: Optional[str] = None
    badge_count: Optional[int] = 0
    avatar_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
