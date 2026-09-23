"""
LangChain Tools for BFF API Integration
BFF APIツールをLangChain Tool形式で定義
"""
import os
import json
import base64
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
    """AIアプリケーション連携ツールの入力"""
    # 実際にDifyへ送る内容には使わない（ユーザーの発言をそのまま送るため）。
    # ツール呼び出しのスキーマ上必要なため残しているが、値は無視される。
    query: str = Field(..., description="AIアプリに問い合わせる質問内容")
    userid: int = Field(..., description="ユーザーID")
    start_new_conversation: bool = Field(
        False,
        description=(
            "デフォルトはfalse。trueにすると、このアプリとの会話を最初からやり直します"
            "（これまで選択済みの職種・予算・納期・プラットフォームなどの条件を破棄します）。"
            "**falseのままにすべき場合（迷ったら必ずfalse）**: ユーザーの発言が、直前にこの"
            "アプリが尋ねた質問への回答になっている場合（例：アプリが「どのプラットフォームで"
            "探したいですか？」と聞いた直後に「Crowdworksで探している」「Crowdworksです」と"
            "答えた、予算や納期を聞かれて数値で答えた、など）。この場合は会話が正常に進んでいる"
            "だけなので、文中に「探している」「探したい」という言葉が含まれていてもfalseのまま"
            "にしてください。"
            "**trueにすべき場合**: ユーザーが「新しく」「最初から」「別の条件で」「今の検索とは"
            "別に」のように、進行中のやり取り（すでに答えた条件）を明示的に破棄して一から"
            "やり直したいと述べた場合のみ。"
        ),
    )
    extra_inputs: Optional[Dict[str, str]] = Field(
        None,
        description=(
            "このツールの説明文で追加の入力が必要と指示されている場合にのみ使う任意項目。"
            "指示された変数名をキーにして、ユーザーから聞き取った値を設定すること。"
            "まだユーザーから聞き取れていない場合は、このツールを呼ばずに先にユーザーへ質問する"
            "こと。値が分かった一度きりではなく、それ以降の同じ会話の全ターンで毎回同じ値を"
            "設定し続けること（省略すると再びエラーになる）。追加入力が不要なツールでは常に"
            "省略してよい。"
        ),
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

# 直前のターンでユーザーが実際に呼び出したDifyアプリ（(userid, session_id) -> app_id）。
# 会話履歴(conversation_history)はロールとテキストのみをやり取り相手に送っており
# どのask_ai_application_*ツールを使ったかの情報が失われるため、似た説明を持つ
# 複数の案件抽出アプリ（Crowdworks/Lancers/ココナラ等）の間でLLMが毎ターン
# 選び直してしまい、Dify側の会話が意図せずリセットされる問題への対策。
# プロセス内メモリのみ。
_dify_sticky_app_cache: Dict[tuple, int] = {}

# 必須入力変数(extra_inputs)のセッション内キャッシュ（(userid, app_id, session_id) -> inputs辞書）。
# LLMには「一度聞き取ったら以降の全ターンでextra_inputsに設定し続けること」と指示しているが、
# 実際には省略してしまうことがあり(非決定的)、その場合Difyがrequired変数不足で
# 400 invalid_paramを返し「一時的なエラー」としてユーザーに見えていた。LLMの記憶に頼らず、
# 一度渡された値をサーバー側で覚えておき、以降の呼び出しで自動的に補完する。
_dify_extra_inputs_cache: Dict[tuple, Dict[str, str]] = {}


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


def _call_dify_chat(
    query: str,
    userid: int,
    api_key: str,
    app_id: int,
    reset: bool = False,
    inputs: Optional[Dict[str, str]] = None,
    session_id: Optional[str] = None,
    image: Optional[Dict[str, str]] = None,
) -> str:
    """Dify上に構築されたAIアプリに問い合わせる（同一ユーザー・同一アプリ・同一セッションの
    会話はプロセス内で継続する）

    reset=Trueの場合、キャッシュ済みのconversation_idを使わず新規の会話として送信する
    （ユーザーが前回までの条件を引き継がず新しく検索し直したい場合の入口）。

    image（{"media_type", "data"(base64)}）が渡され、Dify側アプリで画像アップロードが
    有効な場合は、Difyへアップロードしてfilesとして添付する。以降のターンで画像が
    無くても、同じ会話のあいだは最後の画像を添付し続ける（_dify_image_cache参照）。
    """
    cache_key = (userid, app_id, session_id)
    conversation_id = "" if reset else _dify_conversation_cache.get(cache_key, "")
    _dify_sticky_app_cache[(userid, session_id)] = app_id

    # extra_inputsはLLMが送り忘れることがあるため、一度渡された値をセッション単位で
    # 覚えておき、今回省略されていてもマージして補う（新しい値が来れば上書きする）。
    if reset:
        _dify_extra_inputs_cache.pop(cache_key, None)
    stored_inputs = {} if reset else _dify_extra_inputs_cache.get(cache_key, {})
    merged_inputs = {**stored_inputs, **(inputs or {})}
    if merged_inputs:
        _dify_extra_inputs_cache[cache_key] = merged_inputs

    # Dify側でrequired: trueな入力変数は、キー自体が送信データに存在しないと
    # （値が空文字であっても）400 invalid_paramで弾かれる。LLMがまだ聞き取れて
    # いない状態でもツールをためらわず呼び出せるよう（Dify自身のopening_statementに
    # 聞いてもらう設計にするため）、未取得の必須変数は空文字で埋めて送信する。
    # ここではキャッシュ(_dify_extra_inputs_cache)には反映せず、実送信データのみ補う。
    required_vars = [
        field["variable"]
        for form_item in (_get_dify_parameters(api_key).get("user_input_form") or [])
        for _, field in form_item.items()
        if field.get("required")
    ]
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

    try:
        response = requests.post(
            f"{DIFY_API_BASE_URL}/chat-messages",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "inputs": request_inputs,
                "query": query,
                "response_mode": "blocking",
                "conversation_id": conversation_id,
                "user": f"webcoach-user-{userid}",
                **({"files": files} if files else {}),
            },
            # 2026-09-17: routers/ai_langgraph.pyがバックグラウンドスレッド+ポーリング
            # 方式(SYNC_WAIT_SECONDS超過時はjob_id化)に変更されたため、この呼び出しは
            # もはやCloudFront/BFFの同期タイムアウトに縛られない。
            # 実測: 「案件抽出メーカー」の実検索ステップはDify側で72秒かかった例がある
            # (Dify `GET /v1/messages`のprovider_response_latencyで確認)。それでも
            # 無制限にはせず、異常に長時間化した場合の安全弁として120秒を上限とする。
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()

        new_conversation_id = data.get("conversation_id")
        if new_conversation_id:
            _dify_conversation_cache[cache_key] = new_conversation_id

        answer = data.get("answer", "")
        if not answer.strip():
            # Difyアプリによっては、会話の冒頭で用意された選択肢(suggested_questions)と
            # 厳密に一致する文言でないと、ワークフロー内の分岐が空の結果に落ちて何も
            # 返さないことがある（例: 「応募文を作ってほしい」という自然文では反応しないが
            # 「応募文作成」という完全一致の文言なら正しく応答する）。空応答をそのまま
            # ユーザーに見せず、選べる選択肢がある場合はボタンとして提示する。
            suggested_questions = _get_dify_parameters(api_key).get("suggested_questions") or []
            if suggested_questions:
                return _render_suggested_questions_html(suggested_questions)
            return "回答を生成できませんでした。別の言い方で試すか、少し時間をおいてから聞いてみてください。"

        return answer

    except requests.exceptions.Timeout as e:
        logger.error(f"Dify API call timed out: {e}")
        return "案件検索に時間がかかっており、時間内に確認できませんでした。もう一度試すか、少し時間をおいてから聞いてみてください。"

    except requests.exceptions.RequestException as e:
        logger.error(f"Dify API call failed: {e}")
        return "外部サービスへの問い合わせでエラーが発生しました。もう一度試してみてください。"


def create_ai_application_tools(
    db,
    raw_user_message: str,
    userid: int = None,
    session_id: Optional[str] = None,
    image: Optional[Dict[str, str]] = None,
) -> "tuple[List[BaseTool], Optional[str]]":
    """
    DBに登録済みのAIアプリケーション（webcoach_ai_application.secret_keyが設定されているもの）を
    LangChain Toolとして動的に生成する。

    secret_keyに対応するAPIキーがSecrets Manager等の認証情報から見つからない場合はスキップする。

    Difyへ送る問い合わせ内容は、LLMが生成する`query`引数ではなく、常に
    ユーザーの発言(raw_user_message)をそのまま使う。Dify側アプリがボタンの
    data-message値等、厳密な文字列一致を前提にしたステップ形式のフローを
    持つことがあり、LLMによる言い換えを挟むとフローが先に進まなくなるため。
    同じ理由で、ユーザーの添付画像(image)もLLMを介さずそのままDifyへ渡す。

    戻り値の2つ目は、このターンで会話継続のために固定すべきツール名
    （前ターンで使っていたDifyアプリと同一のもの）。ユーザーの発言に他アプリ
    固有のタグキーワードが含まれる場合は明示的な切り替え意図とみなし、Noneを返す。
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

        def make_func(
            api_key: str = api_key,
            app_id: int = app.id,
            message: str = raw_user_message,
            session_id: Optional[str] = session_id,
            image: Optional[Dict[str, str]] = image,
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
                    reset=start_new_conversation,
                    inputs=extra_inputs,
                    session_id=session_id,
                    image=image,
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
            var_list = "、".join(required_vars)
            required_inputs_text = (
                f" このアプリはDify側で次の入力項目を持っています: {var_list}。"
                f"ユーザーの発言や会話の流れから読み取れる場合は、キー名をそのまま使って"
                f"extra_inputsに設定してください。**まだ読み取れていない場合でも、"
                f"自分から確認質問をしてユーザーに聞き返したりせず、ユーザーが"
                f"このアプリの利用を求めている最初の発言でそのまま（extra_inputsを"
                f"省略して）このツールを呼び出してください。アプリ側が必要な情報を"
                f"自分から尋ねてくれるので、こちらで事前に聞き取る必要はありません**。"
                f"一度聞き取った値は、同じ会話の以降の全呼び出しでも毎回extra_inputsに"
                f"設定し続けること。"
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

    sticky_tool_name = None
    sticky_app_id = get_sticky_dify_app_id(userid, session_id) if userid is not None else None
    if sticky_app_id is not None:
        sticky_app = next((a for a in apps if a.id == sticky_app_id), None)
        if sticky_app:
            sticky_tags = {t.strip() for t in (sticky_app.tags or "").split(",")}
            other_tags = set()
            for other in apps:
                if other.id == sticky_app_id:
                    continue
                other_tags |= {t.strip() for t in (other.tags or "").split(",")}
            # 汎用タグ（AI/案件など複数アプリで共通のもの）は切り替え判定から除外する
            distinctive_other_tags = {t for t in (other_tags - sticky_tags) if t}
            switched = any(tag in raw_user_message for tag in distinctive_other_tags)
            if not switched:
                sticky_tool_name = f"ask_ai_application_{sticky_app_id}"

    return tools, sticky_tool_name


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
