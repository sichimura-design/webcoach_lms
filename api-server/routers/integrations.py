"""
Coach meeting (Zoom / Google Meet) integration endpoints

トークンはbff-server側で暗号化されて渡ってくるため、ここでは暗号化済みの
文字列としてそのまま保存・返却する。復号ロジックはbff-server側にのみ存在する。
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dto.request import CoachMeetingIntegrationUpsert
from dto.response import CoachMeetingIntegrationResponse, CoachMeetingIntegrationStatusResponse
from crud import upsert_coach_meeting_integration, get_coach_meeting_integrations

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coaching/integrations", tags=["Coaching Integrations"])


@router.put(
    "/{coach_user_id}",
    response_model=CoachMeetingIntegrationResponse,
    summary="コーチのミーティング連携トークンを保存"
)
def upsert_integration(
    coach_user_id: int,
    request: CoachMeetingIntegrationUpsert,
    db: Session = Depends(get_db)
):
    """
    コーチのZoom/Google Meet連携トークンを保存します（既存の場合は更新）。

    Args:
        coach_user_id: コーチのMoodleユーザーID
        request: 連携トークン保存リクエスト（トークンは暗号化済み）
        db: Database session

    Returns:
        保存された連携情報（トークン本体は含まない）
    """
    try:
        integration = upsert_coach_meeting_integration(
            db=db,
            coach_user_id=coach_user_id,
            provider=request.provider,
            access_token_enc=request.access_token,
            refresh_token_enc=request.refresh_token,
            token_expires_at=request.expires_at,
            scope=request.scope,
            provider_account_email=request.provider_account_email,
        )
        return integration
    except Exception as e:
        logger.error(f"Failed to save meeting integration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save integration"
        )


@router.get(
    "/{coach_user_id}",
    response_model=CoachMeetingIntegrationStatusResponse,
    summary="コーチのミーティング連携状態を取得"
)
def get_integration_status(
    coach_user_id: int,
    db: Session = Depends(get_db)
):
    """
    コーチのZoom/Google Meet連携状態を取得します（トークン本体は含まない）。

    Args:
        coach_user_id: コーチのMoodleユーザーID
        db: Database session

    Returns:
        連携状態一覧
    """
    integrations = get_coach_meeting_integrations(db=db, coach_user_id=coach_user_id)
    return CoachMeetingIntegrationStatusResponse(
        coach_user_id=coach_user_id,
        integrations=integrations
    )
