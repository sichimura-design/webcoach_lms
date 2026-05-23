"""
LangChain Tools for BFF API Integration
各BFFエンドポイントを呼び出すためのツール定義
"""
import os
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# BFFサーバーのURL
BFF_SERVER_URL = os.getenv("BFF_SERVER_URL", "http://bff-server:3001")


class BFFToolDefinition(BaseModel):
    """BFFツール定義"""
    name: str = Field(..., description="ツール名")
    description: str = Field(..., description="ツールの説明")
    endpoint: str = Field(..., description="BFF APIエンドポイント")
    method: str = Field("GET", description="HTTPメソッド")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="パラメータ定義")


# 利用可能なBFF APIツール一覧
AVAILABLE_TOOLS: List[BFFToolDefinition] = [
    BFFToolDefinition(
        name="get_user_courses",
        description="ユーザーが登録しているコース一覧を取得します",
        endpoint="/api/moodle/courses/{userid}",
        method="GET",
        parameters={
            "userid": {"type": "integer", "required": True, "description": "ユーザーID"}
        }
    ),
    BFFToolDefinition(
        name="get_course_contents",
        description="特定のコースのコンテンツ一覧を取得します",
        endpoint="/api/moodle/courses/{courseid}/contents",
        method="GET",
        parameters={
            "courseid": {"type": "integer", "required": True, "description": "コースID"}
        }
    ),
    BFFToolDefinition(
        name="get_user_profile",
        description="ユーザーのWebCoachプロフィール情報を取得します",
        endpoint="/api/webcoach/profile/{userid}",
        method="GET",
        parameters={
            "userid": {"type": "integer", "required": True, "description": "ユーザーID"}
        }
    ),
    BFFToolDefinition(
        name="get_resume_courses",
        description="ユーザーの学習再開推奨コース一覧を取得します",
        endpoint="/api/webcoach/resumecourse/{userid}",
        method="GET",
        parameters={
            "userid": {"type": "integer", "required": True, "description": "ユーザーID"},
            "limit": {"type": "integer", "required": False, "description": "取得件数"}
        }
    ),
    BFFToolDefinition(
        name="get_recommended_badges",
        description="ユーザーへのおすすめバッジ一覧を取得します",
        endpoint="/api/webcoach/recomendbadge/{userid}",
        method="GET",
        parameters={
            "userid": {"type": "integer", "required": True, "description": "ユーザーID"}
        }
    ),
    BFFToolDefinition(
        name="get_roadmaps",
        description="学習ロードマップ一覧を取得します",
        endpoint="/api/webcoach/roadmaps",
        method="GET",
        parameters={
            "category": {"type": "string", "required": False, "description": "カテゴリでフィルタ"},
            "difficulty": {"type": "string", "required": False, "description": "難易度でフィルタ"}
        }
    ),
    BFFToolDefinition(
        name="get_roadmap_detail",
        description="特定の学習ロードマップの詳細情報を取得します",
        endpoint="/api/webcoach/roadmap/{roadmapid}",
        method="GET",
        parameters={
            "roadmapid": {"type": "integer", "required": True, "description": "ロードマップID"}
        }
    ),
    BFFToolDefinition(
        name="get_user_badges",
        description="ユーザーが取得したバッジ一覧を取得します",
        endpoint="/api/moodle/user-badges/{userid}",
        method="GET",
        parameters={
            "userid": {"type": "integer", "required": True, "description": "ユーザーID"}
        }
    )
]


def get_tools_description() -> str:
    """
    Claudeに渡すツール一覧の説明を生成

    Returns:
        ツール説明文（プロンプトに埋め込む用）
    """
    tool_descriptions = []

    for tool in AVAILABLE_TOOLS:
        params_desc = []
        for param_name, param_info in tool.parameters.items():
            required = "必須" if param_info.get("required", False) else "任意"
            params_desc.append(
                f"  - {param_name} ({param_info['type']}, {required}): {param_info['description']}"
            )

        tool_desc = f"""
ツール名: {tool.name}
説明: {tool.description}
エンドポイント: {tool.method} {tool.endpoint}
パラメータ:
{chr(10).join(params_desc) if params_desc else "  なし"}
"""
        tool_descriptions.append(tool_desc.strip())

    return "\n\n".join(tool_descriptions)


def execute_tool_call(tool_name: str, arguments: Dict[str, Any], service_token: str = None) -> Dict[str, Any]:
    """
    ツール呼び出しを実行（BFF APIを呼び出す）

    Args:
        tool_name: 実行するツール名
        arguments: ツール引数
        service_token: サービスアカウントトークン（認証用）

    Returns:
        ツール実行結果
    """
    import requests

    # ツール定義を検索
    tool_def = None
    for tool in AVAILABLE_TOOLS:
        if tool.name == tool_name:
            tool_def = tool
            break

    if not tool_def:
        return {
            "success": False,
            "error": f"Unknown tool: {tool_name}"
        }

    try:
        # エンドポイントURLを構築
        endpoint = tool_def.endpoint
        for key, value in arguments.items():
            endpoint = endpoint.replace(f"{{{key}}}", str(value))

        url = f"{BFF_SERVER_URL}{endpoint}"

        # クエリパラメータを構築
        query_params = {}
        for key, value in arguments.items():
            if f"{{{key}}}" not in tool_def.endpoint:
                query_params[key] = value

        # リクエスト実行
        headers = {}
        if service_token:
            headers["Authorization"] = f"Bearer {service_token}"

        logger.info(f"Executing tool: {tool_name} -> {tool_def.method} {url}")

        if tool_def.method == "GET":
            response = requests.get(url, params=query_params, headers=headers, timeout=10)
        elif tool_def.method == "POST":
            response = requests.post(url, json=arguments, headers=headers, timeout=10)
        else:
            return {
                "success": False,
                "error": f"Unsupported HTTP method: {tool_def.method}"
            }

        response.raise_for_status()

        return {
            "success": True,
            "result": response.json()
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"Tool execution failed: {tool_name} - {e}")
        return {
            "success": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"Unexpected error in tool execution: {e}")
        return {
            "success": False,
            "error": f"Internal error: {str(e)}"
        }


def parse_tool_calls_from_response(response_text: str) -> List[Dict[str, Any]]:
    """
    Claudeのレスポンスからツール呼び出しをパース

    Note: Claudeは自然言語でツール呼び出しを表現する可能性があるため、
    パターンマッチングまたはJSON抽出でツール呼び出しを検出

    Args:
        response_text: Claudeのレスポンステキスト

    Returns:
        ツール呼び出しリスト
    """
    import re
    import json

    tool_calls = []

    # JSONブロックからツール呼び出しを抽出
    # 例: {"tool": "get_user_courses", "arguments": {"userid": 123}}
    json_pattern = r'\{[^}]*"tool"[^}]*\}'
    matches = re.findall(json_pattern, response_text, re.DOTALL)

    for match in matches:
        try:
            data = json.loads(match)
            if "tool" in data:
                tool_calls.append({
                    "name": data["tool"],
                    "arguments": data.get("arguments", {})
                })
        except json.JSONDecodeError:
            continue

    return tool_calls
