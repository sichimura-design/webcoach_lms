"""
Tags and AI Applications endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from database import get_db
from dto.response import AIApplicationListResponse

router = APIRouter(prefix="/api", tags=["Tags & AI Applications"])


@router.get(
    "/ai-applications",
    response_model=AIApplicationListResponse,
    summary="AIアプリケーション一覧を取得"
)
def get_ai_applications_endpoint(
    category: Optional[str] = Query(None, description="カテゴリでフィルタ"),
    limit: int = Query(20, description="取得件数", ge=1, le=100),
    offset: int = Query(0, description="オフセット", ge=0),
    db: Session = Depends(get_db)
) -> AIApplicationListResponse:
    """
    AIアプリケーション一覧を取得します。

    Args:
        category: カテゴリフィルタ（オプション）
        limit: 取得件数
        offset: オフセット

    Returns:
        AIアプリケーション一覧
    """
    try:
        from crud import get_ai_applications
        from entities.webcoach import WebCoachAIApplication

        # 総数を取得
        total_query = db.query(WebCoachAIApplication)
        if category:
            total_query = total_query.filter(WebCoachAIApplication.category == category)
        total = total_query.count()

        # アプリケーション一覧を取得
        applications = get_ai_applications(db, category=category, limit=limit, offset=offset)

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "applications": applications
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get AI applications: {str(e)}"
        )
