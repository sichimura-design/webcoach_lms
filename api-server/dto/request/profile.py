"""
Profile related request DTOs
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class ProfileSettingsCreate(BaseModel):
    """プロフィール設定作成"""
    userid: int = Field(..., gt=0, description="Moodle User ID")
    theme: Optional[str] = Field(default="light", pattern="^(light|dark)$")
    language: Optional[str] = Field(default="ja", pattern="^(ja|en)$")
    notifications_enabled: Optional[bool] = True
    email_notifications: Optional[bool] = True
    timezone: Optional[str] = "Asia/Tokyo"
    items_per_page: Optional[int] = Field(default=20, ge=10, le=100)
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class ProfileSettingsUpdate(BaseModel):
    """プロフィール設定更新（部分更新可能）"""
    theme: Optional[str] = Field(default=None, pattern="^(light|dark)$")
    language: Optional[str] = Field(default=None, pattern="^(ja|en)$")
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None
    timezone: Optional[str] = None
    items_per_page: Optional[int] = Field(default=None, ge=10, le=100)
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class WebCoachUserProfileUpdate(BaseModel):
    """WebCoachユーザープロフィール更新"""
    nick_name: Optional[str] = Field(default=None, max_length=256, description="ニックネーム")
    self_intro: Optional[str] = Field(default=None, description="自己紹介文")
    target_job: Optional[str] = Field(default=None, max_length=256, description="なりたい職業・肩書き")
    ideal_career: Optional[str] = Field(default=None, max_length=256, description="理想のキャリア")
    today_small_step: Optional[str] = Field(default=None, max_length=256, description="今日のスモールステップ")
    goal: Optional[str] = Field(default=None, description="目標")
    badge_count: Optional[int] = Field(default=None, ge=0, description="獲得バッジ数")
    avatar_id: Optional[int] = Field(default=None, description="アバターID")
