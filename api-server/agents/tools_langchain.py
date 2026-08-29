"""
LangChain Tools for BFF API Integration
BFF APIツールをLangChain Tool形式で定義
"""
import os
import json
import logging
from functools import lru_cache
from typing import Dict, Any, List, Optional
import requests
from langchain_core.tools import Tool, StructuredTool, BaseTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# BFFサーバーのURL
BFF_SERVER_URL = os.getenv("BFF_SERVER_URL", "http://bff-server:3001")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "default-internal-key-change-in-production")

# Dify連携設定
# APIキーは webcoach_ai_application.secret_key で指定されたキー名をもとに、
# 以下のいずれかから読み込む認証情報JSON（{"<secret_key>": "<APIキー>", ...}）から解決する。
#   1. DIFY_CREDENTIALS_JSON（ローカル開発用: JSON文字列を直接指定）
#   2. DIFY_CREDENTIALS_SECRET_ID（AWS Secrets Managerのシークレット名/ARN）
DIFY_API_BASE_URL = os.getenv("DIFY_API_BASE_URL", "https://api.dify.ai/v1")
DIFY_CREDENTIALS_JSON = os.getenv("DIFY_CREDENTIALS_JSON")
DIFY_CREDENTIALS_SECRET_ID = os.getenv("DIFY_CREDENTIALS_SECRET_ID")


@lru_cache(maxsize=1)
def _load_dify_credentials() -> Dict[str, str]:
    """Dify認証情報（アプリのsecret_key -> APIキー）を読み込む（プロセス内キャッシュ）"""
    if DIFY_CREDENTIALS_JSON:
        try:
            return json.loads(DIFY_CREDENTIALS_JSON)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse DIFY_CREDENTIALS_JSON: {e}")
            return {}

    if not DIFY_CREDENTIALS_SECRET_ID:
        return {}

    try:
        import boto3
        client = boto3.client("secretsmanager", region_name=os.getenv("AWS_REGION", "ap-northeast-1"))
        response = client.get_secret_value(SecretId=DIFY_CREDENTIALS_SECRET_ID)
        return json.loads(response["SecretString"])
    except Exception as e:
        logger.error(f"Failed to load Dify credentials from Secrets Manager: {e}")
        return {}


def _get_dify_api_key(secret_key: str) -> Optional[str]:
    """secret_keyに対応するDify APIキーを取得"""
    return _load_dify_credentials().get(secret_key)


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


class AskAiApplicationInput(BaseModel):
    """AIアプリケーション連携ツールの入力"""
    query: str = Field(..., description="AIアプリに問い合わせる質問内容")
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


# Dify会話の継続用キャッシュ（(userid, app_id) -> conversation_id）。
# プロセス内メモリのみ。複数コンテナ構成やコンテナ再起動をまたぐ継続には対応しない。
_dify_conversation_cache: Dict[tuple, str] = {}


def _call_dify_chat(query: str, userid: int, api_key: str, app_id: int) -> str:
    """Dify上に構築されたAIアプリに問い合わせる（同一ユーザー・同一アプリの会話はプロセス内で継続する）"""
    conversation_id = _dify_conversation_cache.get((userid, app_id), "")
    try:
        response = requests.post(
            f"{DIFY_API_BASE_URL}/chat-messages",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "inputs": {},
                "query": query,
                "response_mode": "blocking",
                "conversation_id": conversation_id,
                "user": f"webcoach-user-{userid}",
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        new_conversation_id = data.get("conversation_id")
        if new_conversation_id:
            _dify_conversation_cache[(userid, app_id)] = new_conversation_id

        return data.get("answer", "")

    except requests.exceptions.RequestException as e:
        logger.error(f"Dify API call failed: {e}")
        return f"Difyへの問い合わせに失敗しました: {str(e)}"


def create_ai_application_tools(db) -> List[BaseTool]:
    """
    DBに登録済みのAIアプリケーション（webcoach_ai_application.secret_keyが設定されているもの）を
    LangChain Toolとして動的に生成する。

    secret_keyに対応するAPIキーがSecrets Manager等の認証情報から見つからない場合はスキップする。
    """
    from entities.webcoach import WebCoachAIApplication

    tools: List[Tool] = []
    apps = db.query(WebCoachAIApplication).filter(
        WebCoachAIApplication.secret_key.isnot(None)
    ).all()

    for app in apps:
        api_key = _get_dify_api_key(app.secret_key)
        if not api_key:
            logger.warning(f"No credential found for AI application '{app.name}' (secret_key={app.secret_key})")
            continue

        def make_func(api_key: str = api_key, app_id: int = app.id):
            def _call(query: str, userid: int) -> str:
                return _call_dify_chat(query, userid, api_key, app_id)
            return _call

        tools.append(
            StructuredTool.from_function(
                name=f"ask_ai_application_{app.id}",
                description=f"「{app.name}」（{app.category}）に問い合わせます。{app.description}",
                func=make_func(),
                args_schema=AskAiApplicationInput
            )
        )

    return tools


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
