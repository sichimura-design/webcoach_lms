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


@router.get(
    "/ai-applications/{app_key}/intro",
    summary="AIアプリの挨拶文と最初の選択肢を取得"
)
def get_ai_application_intro_endpoint(app_key: str):
    """
    AIコーチでアプリのモードに入ったとき、画面に出す挨拶文と最初の選択肢を返します。
    Difyには会話を作らず、アプリの設定（GET /parameters）を読むだけです。

    Args:
        app_key: 一覧APIの app_key（webcoach_ai_application.secret_key）

    Returns:
        app_key / opening_statement / suggested_questions / has_choices / message
        （message は挨拶文＋選択肢ボタンの HTML。チャットの回答と同じ形で描画できる）
    """
    from agents.tools_langchain import build_dify_intro

    intro = build_dify_intro(app_key)
    if intro is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI application not found")
    return intro
