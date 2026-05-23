"""
Badge endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from crud import get_recommended_badges, get_user_issued_badges

router = APIRouter(prefix="/api", tags=["Badges"])


@router.get(
    "/users/{userid}/badges",
    response_model=dict,
    summary="ユーザーバッジ取得"
)
def get_user_badges(
    userid: int,
    db: Session = Depends(get_db)
):
    """
    ユーザーのバッジ情報を取得します。

    実際のバッジデータはMoodleから取得する必要があります。
    このエンドポイントは、BFF経由でMoodle APIを呼び出す想定です。

    Args:
        userid: ユーザーID

    Returns:
        バッジ一覧
    """
    try:
        badges = get_user_issued_badges(db, userid)

        return {
            "userid": userid,
            "total_badges": len(badges),
            "badges": badges
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user badges: {str(e)}"
        )


@router.get(
    "/recomendbadge/{userid}",
    response_model=dict,
    summary="おすすめバッジ取得"
)
def get_recommend_badges(userid: int, limit: int = 10, db: Session = Depends(get_db)):
    """
    ユーザーにおすすめのバッジを取得します。

    推薦ロジック:
    - ユーザーが最後にアクセスしたコースに関連するバッジ
    - ユーザーが未取得のバッジのみ
    - アクティブなバッジ（status=1または3）のみ
    - コースバッジを優先、次にサイトバッジ

    Args:
        userid: ユーザーID
        limit: 取得する最大件数（デフォルト: 10）

    Returns:
        おすすめバッジ一覧
    """
    try:
        badges = get_recommended_badges(db, userid, limit)

        return {
            "userid": userid,
            "recommended_badges": badges,
            "total": len(badges)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recommended badges: {str(e)}"
        )
