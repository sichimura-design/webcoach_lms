"""
Mapper for profile entities and DTOs
"""
import time
from entities.profile import UserProfileSettings
from entities.webcoach import WebCoachUserProfile
from dto.request.profile import ProfileSettingsCreate, ProfileSettingsUpdate, WebCoachUserProfileUpdate
from dto.response.profile import ProfileSettingsResponse, WebCoachUserProfileResponse


class ProfileMapper:
    """Profile entity to DTO mapper"""

    # ==========================================
    # Request → Entity (Create)
    # ==========================================

    @staticmethod
    def from_create_request(request: ProfileSettingsCreate, current_time: int = None) -> UserProfileSettings:
        """Convert ProfileSettingsCreate to UserProfileSettings entity"""
        if current_time is None:
            current_time = int(time.time())

        return UserProfileSettings(
            userid=request.userid,
            theme=request.theme,
            language=request.language,
            notifications_enabled=int(request.notifications_enabled),
            email_notifications=int(request.email_notifications),
            timezone=request.timezone,
            items_per_page=request.items_per_page,
            avatar_url=request.avatar_url,
            bio=request.bio,
            preferences=request.preferences,
            timemodified=current_time,
            timecreated=current_time
        )

    # ==========================================
    # Request → Entity (Update)
    # ==========================================

    @staticmethod
    def update_from_request(entity: UserProfileSettings, request: ProfileSettingsUpdate) -> UserProfileSettings:
        """Update UserProfileSettings entity from ProfileSettingsUpdate request"""
        update_data = request.model_dump(exclude_unset=True)

        # Convert boolean to int for MySQL TINYINT
        if 'notifications_enabled' in update_data:
            update_data['notifications_enabled'] = int(update_data['notifications_enabled'])
        if 'email_notifications' in update_data:
            update_data['email_notifications'] = int(update_data['email_notifications'])

        for key, value in update_data.items():
            setattr(entity, key, value)

        entity.timemodified = int(time.time())
        return entity

    @staticmethod
    def update_webcoach_profile_from_request(
        entity: WebCoachUserProfile,
        request: WebCoachUserProfileUpdate
    ) -> WebCoachUserProfile:
        """Update WebCoachUserProfile entity from WebCoachUserProfileUpdate request"""
        if request.self_intro is not None:
            entity.self_intro = request.self_intro
        if request.target_job is not None:
            entity.target_job = request.target_job
        if request.ideal_work_style is not None:
            entity.ideal_work_style = request.ideal_work_style
        if request.badge_count is not None:
            entity.badge_count = request.badge_count

        return entity

    # ==========================================
    # Entity → Response
    # ==========================================

    @staticmethod
    def to_profile_settings_response(entity: UserProfileSettings) -> ProfileSettingsResponse:
        """Convert UserProfileSettings entity to ProfileSettingsResponse DTO"""
        return ProfileSettingsResponse(
            id=entity.id,
            userid=entity.userid,
            theme=entity.theme,
            language=entity.language,
            notifications_enabled=bool(entity.notifications_enabled),
            email_notifications=bool(entity.email_notifications),
            timezone=entity.timezone,
            items_per_page=entity.items_per_page,
            avatar_url=entity.avatar_url,
            bio=entity.bio,
            preferences=entity.preferences,
            timemodified=entity.timemodified,
            timecreated=entity.timecreated
        )

    @staticmethod
    def to_webcoach_profile_response(entity: WebCoachUserProfile) -> WebCoachUserProfileResponse:
        """Convert WebCoachUserProfile entity to WebCoachUserProfileResponse DTO"""
        return WebCoachUserProfileResponse(
            mdl_user_id=entity.mdl_user_id,
            self_intro=entity.self_intro,
            target_job=entity.target_job,
            ideal_work_style=entity.ideal_work_style,
            badge_count=entity.badge_count or 0
        )
