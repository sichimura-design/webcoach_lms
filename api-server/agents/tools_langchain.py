"""
LangChain Tools for BFF API Integration
BFF APIツールをLangChain Tool形式で定義
"""
import os
import json
import base64
import html
import logging
import re
import time
from functools import lru_cache
from typing import Dict, Any, List, Optional
import requests
from langchain_core.tools import Tool, StructuredTool, BaseTool
from pydantic import BaseModel, Field

from agents.run_control import ChatCancelled, get_run
from agents.usage_log import log_ai_usage

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


@lru_cache(maxsize=64)
def _get_dify_parameters(api_key: str) -> Dict[str, Any]:
    """DifyアプリのGET /parameters（suggested_questions・必須入力フォーム定義等）を取得

    アプリ側の設定を変えても反映にはプロセス再起動が必要（_load_dify_credentialsと同様の
    プロセス内キャッシュ）。
    """
    try:
        response = requests.get(
            f"{DIFY_API_BASE_URL}/parameters",
            headers={"Authorization": f"Bearer {api_key}"},
            params={"user": "webcoach-system"},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.warning(f"Failed to fetch Dify /parameters: {e}")
        return {}


_DIFY_FORM_RE = re.compile(r"<form\b[\s\S]*?</form>", re.IGNORECASE)
_DIFY_BUTTON_BLOCK_RE = re.compile(r"<div\b[^>]*>(?:(?!</div>)[\s\S])*?<button\b[\s\S]*?</div>", re.IGNORECASE)
_DIFY_BUTTON_RE = re.compile(r"<button\b[\s\S]*?</button>", re.IGNORECASE)


def _with_opening_statement(answer: str, api_key: str) -> str:
    """新しい会話の最初の応答の前に、アプリの挨拶文（opening_statement）を付ける。

    Dify標準UIは会話の最初に挨拶文を出すが、WebCoachはユーザーの最初の発言をそのまま
    送るので見えていなかった。挨拶文で用語や入力例を説明しているアプリ（デザイン
    フィードバックメンターProの「プロジェクトの情報」等）では、説明の無いまま
    「プロジェクトの概要をおしえてください」とだけ返ってきて意味が通じなかった。
    応答側にもボタン・フォームがあるときは、選択肢が二重にならないよう挨拶文の側を外す。
    """
    opening = (_get_dify_parameters(api_key).get("opening_statement") or "").strip()
    if not opening:
        return answer
    if "<button" in answer or "<form" in answer:
        opening = _DIFY_FORM_RE.sub("", opening)
        opening = _DIFY_BUTTON_BLOCK_RE.sub("", opening)
        opening = _DIFY_BUTTON_RE.sub("", opening)
        opening = re.sub(r"\n{3,}", "\n\n", opening).strip()
    if not opening or opening in answer:
        return answer
    return f"{opening}\n\n{answer}"


def build_dify_intro(secret_key: str) -> Optional[Dict[str, Any]]:
    """アプリのモードに入ったとき画面に出す、挨拶文と最初の選択肢（Difyには何も送らない）。

    Dify標準UIと同じく、会話の最初は挨拶文と選択肢(suggested_questions)を見せ、利用者が
    選んだ文言を最初の発言として送らせる。流れに沿って進むアプリ（応募文メーカー等）は
    最初の発言が選択肢と一致しないと分岐が決まらず、その会話では以後ずっと空応答になる。
    has_choices は選択肢（suggested_questions、または挨拶文の中のボタン）があるか。
    APIキーが無いアプリは None。
    """
    api_key = _get_dify_api_key(secret_key) if secret_key else None
    if not api_key:
        return None
    params = _get_dify_parameters(api_key)
    opening = (params.get("opening_statement") or "").strip()
    questions = [q for q in (params.get("suggested_questions") or []) if q and q.strip()]
    has_buttons_in_opening = "data-message=" in opening
    message = opening
    if questions and not has_buttons_in_opening:
        buttons = "\n".join(f'  <button data-message="{html.escape(q, quote=True)}">{html.escape(q)}</button>' for q in questions)
        message = f"{opening}\n\n<div>\n{buttons}\n</div>".strip()
    return {
        "app_key": secret_key,
        "opening_statement": opening,
        "suggested_questions": questions,
        "has_choices": bool(questions) or has_buttons_in_opening,
        "message": message,
    }


def _render_suggested_questions_html(questions: List[str]) -> str:
    """suggested_questionsを、フロントエンドが解釈できる<button data-message>形式で描画する"""
    buttons = "\n".join(
        f'  <button data-message="{q}">{q}</button>' for q in questions
    )
    return (
        "下記から選んでください👇\n\n"
        f"<div>\n{buttons}\n</div>"
    )


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
    """AIアプリケーション連携ツールの入力

    この引数スキーマはDB登録アプリの数だけ（全ツールに同じものが）LLMへ送られるため、
    説明文は短くし、判断基準（start_new_conversation/extra_inputsの使い方）は
    learning_coach_agent.agent_nodeのシステムプロンプトに1回だけ書く。
    """
    # 実際にDifyへ送る内容には使わない（ユーザーの発言をそのまま送るため）。
    # ツール呼び出しのスキーマ上必要なため残しているが、値は無視される。
    query: str = Field(..., description="問い合わせ内容")
    userid: int = Field(..., description="ユーザーID")
    start_new_conversation: bool = Field(
        False, description="会話を最初からやり直すときだけtrue（基準はシステムプロンプト参照）"
    )
    extra_inputs: Optional[Dict[str, str]] = Field(
        None, description="ツール説明にある入力項目の値（キーは項目名）。不要なら省略"
    )


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


# Dify会話の継続用キャッシュ（(userid, app_id, session_id) -> conversation_id）。
# session_idはフロント側のチャット単位（例: レッスンごと、常設ドロワー）で、
# 「新しい相談を始める」等で別セッションになった場合はキーごと別物になるため、
# 以前の検索条件を引き継がない。session_idを渡さない呼び出し元は従来通り
# userid+app_id単位で共有される（Noneも通常の辞書キーとして機能する）。
# プロセス内メモリのみ。複数コンテナ構成やコンテナ再起動をまたぐ継続には対応しない。
_dify_conversation_cache: Dict[tuple, str] = {}

# ユーザー自身がやり直しをはっきり言ったときの言い回し
_DIFY_RESTART_RE = re.compile(r"新しく|新たに|最初から|はじめから|始めから|一から|やり直|別の条件|リセット")


def _should_reset_dify_conversation(message: str, requested: bool) -> bool:
    """LLMが付けた start_new_conversation を、ユーザーの発言で裏付けが取れたときだけ通す。

    システムプロンプトで「明示的なやり直しのときだけtrue」と指示していても、続きの回答
    （デザインスプリントで業種に「飲食店」と答えた等）にtrueを付けることがあり、Difyが
    最初の質問に戻っていた（B-008）。やり直しの判断はLLMに任せず、発言の言葉で決める。
    """
    return bool(requested and message and _DIFY_RESTART_RE.search(message))

# 直前のターンでユーザーが実際に呼び出したDifyアプリ（(userid, session_id) -> app_id）。
# 会話履歴(conversation_history)はロールとテキストのみをやり取り相手に送っており
# どのask_ai_application_*ツールを使ったかの情報が失われるため、似た説明を持つ
# 複数の案件抽出アプリ（Crowdworks/Lancers/ココナラ等）の間でLLMが毎ターン
# 選び直してしまい、Dify側の会話が意図せずリセットされる問題への対策。
# プロセス内メモリのみ。
_dify_sticky_app_cache: Dict[tuple, int] = {}

# 直前のDify応答に含まれていたボタンの値（(userid, session_id) -> {data-message値}）。
# 次の発言がこのいずれかと一致した場合は、間にチャットのAIが答えたターンがあっても
# 直前のアプリへツール選択を強制する（ボタン値の完全一致で進むステップ形式のフローを
# 確実に続けるため）。自由入力の扱いは_dify_idle_turns_cache参照。
# プロセス内メモリのみ。
_dify_last_buttons_cache: Dict[tuple, set] = {}

# 直前のDify呼び出しから、Difyを使わずに終わったターンの数（(userid, session_id) -> 回数）。
# 0（直前のターンがDify）なら、Difyが答えを待っている途中なので自由入力もそのアプリへ送る。
# チャットのAIが自分で答えたターンがあっても1回だけなら固定を解かず「続きなら同じアプリを」と
# 伝え続け、_STICKY_IDLE_LIMIT回続いたら案件検索等のフローが終わったとみなして解除する。
# プロセス内メモリのみ。
_dify_idle_turns_cache: Dict[tuple, int] = {}
_STICKY_IDLE_LIMIT = 2

_BUTTON_VALUE_RE = re.compile(r'<button\b[^>]*\bdata-message="([^"]*)"', re.IGNORECASE)


def _extract_button_values(answer: str) -> set:
    """Dify応答（またはフォールバックで組み立てたボタンHTML）からボタンの送信値を抜き出す"""
    return {html.unescape(v).strip() for v in _BUTTON_VALUE_RE.findall(answer or "") if v.strip()}


# 必須入力変数(extra_inputs)のセッション内キャッシュ（(userid, app_id, session_id) -> inputs辞書）。
# LLMには「一度聞き取ったら以降の全ターンでextra_inputsに設定し続けること」と指示しているが、
# 実際には省略してしまうことがあり(非決定的)、その場合Difyがrequired変数不足で
# 400 invalid_paramを返し「一時的なエラー」としてユーザーに見えていた。LLMの記憶に頼らず、
# 一度渡された値をサーバー側で覚えておき、以降の呼び出しで自動的に補完する。
_dify_extra_inputs_cache: Dict[tuple, Dict[str, str]] = {}

# 必須入力変数が空のまま新しい会話を始めようとしたときの、保留中の最初の発言
# （(userid, app_id, session_id) -> 発言）。AI面接シミュレーターの job_posting（求人URL）は
# Dify標準画面では会話前のフォームで入れる項目で、会話の中では尋ねられない。空のまま送ると
# 求人なしで面接が始まってしまうため、Difyへ送る前にURLを1回だけ尋ね、その間この発言を預かる。
# 値は (発言, opening_shown)。画面が挨拶文を出したかは尋ねたターンの情報なので一緒に預かる
_dify_pending_first_message: Dict[tuple, "tuple[str, bool]"] = {}

# 「URLなしで始める」を選んだ会話（(userid, app_id, session_id)）。以降は尋ねない
_dify_inputs_skipped: set = set()

_SKIP_REQUIRED_INPUTS_MESSAGE = "URLなしで始める"
_URL_RE = re.compile(r"https?://[^\s<>\"'）」、。]+")


def _required_input_fields(api_key: str) -> List[Dict[str, Any]]:
    """Dify側でrequired: trueな入力変数の定義（variable/label等）"""
    return [
        field
        for form_item in (_get_dify_parameters(api_key).get("user_input_form") or [])
        for _, field in form_item.items()
        if field.get("required")
    ]


def _ask_required_inputs_html(fields: List[Dict[str, Any]]) -> str:
    """必須入力変数（求人URL等）を尋ねる文面と「URLなしで始める」ボタン"""
    # ラベルは「求人情報のURL」のような名前のことも、「求人情報のURLを入力してください 【必須】」の
    # ような文のこともある（AI面接シミュレーターは後者）
    label = re.sub(r"[【\[(（]\s*必須\s*[】\])）]", "", fields[0].get("label") or "").strip()
    if not label:
        label = "参考情報"
    if label.endswith("ください"):
        ask = re.sub(r"(を)?入力してください$", "を貼ってください", label)
    else:
        target = label if "URL" in label.upper() else f"{label}のURL"
        ask = f"{target}を貼ってください"
    return (
        f"はじめに、{ask}。\n\n"
        f'<div>\n  <button data-message="{_SKIP_REQUIRED_INPUTS_MESSAGE}">{_SKIP_REQUIRED_INPUTS_MESSAGE}</button>\n</div>'
    )


# Difyへアップロード済みの画像ID（(userid, app_id, session_id) -> upload_file_id）。
# 「デザインフィードバックメンターPro」等の添削アプリは、画像を受け取っても最初に
# プロジェクトの概要を聞き返してから添削に進む。ユーザーがその質問に答えるターンには
# 画像が添付されていないため、同じ会話のあいだは最後に受け取った画像を送り続ける。
# プロセス内メモリのみ（_dify_conversation_cache と同じ思想）。
_dify_image_cache: Dict[tuple, str] = {}

# api-server のフロントからの添付画像と拡張子の対応（Difyのアップロードはファイル名の拡張子で種別を判定する）
_IMAGE_EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}


def _dify_accepts_images(api_key: str) -> bool:
    """Dify側アプリで画像のファイルアップロードが有効か（GET /parameters の file_upload）"""
    file_upload = _get_dify_parameters(api_key).get("file_upload") or {}
    if file_upload.get("enabled"):
        return "image" in (file_upload.get("allowed_file_types") or [])
    # 旧形式の設定（file_upload.image.enabled）
    return bool((file_upload.get("image") or {}).get("enabled"))


def _upload_image_to_dify(api_key: str, userid: int, image: Dict[str, str]) -> Optional[str]:
    """添付画像（{"media_type", "data"(base64)}）をDifyへアップロードし、upload_file_idを返す。失敗時はNone"""
    media_type = image.get("media_type", "image/png")
    try:
        content = base64.b64decode(image.get("data", ""))
        response = requests.post(
            f"{DIFY_API_BASE_URL}/files/upload",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (f"upload.{_IMAGE_EXTENSIONS.get(media_type, 'png')}", content, media_type)},
            data={"user": f"webcoach-user-{userid}"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json().get("id")
    except (requests.exceptions.RequestException, ValueError) as e:
        logger.error(f"Dify file upload failed: {e}")
        return None


def get_sticky_dify_app_id(userid: int, session_id: Optional[str] = None) -> Optional[int]:
    """このユーザー・このセッションが直前に使っていたDifyアプリのapp_idを取得（無ければNone）"""
    return _dify_sticky_app_cache.get((userid, session_id))


def clear_sticky_dify_app(userid: int, session_id: Optional[str] = None) -> None:
    """Difyツールを使わずにターンが完了した場合、次ターンでのツール固定を解除する"""
    _dify_sticky_app_cache.pop((userid, session_id), None)
    _dify_last_buttons_cache.pop((userid, session_id), None)
    _dify_idle_turns_cache.pop((userid, session_id), None)


def note_turn_without_dify(userid: int, session_id: Optional[str] = None) -> None:
    """Difyツールを使わずにターンが完了したことを記録し、続いたら次ターンでのツール固定を解除する

    1回で解除すると、Difyの聞き取りの途中でチャットのAIが自分で答えてしまったとき、
    以降の発言がDifyへ届かなくなり、Dify側は途中の条件を知らないままになる。
    """
    key = (userid, session_id)
    if key not in _dify_sticky_app_cache:
        return
    idle = _dify_idle_turns_cache.get(key, 0) + 1
    if idle >= _STICKY_IDLE_LIMIT:
        clear_sticky_dify_app(userid, session_id)
    else:
        _dify_idle_turns_cache[key] = idle


# Difyの1回の問い合わせ全体の上限。実検索で72秒かかった例がある。異常に長時間化した場合の安全弁
DIFY_TOTAL_TIMEOUT_SECONDS = 120


class DifyStreamError(requests.exceptions.RequestException):
    """ストリーミング応答の途中でDifyが error イベントを返した"""


def _stop_dify_task(api_key: str, task_id: str, userid: int) -> None:
    """Difyの生成を止める（POST /chat-messages/{task_id}/stop）"""
    requests.post(
        f"{DIFY_API_BASE_URL}/chat-messages/{task_id}/stop",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"user": f"webcoach-user-{userid}"},
        timeout=10,
    )


def _read_dify_stream(response, api_key: str, userid: int, run=None, on_conversation_id=None) -> Dict[str, Any]:
    """Difyのストリーミング応答（SSE）を読み、blockingモードと同じ形の辞書にして返す。

    - 最初に届いた task_id で、run（「生成を中止」）にDifyの停止処理を登録する
    - conversation_id は届いた時点で on_conversation_id に渡す（中止しても会話を続けられるように）
    - 中止されたら受信を打ち切って ChatCancelled、全体の上限を超えたらDifyを止めて Timeout
    """
    deadline = time.monotonic() + DIFY_TOTAL_TIMEOUT_SECONDS
    answer = ""
    conversation_id = None
    metadata: Dict[str, Any] = {}
    task_id = None
    try:
        for raw in response.iter_lines():
            if run is not None and run.cancelled:
                raise ChatCancelled()
            if time.monotonic() > deadline:
                if task_id:
                    try:
                        _stop_dify_task(api_key, task_id, userid)
                    except requests.exceptions.RequestException as e:
                        logger.warning(f"Failed to stop timed-out Dify task: {e}")
                raise requests.exceptions.Timeout(f"Dify did not finish within {DIFY_TOTAL_TIMEOUT_SECONDS}s")
            if not raw:
                continue
            line = raw.decode("utf-8") if isinstance(raw, bytes) else raw
            if not line.startswith("data:"):
                continue
            try:
                event = json.loads(line[5:].strip())
            except ValueError:
                continue

            if not task_id and event.get("task_id"):
                task_id = event["task_id"]
                if run is not None:
                    run.set_dify_stopper(lambda t=task_id: _stop_dify_task(api_key, t, userid))
            if not conversation_id and event.get("conversation_id"):
                conversation_id = event["conversation_id"]
                if on_conversation_id:
                    on_conversation_id(conversation_id)

            kind = event.get("event")
            if kind in ("message", "agent_message"):
                answer += event.get("answer") or ""
            elif kind == "message_replace":
                answer = event.get("answer") or ""
            elif kind == "message_end":
                metadata = event.get("metadata") or {}
            elif kind == "error":
                raise DifyStreamError(f"Dify stream error: {event.get('code')} {event.get('message')}")
    finally:
        if run is not None:
            run.set_dify_stopper(None)
        response.close()

    # 停止APIで止まった場合、ストリームは正常に閉じるので、ここでも中止を確かめる
    if run is not None and run.cancelled:
        raise ChatCancelled()
    return {"answer": answer, "conversation_id": conversation_id, "metadata": metadata}


def _call_dify_chat(
    query: str,
    userid: int,
    api_key: str,
    app_id: int,
    reset: bool = False,
    inputs: Optional[Dict[str, str]] = None,
    session_id: Optional[str] = None,
    image: Optional[Dict[str, str]] = None,
    run_id: Optional[str] = None,
    opening_shown: bool = False,
) -> str:
    """Dify上に構築されたAIアプリに問い合わせる（同一ユーザー・同一アプリ・同一セッションの
    会話はプロセス内で継続する）

    reset=Trueの場合、キャッシュ済みのconversation_idを使わず新規の会話として送信する
    （ユーザーが前回までの条件を引き継がず新しく検索し直したい場合の入口）。

    image（{"media_type", "data"(base64)}）が渡され、Dify側アプリで画像アップロードが
    有効な場合は、Difyへアップロードしてfilesとして添付する。以降のターンで画像が
    無くても、同じ会話のあいだは最後の画像を添付し続ける（_dify_image_cache参照）。

    run_id（agents/run_control）で「生成を中止」されたら、Difyの停止APIを呼んで
    ChatCancelled を送出する。途中までの会話はDify側に残るので、conversation_idは
    受け取った時点で覚え、次の発言はその続きとして送る。
    """
    cache_key = (userid, app_id, session_id)
    conversation_id = "" if reset else _dify_conversation_cache.get(cache_key, "")
    _dify_sticky_app_cache[(userid, session_id)] = app_id
    _dify_idle_turns_cache.pop((userid, session_id), None)

    # extra_inputsはLLMが送り忘れることがあるため、一度渡された値をセッション単位で
    # 覚えておき、今回省略されていてもマージして補う（新しい値が来れば上書きする）。
    if reset:
        _dify_extra_inputs_cache.pop(cache_key, None)
        _dify_pending_first_message.pop(cache_key, None)
        _dify_inputs_skipped.discard(cache_key)
    stored_inputs = {} if reset else _dify_extra_inputs_cache.get(cache_key, {})
    merged_inputs = {**stored_inputs, **{k: v for k, v in (inputs or {}).items() if v}}

    # 発言にURLがあれば、まだ値の無い必須変数（求人URL等）に入れる。LLMがextra_inputsに
    # 設定するかどうかに頼らない（ボタン押下等でLLMを通らないターンもある）
    required_fields = _required_input_fields(api_key)
    missing_fields = [f for f in required_fields if not merged_inputs.get(f["variable"])]
    url_match = _URL_RE.search(query or "")
    if url_match and missing_fields:
        merged_inputs[missing_fields[0]["variable"]] = url_match.group(0)
        missing_fields = missing_fields[1:]
    if merged_inputs:
        _dify_extra_inputs_cache[cache_key] = merged_inputs

    # 必須変数が空のまま新しい会話を始めるときは、Difyへ送る前に1回だけ尋ねる。
    # 答え（URL／「URLなしで始める」／それ以外の発言）が来たら、預かった最初の発言で始める。
    # 2回目は尋ねない（以前、聞き取りが終わるまで呼ばない作りで同じ質問を繰り返していた）
    pending = _dify_pending_first_message.pop(cache_key, None)
    if not conversation_id and missing_fields and cache_key not in _dify_inputs_skipped:
        if pending is None:
            _dify_pending_first_message[cache_key] = (query, opening_shown)
            answer = _ask_required_inputs_html(missing_fields)
            _dify_last_buttons_cache[(userid, session_id)] = _extract_button_values(answer)
            return answer
        _dify_inputs_skipped.add(cache_key)
    if pending is not None:
        opening_shown = opening_shown or pending[1]
        if url_match or query.strip() == _SKIP_REQUIRED_INPUTS_MESSAGE:
            query = pending[0]

    # Dify側でrequired: trueな入力変数は、キー自体が送信データに存在しないと
    # （値が空文字であっても）400 invalid_paramで弾かれる。「URLなしで始める」を選んだ場合等、
    # 未取得の必須変数は空文字で埋めて送信する。
    # ここではキャッシュ(_dify_extra_inputs_cache)には反映せず、実送信データのみ補う。
    required_vars = [field["variable"] for field in required_fields]
    request_inputs = dict(merged_inputs)
    for var in required_vars:
        request_inputs.setdefault(var, "")

    if reset:
        _dify_image_cache.pop(cache_key, None)
    if image and _dify_accepts_images(api_key):
        upload_file_id = _upload_image_to_dify(api_key, userid, image)
        if upload_file_id:
            _dify_image_cache[cache_key] = upload_file_id
    upload_file_id = _dify_image_cache.get(cache_key)
    files = (
        [{"type": "image", "transfer_method": "local_file", "upload_file_id": upload_file_id}]
        if upload_file_id
        else []
    )

    # 利用ログ（agents/usage_log.py）。status/トークン/コストは応答に応じて埋める
    usage_fields: Dict[str, Any] = {
        "user_id": userid,
        "app_id": app_id,
        "session_id": session_id,
        "new_conversation": not conversation_id,
        "has_image": bool(files),
        "message_chars": len(query),
    }
    started_at = time.monotonic()

    try:
        run = get_run(run_id)
        if run is not None:
            run.raise_if_cancelled()
        # 「生成を中止」でDifyの停止APIを呼ぶには task_id が要り、task_id はストリーミングでしか
        # 受け取れないため streaming で呼ぶ。応答は blocking と同じ形（answer/conversation_id/metadata）に組み直す。
        response = requests.post(
            f"{DIFY_API_BASE_URL}/chat-messages",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "inputs": request_inputs,
                "query": query,
                "response_mode": "streaming",
                "conversation_id": conversation_id,
                "user": f"webcoach-user-{userid}",
                **({"files": files} if files else {}),
            },
            stream=True,
            # 読み取りのタイムアウトはイベント間の無通信時間。Difyは処理中も10秒ごとにpingを送る。
            # 全体の上限（実検索で72秒かかった例がある）は _read_dify_stream の DIFY_TOTAL_TIMEOUT_SECONDS で見る
            timeout=(10, 60),
        )
        response.raise_for_status()

        def remember_conversation(new_id: str) -> None:
            _dify_conversation_cache[cache_key] = new_id

        data = _read_dify_stream(response, api_key, userid, run, on_conversation_id=remember_conversation)

        new_conversation_id = data.get("conversation_id")
        if new_conversation_id:
            _dify_conversation_cache[cache_key] = new_conversation_id

        # message_end の metadata.usage にトークン数・金額(Dify算出)が入る
        usage = (data.get("metadata") or {}).get("usage") or {}
        usage_fields.update(
            conversation_id=new_conversation_id,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            total_price=usage.get("total_price"),
            currency=usage.get("currency"),
        )

        answer = data.get("answer", "")
        usage_fields["status"] = "success" if answer.strip() else "empty"
        if not answer.strip():
            # Difyアプリによっては、会話の冒頭で用意された選択肢(suggested_questions)と
            # 厳密に一致する文言でないと、ワークフロー内の分岐が空の結果に落ちて何も
            # 返さないことがある（例: 「応募文を作ってほしい」という自然文では反応しないが
            # 「応募文作成」という完全一致の文言なら正しく応答する）。空応答をそのまま
            # ユーザーに見せず、選べる選択肢がある場合はボタンとして提示する。
            suggested_questions = _get_dify_parameters(api_key).get("suggested_questions") or []
            # 最初の発言が選択肢に当たらず空になった会話は、その後に選択肢そのもの（「応募文作成」）を
            # 送っても空のまま進まない（Dify側の分岐が会話の最初の発言で決まるため）。空で終わった
            # 新しい会話は覚えず、次の発言（ボタン）を新しい会話の最初の発言として送らせる。
            if not conversation_id:
                _dify_conversation_cache.pop(cache_key, None)
            if suggested_questions:
                answer = _render_suggested_questions_html(suggested_questions)
            else:
                answer = "回答を生成できませんでした。別の言い方で試すか、少し時間をおいてから聞いてみてください。"

        # 画面が挨拶文と選択肢を先に出している（build_dify_intro）ときは付け直さない
        if not conversation_id and not opening_shown:
            answer = _with_opening_statement(answer, api_key)

        _dify_last_buttons_cache[(userid, session_id)] = _extract_button_values(answer)
        return answer

    except ChatCancelled:
        usage_fields["status"] = "cancelled"
        raise

    except requests.exceptions.Timeout as e:
        logger.error(f"Dify API call timed out: {e}")
        usage_fields.update(status="timeout", error_type=type(e).__name__)
        return "案件検索に時間がかかっており、時間内に確認できませんでした。もう一度試すか、少し時間をおいてから聞いてみてください。"

    except requests.exceptions.RequestException as e:
        logger.error(f"Dify API call failed: {e}")
        http_status = e.response.status_code if getattr(e, "response", None) is not None else None
        usage_fields.update(status="error", error_type=type(e).__name__, http_status=http_status)
        return "外部サービスへの問い合わせでエラーが発生しました。もう一度試してみてください。"

    except Exception as e:
        usage_fields.update(status="error", error_type=type(e).__name__)
        raise

    finally:
        usage_fields["duration_ms"] = int((time.monotonic() - started_at) * 1000)
        log_ai_usage("ai_app_call", **usage_fields)


def create_ai_application_tools(
    db,
    raw_user_message: str,
    userid: int = None,
    session_id: Optional[str] = None,
    image: Optional[Dict[str, str]] = None,
    run_id: Optional[str] = None,
    in_app_mode: bool = False,
    opening_shown: bool = False,
) -> "tuple[List[BaseTool], Optional[str], Optional[str]]":
    """
    DBに登録済みのAIアプリケーション（webcoach_ai_application.secret_keyが設定されているもの）を
    LangChain Toolとして動的に生成する。

    secret_keyに対応するAPIキーがSecrets Manager等の認証情報から見つからない場合はスキップする。

    Difyへ送る問い合わせ内容は、LLMが生成する`query`引数ではなく、常に
    ユーザーの発言(raw_user_message)をそのまま使う。Dify側アプリがボタンの
    data-message値等、厳密な文字列一致を前提にしたステップ形式のフローを
    持つことがあり、LLMによる言い換えを挟むとフローが先に進まなくなるため。
    同じ理由で、ユーザーの添付画像(image)もLLMを介さずそのままDifyへ渡す。

    戻り値は (tools, forced_tool_name, continuing_tool_name)。
    - forced_tool_name: 前ターンのアプリのツール名で、LLMに選ばせずこのツールへ固定する場合。
      ユーザーの発言が直前のDify応答のボタン値と一致したとき、または直前のターンが
      Difyだった（Difyが答えを待っている途中の）とき。LLMに選ばせると自由入力の答えに
      チャットのAIが自分で答えてしまい、その後の条件がDifyへ届かず「忘れた」ように見えていた。
    - continuing_tool_name: 前ターンのアプリはあるが、間にチャットのAIが答えたターンを
      挟んだ場合のツール名。固定はせず「続きなら同じツールを」とLLMに伝えるだけにする。
    ユーザーの発言に他アプリ固有のタグキーワードが含まれる場合は明示的な切り替え意図と
    みなし、ボタン値の一致以外ではどちらもNoneを返す。タグに当たらない別用途の依頼
    （コースの質問等）は、Difyの途中では前ターンのアプリへ送られる。抜けたいときは
    「新しいチャットで続ける」で別セッションにする前提。
    """
    from entities.webcoach import WebCoachAIApplication

    tools: List[Tool] = []
    # 並び順を固定する（ツール定義はプロンプトキャッシュの対象なので、順序が揺れるとキャッシュが効かない）
    apps = db.query(WebCoachAIApplication).filter(
        WebCoachAIApplication.secret_key.isnot(None)
    ).order_by(WebCoachAIApplication.id).all()

    for app in apps:
        api_key = _get_dify_api_key(app.secret_key)
        if not api_key:
            logger.warning(f"No credential found for AI application '{app.name}' (secret_key={app.secret_key})")
            continue

        def make_func(
            api_key: str = api_key,
            app_id: int = app.id,
            message: str = raw_user_message,
            session_id: Optional[str] = session_id,
            image: Optional[Dict[str, str]] = image,
            run_id: Optional[str] = run_id,
            opening_shown: bool = opening_shown,
        ):
            def _call(
                query: str,
                userid: int,
                start_new_conversation: bool = False,
                extra_inputs: Optional[Dict[str, str]] = None,
            ) -> str:
                return _call_dify_chat(
                    message,
                    userid,
                    api_key,
                    app_id,
                    reset=_should_reset_dify_conversation(message, start_new_conversation),
                    inputs=extra_inputs,
                    session_id=session_id,
                    image=image,
                    run_id=run_id,
                    opening_shown=opening_shown,
                )
            return _call

        # このアプリがDify側で必須入力変数（例: 求人情報のURL）を定義している場合、
        # ツールの説明文にその旨を明記する。未取得でもツール呼び出し自体は
        # _call_dify_chat側で空文字を補って安全に送信できるため、LLMには
        # 「聞き取れたら渡す」ことだけを促し、聞き取るまで呼び出しを保留させる
        # 指示は入れない（保留させると、ユーザーが情報を持たない/答えたくない場合に
        # 同じ質問を繰り返すだけでツールに一度も到達しない不具合になっていたため。
        # Dify側にopening_statement等の聞き取りフローがあるアプリはそちらに委ねる）。
        required_vars = [
            field["variable"]
            for form_item in (_get_dify_parameters(api_key).get("user_input_form") or [])
            for field_type, field in form_item.items()
            if field.get("required")
        ]
        required_inputs_text = ""
        if required_vars:
            # 未取得でも聞き返さずに呼んでよい（未取得の必須変数は_call_dify_chatが空文字で補い、
            # 聞き取りはDify側のフローに任せる）
            required_inputs_text = (
                f" 入力項目: {'、'.join(required_vars)}（発言から読み取れたらextra_inputsに設定。"
                f"未取得でも聞き返さずに呼び出す）"
            )

        tools.append(
            StructuredTool.from_function(
                name=f"ask_ai_application_{app.id}",
                description=(
                    f"「{app.name}」（{app.category}）に問い合わせます。{app.description}"
                    f"{required_inputs_text}"
                ),
                func=make_func(),
                args_schema=AskAiApplicationInput
            )
        )

    forced_tool_name = None
    continuing_tool_name = None
    sticky_app_id = get_sticky_dify_app_id(userid, session_id) if userid is not None else None
    sticky_app = next((a for a in apps if a.id == sticky_app_id), None) if sticky_app_id is not None else None
    if sticky_app:
        sticky_name = f"ask_ai_application_{sticky_app_id}"
        last_buttons = _dify_last_buttons_cache.get((userid, session_id)) or set()
        if raw_user_message.strip() in last_buttons:
            # 直前のDify応答のボタンを押した（またはその値をそのまま入力した）
            # → そのアプリの続きであることが確実なので、LLMに選ばせず固定する
            forced_tool_name = sticky_name
        else:
            sticky_tags = {t.strip() for t in (sticky_app.tags or "").split(",")}
            other_tags = set()
            for other in apps:
                if other.id == sticky_app_id:
                    continue
                other_tags |= {t.strip() for t in (other.tags or "").split(",")}
            # 汎用タグ（AI/案件など複数アプリで共通のもの）は切り替え判定から除外する
            distinctive_other_tags = {t for t in (other_tags - sticky_tags) if t}
            # アプリのモード中（利用者が自分でアプリを選んだ状態）はタグで切り替えない。
            # 答えの中にたまたま他アプリのタグ（「案件で作ったバナー」の「案件」等）が入るだけで
            # 切り替わり、フィードバックメンターのプロジェクト情報がDifyに届かずチャットのAIが
            # 答えていた。モードを抜けるのは画面側の操作に任せる。
            switched = not in_app_mode and any(tag in raw_user_message for tag in distinctive_other_tags)
            if switched:
                pass
            elif _dify_idle_turns_cache.get((userid, session_id), 0) == 0:
                # 直前のターンがDifyの質問 → 自由入力の答えもそのアプリへ送る。
                # LLMに選ばせると自分で答えてしまうことがあり、その発言がDifyへ届かない
                forced_tool_name = sticky_name
            else:
                continuing_tool_name = sticky_name

    return tools, forced_tool_name, continuing_tool_name


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
