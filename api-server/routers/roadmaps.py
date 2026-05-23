"""
Roadmap endpoints
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db

router = APIRouter(prefix="/api", tags=["Roadmaps"])


@router.get(
    "/roadmaps",
    response_model=dict,
    summary="ロードマップ一覧取得"
)
def get_roadmaps(
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    ロードマップ一覧を取得します。

    Args:
        category: カテゴリでフィルタ（オプション）
        difficulty: 難易度でフィルタ（オプション）
        limit: 取得件数
        offset: オフセット

    Returns:
        ロードマップ一覧
    """
    # TODO: Implement roadmap database table and CRUD operations
    # For now, return mock data
    mock_roadmaps = []

    return {
        "total": 0,
        "roadmaps": mock_roadmaps
    }


@router.get(
    "/roadmaps/search",
    response_model=dict,
    summary="ロードマップ検索"
)
def search_roadmaps(
    keyword: str,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    キーワードでロードマップを検索します。

    Args:
        keyword: 検索キーワード
        limit: 取得件数
        offset: オフセット

    Returns:
        検索結果
    """
    # TODO: Implement roadmap search logic
    return {
        "total": 0,
        "roadmaps": []
    }


@router.get(
    "/roadmaps/category/{category}",
    response_model=dict,
    summary="カテゴリ別ロードマップ取得"
)
def get_roadmaps_by_category(
    category: str,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    特定のカテゴリのロードマップを取得します。

    Args:
        category: カテゴリ名
        limit: 取得件数
        offset: オフセット

    Returns:
        カテゴリ別ロードマップ一覧
    """
    # TODO: Implement category filtering
    return {
        "category": category,
        "total": 0,
        "roadmaps": []
    }


@router.get(
    "/rodmaps/{roadmapid}",
    response_model=dict,
    summary="特定ロードマップ詳細取得"
)
def get_roadmap_detail(
    roadmapid: int,
    db: Session = Depends(get_db)
):
    """
    特定のロードマップの詳細情報を取得します。

    Args:
        roadmapid: ロードマップID

    Returns:
        ロードマップ詳細情報（ステップ含む）
    """
    try:
        from entities.webcoach import WebCoachLearningRoadmap, WebCoachLearningRoadmapStep

        # Get roadmap details
        roadmap = db.query(WebCoachLearningRoadmap).filter(
            WebCoachLearningRoadmap.roadmap_id == roadmapid
        ).first()

        if not roadmap:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Roadmap {roadmapid} not found"
            )

        # Get roadmap steps with course information
        query = text("""
            SELECT
                s.step_number,
                s.mdl_course_id,
                c.fullname as course_fullname,
                c.shortname as course_shortname,
                c.summary as course_summary
            FROM webcoach_learning_roadmap_step s
            LEFT JOIN mdl_course c ON s.mdl_course_id = c.id
            WHERE s.roadmap_id = :roadmap_id
            ORDER BY s.step_number ASC
        """)

        result = db.execute(query, {"roadmap_id": roadmapid})
        rows = result.fetchall()

        steps = [
            {
                "step_number": row[0],
                "course_id": row[1],
                "course_fullname": row[2],
                "course_shortname": row[3],
                "course_summary": row[4]
            }
            for row in rows
        ]

        return {
            "roadmap_id": roadmap.roadmap_id,
            "name": roadmap.name,
            "category": roadmap.category,
            "required_study_time": roadmap.required_study_time,
            "icon_url": roadmap.icon_url,
            "steps": steps,
            "total_steps": len(steps)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get roadmap detail: {str(e)}"
        )


# ==========================================
# Alias Endpoints
# ==========================================

@router.get(
    "/rodmaps",
    response_model=dict,
    summary="ロードマップ一覧取得（エイリアス）"
)
def get_roadmaps_alias(
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    ロードマップ一覧取得のエイリアスエンドポイント
    /api/roadmaps と同じ
    """
    return get_roadmaps(category, difficulty, limit, offset, db)
