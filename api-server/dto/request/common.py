"""
Common request DTOs
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from pydantic import BaseModel, Field


class BulkUploadRequest(BaseModel):
    """一括アップロードリクエスト"""
    data_type: str = Field(..., pattern="^(users|courses|enrollments|categories)$", description="データタイプ")
    records: List[Dict[str, Any]] = Field(..., description="アップロードするレコード一覧")


class UpdateDBRequest(BaseModel):
    """WebCoachカスタムテーブル更新リクエスト"""
    data_type: str = Field(..., description="データタイプ (ai_applications, roadmaps, profiles, など)")
    records: List[Dict[str, Any]] = Field(..., description="更新するレコード一覧")
    table_name: Optional[str] = Field(None, description="オプション: テーブル名を明示的に指定")


class AvatarCreate(BaseModel):
    """アバター作成リクエスト"""
    url: str = Field(..., max_length=512, description="アバター画像のS3 URL")


class AvatarUpdate(BaseModel):
    """アバター更新リクエスト"""
    url: str = Field(..., max_length=512, description="アバター画像のS3 URL")


class NextCoachingGoalCreate(BaseModel):
    """次回コーチングまでの目標作成リクエスト"""
    mdl_user_id: int = Field(..., description="MoodleユーザーID")
    no: int = Field(..., description="項目番号")
    description: str = Field(..., max_length=256, description="目標内容")
    is_completed: int = Field(0, description="完了フラグ（0: 未完了, 1: 完了）")


class NextCoachingGoalUpdate(BaseModel):
    """次回コーチングまでの目標更新リクエスト"""
    description: Optional[str] = Field(None, max_length=256, description="目標内容")
    is_completed: Optional[int] = Field(None, description="完了フラグ（0: 未完了, 1: 完了）")


class NextCoachingGoalReorderRequest(BaseModel):
    """次回コーチングまでの目標並び替えリクエスト"""
    moved_item_no: int = Field(..., description="ドラッグしたアイテムの現在のno")
    target_position: int = Field(..., ge=1, description="新しい位置（1始まり）")


class NextCoachingGoalItem(BaseModel):
    """次回コーチングまでの目標アイテム"""
    no: int = Field(..., description="項目番号")
    description: Optional[str] = Field(None, max_length=256, description="目標内容")
    is_completed: int = Field(0, description="完了フラグ（0: 未完了, 1: 完了）")


class NextCoachingGoalsBulkUpsertRequest(BaseModel):
    """次回コーチングまでの目標一括更新リクエスト"""
    goals: List[NextCoachingGoalItem] = Field(..., description="目標一覧（配列の順序が表示順）")


class StudyNoteUpdate(BaseModel):
    """学習メモ更新リクエスト"""
    content: str = Field(..., description="メモの内容")


class CoachingScheduleCreate(BaseModel):
    """コーチングスケジュール作成リクエスト"""
    coach_user_id: int = Field(..., description="コーチのMoodleユーザーID")
    coaching_date: date = Field(..., description="実施日")
    meeting_url: str = Field(..., max_length=1024, description="ミーティングURL")
    coaching_summary: Optional[str] = Field(None, description="コーチング内容の要約")
    todo: Optional[str] = Field(None, description="次回までのTODO")


class CoachingScheduleUpdate(BaseModel):
    """コーチングスケジュール更新リクエスト"""
    coaching_date: Optional[date] = Field(None, description="実施日")
    meeting_url: Optional[str] = Field(None, max_length=1024, description="ミーティングURL")
    coaching_summary: Optional[str] = Field(None, description="コーチング内容の要約")
    todo: Optional[str] = Field(None, description="次回までのTODO")


class CoachStudentMappingCreate(BaseModel):
    """コーチと受講生のマッピング作成リクエスト"""
    coach_user_id: int = Field(..., description="コーチのMoodleユーザーID")
    student_user_id: int = Field(..., description="受講生のMoodleユーザーID")


class CoachMeetingIntegrationUpsert(BaseModel):
    """コーチのミーティング連携トークン保存リクエスト（トークンはbff-server側で暗号化済み）"""
    provider: str = Field(..., pattern="^(zoom|google)$", description="連携先プロバイダ")
    access_token: str = Field(..., description="暗号化済みアクセストークン")
    refresh_token: str = Field(..., description="暗号化済みリフレッシュトークン")
    expires_at: datetime = Field(..., description="アクセストークン有効期限")
    scope: Optional[str] = Field(None, description="付与されたスコープ")
    provider_account_email: Optional[str] = Field(None, description="連携先アカウントのメールアドレス")


class CoachingRecordingUpsert(BaseModel):
    """コーチング録画メタデータ保存リクエスト（S3保存済みのファイルについて呼び出す想定）"""
    source: str = Field(..., pattern="^(zoom|google_meet)$", description="取得元サービス")
    s3_bucket: str = Field(..., description="保存先S3バケット名")
    s3_key: str = Field(..., description="保存先S3オブジェクトキー")
    external_recording_id: Optional[str] = Field(None, description="取得元サービス側の録画ID")
    status: str = Field("completed", pattern="^(pending|downloading|completed|failed)$", description="取得処理の状態")
