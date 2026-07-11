"""
LangChain Tools for BFF API Integration
BFF APIツールをLangChain Tool形式で定義
"""
import os
import logging
from typing import Dict, Any, List, Optional
import requests
from langchain_core.tools import Tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# BFFサーバーのURL
BFF_SERVER_URL = os.getenv("BFF_SERVER_URL", "http://bff-server:3001")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "default-internal-key-change-in-production")


# ツール入力スキーマ定義
class GetUserCoursesInput(BaseModel):
    """ユーザーコース取得ツールの入力"""
    userid: int = Field(..., description="ユーザーID")


class GetCourseContentsInput(BaseModel):
    """コースコンテンツ取得ツールの入力"""
    courseid: int = Field(..., description="コースID")


class GetUserProfileInput(BaseModel):
    """ユーザープロフィール取得ツールの入力"""
    userid: int = Field(..., description="ユーザーID")


class GetResumeCoursesInput(BaseModel):
    """再開推奨コース取得ツールの入力"""
    userid: int = Field(..., description="ユーザーID")
    limit: Optional[int] = Field(5, description="取得件数")


class GetRecommendedBadgesInput(BaseModel):
    """おすすめバッジ取得ツールの入力"""
    userid: int = Field(..., description="ユーザーID")


class GetRoadmapsInput(BaseModel):
    """ロードマップ一覧取得ツールの入力"""
    category: Optional[str] = Field(None, description="カテゴリでフィルタ")
    difficulty: Optional[str] = Field(None, description="難易度でフィルタ")


class GetRoadmapDetailInput(BaseModel):
    """ロードマップ詳細取得ツールの入力"""
    roadmapid: int = Field(..., description="ロードマップID")


class GetUserBadgesInput(BaseModel):
    """ユーザーバッジ取得ツールの入力"""
    userid: int = Field(..., description="ユーザーID")


# ツール実行関数
def _call_bff_api(
    endpoint: str,
    method: str = "GET",
    path_params: Dict[str, Any] = None,
    query_params: Dict[str, Any] = None,
    service_token: str = None
) -> Dict[str, Any]:
    """BFF APIを呼び出す共通関数"""
    try:
        # エンドポイントURLを構築
        url = f"{BFF_SERVER_URL}{endpoint}"

        # パスパラメータを置換
        if path_params:
            for key, value in path_params.items():
                url = url.replace(f"{{{key}}}", str(value))

        # ヘッダー設定 - 内部APIキーを使用
        headers = {
            "X-Internal-API-Key": INTERNAL_API_KEY
        }
        if service_token:
            headers["Authorization"] = f"Bearer {service_token}"

        logger.info(f"Calling BFF API: {method} {url}")

        # リクエスト実行
        if method == "GET":
            response = requests.get(url, params=query_params, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=query_params, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        response.raise_for_status()
        return response.json()

    except requests.exceptions.RequestException as e:
        logger.error(f"BFF API call failed: {e}")
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Unexpected error in BFF API call: {e}")
        return {"error": f"Internal error: {str(e)}"}


def get_user_courses(userid: int) -> str:
    """ユーザーが登録しているコース一覧を取得"""
    result = _call_bff_api(
        endpoint="/api/moodle/courses/{userid}",
        path_params={"userid": userid}
    )
    return str(result)


def get_course_contents(courseid: int) -> str:
    """コースのコンテンツ一覧を取得"""
    result = _call_bff_api(
        endpoint="/api/moodle/courses/{courseid}/contents",
        path_params={"courseid": courseid}
    )
    return str(result)


def get_user_profile(userid: int) -> str:
    """ユーザーのWebCoachプロフィール情報を取得"""
    result = _call_bff_api(
        endpoint="/api/webcoach/profile/{userid}",
        path_params={"userid": userid}
    )
    return str(result)


def get_resume_courses(userid: int, limit: int = 5) -> str:
    """学習再開推奨コース一覧を取得"""
    result = _call_bff_api(
        endpoint="/api/webcoach/resumecourse/{userid}",
        path_params={"userid": userid},
        query_params={"limit": limit} if limit else None
    )
    return str(result)


def get_recommended_badges(userid: int) -> str:
    """おすすめバッジ一覧を取得"""
    result = _call_bff_api(
        endpoint="/api/webcoach/recomendbadge/{userid}",
        path_params={"userid": userid}
    )
    return str(result)


def get_roadmaps(category: str = None, difficulty: str = None) -> str:
    """学習ロードマップ一覧を取得"""
    query_params = {}
    if category:
        query_params["category"] = category
    if difficulty:
        query_params["difficulty"] = difficulty

    result = _call_bff_api(
        endpoint="/api/webcoach/roadmaps",
        query_params=query_params if query_params else None
    )
    return str(result)


def get_roadmap_detail(roadmapid: int) -> str:
    """学習ロードマップの詳細情報を取得"""
    result = _call_bff_api(
        endpoint="/api/webcoach/roadmap/{roadmapid}",
        path_params={"roadmapid": roadmapid}
    )
    return str(result)


def get_user_badges(userid: int) -> str:
    """ユーザーが取得したバッジ一覧を取得"""
    result = _call_bff_api(
        endpoint="/api/moodle/user-badges/{userid}",
        path_params={"userid": userid}
    )
    return str(result)


# LangChain Tools定義
def create_bff_tools() -> List[Tool]:
    """BFF APIツールのリストを作成"""

    tools = [
        Tool(
            name="get_user_courses",
            description="ユーザーが登録しているコース一覧を取得します。ユーザーがどのコースを受講しているか確認する際に使用します。",
            func=get_user_courses,
            args_schema=GetUserCoursesInput
        ),
        Tool(
            name="get_course_contents",
            description="特定のコースのコンテンツ一覧（セクション、モジュール）を取得します。コースに何が含まれているか確認する際に使用します。",
            func=get_course_contents,
            args_schema=GetCourseContentsInput
        ),
        Tool(
            name="get_user_profile",
            description="ユーザーのWebCoachプロフィール情報（学習進捗、最終アクセス時刻、学習時間など）を取得します。ユーザーの学習状況を確認する際に使用します。",
            func=get_user_profile,
            args_schema=GetUserProfileInput
        ),
        Tool(
            name="get_resume_courses",
            description="ユーザーの学習再開推奨コース一覧を取得します。どのコースを再開すべきか提案する際に使用します。",
            func=get_resume_courses,
            args_schema=GetResumeCoursesInput
        )
    ]

    return tools
