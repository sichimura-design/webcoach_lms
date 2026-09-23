"""
AI chat endpoints with LangGraph
LangGraph統合版のAIチャットエンドポイント
"""
import os
import logging
import threading
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from langchain_core.messages import HumanMessage
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import SessionLocal
from dto.response.ai import AIResponse, AISource
from agents.learning_coach_agent import get_learning_coach_graph
from agents.state import LearningCoachState

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# レート制限設定
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/ai", tags=["AI - LangGraph"])

# 画像添付の制約（このセッション限りの表示用途のためサーバー側には永続化しない）
ALLOWED_IMAGE_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_BASE64_CHARS = 7_000_000  # 概算デコード後 ~5MB


class ImageAttachment(BaseModel):
    """チャットに添付する画像（Base64、サーバー側には保存しない）"""
    media_type: str = Field(..., description="画像のMIMEタイプ（image/jpeg, image/png, image/webp, image/gif）")
    data: str = Field(..., description="Base64エンコードされた画像データ（data:URIプレフィックスなし）")

    @field_validator("media_type")
    @classmethod
    def validate_media_type(cls, v: str) -> str:
        if v not in ALLOWED_IMAGE_MEDIA_TYPES:
            raise ValueError(f"サポートされていない画像形式です: {v}")
        return v

    @field_validator("data")
    @classmethod
    def validate_data_size(cls, v: str) -> str:
        if len(v) > MAX_IMAGE_BASE64_CHARS:
            raise ValueError("画像サイズが大きすぎます（上限: 約5MB）")
        return v


# リクエスト/レスポンス定義
class ChatRequest(BaseModel):
    """AIチャットリクエスト（LangGraph版）"""
    user_id: int = Field(..., description="ユーザーID", ge=1)
    message: str = Field(..., description="ユーザーメッセージ", min_length=1, max_length=1000)
    course_id: Optional[int] = Field(None, description="コースID（RAG検索用）", ge=1)
    conversation_history: Optional[List[dict]] = Field(
        default_factory=list,
        description="会話履歴（オプション）",
        max_length=10
    )
    session_id: Optional[str] = Field(
        None,
        description=(
            "フロント側のチャットセッションID（例: lesson:123、常設ドロワーのID）。"
            "Dify連携ツールの会話継続キャッシュ(userid+app_id+session_id)をこの単位で"
            "区切るために使う。省略時はuser_id+app_id単位で共有される（従来動作）。"
        )
    )
    max_iterations: Optional[int] = Field(None, description="最大推論回数（Noneの場合は文字数で自動調整）", ge=1, le=5)
    image: Optional[ImageAttachment] = Field(None, description="添付画像（Base64、任意）")


class ChatResponse(BaseModel):
    """AIチャットレスポンス（LangGraph版）"""
    success: bool = Field(..., description="成功フラグ")
    message: str = Field(..., description="AI回答")
    sources: Optional[List[AISource]] = Field(None, description="RAG検索ソース")
    tool_calls: Optional[List[dict]] = Field(None, description="使用したツール一覧")
    iteration_count: int = Field(..., description="実行した推論回数")
    timestamp: datetime = Field(default_factory=datetime.now, description="レスポンス生成時刻")
    # Dify連携ツールの実検索等、SYNC_WAIT_SECONDSを超えて完了しなかった場合は
    # status="processing"+job_idを返し、GET /chat/status/{job_id} でポーリングする。
    # 通常(数秒で完了)は status="done" のままで、呼び出し側の扱いは今までと変わらない。
    status: str = Field("done", description="done | processing")
    job_id: Optional[str] = Field(None, description="非同期実行中のジョブID（statusがprocessingの場合のみ）")


def estimate_token_count(text: str) -> int:
    """
    トークン数を推定（簡易版）
    日本語: 1文字 ≈ 2トークン
    英語: 1単語 ≈ 1.3トークン
    """
    # 日本語文字数をカウント
    japanese_chars = sum(1 for c in text if ord(c) > 0x3000)
    # 残りは英語として扱う
    other_chars = len(text) - japanese_chars

    # 推定トークン数
    estimated_tokens = (japanese_chars * 2) + (other_chars * 0.3)
    return int(estimated_tokens)


# 非同期実行ジョブストア（job_id -> {"status", "result", "http_status", "detail", "created_at"}）。
# 「案件抽出メーカー」等のDify連携ツールが実際に検索を行うステップは70〜90秒かかることがあり、
# CloudFront/BFFの同期タイムアウトの範囲に収まらない。短い猶予時間(SYNC_WAIT_SECONDS)を超えたら
# バックグラウンドスレッドでの実行に切り替え、フロント側にポーリングさせる。
# プロセス内メモリのみ（_dify_conversation_cache等と同じ思想。複数コンテナ構成やコンテナ
# 再起動をまたぐ継続には対応しない＝再デプロイ中に進行中だったジョブは失われる）。
_chat_jobs: Dict[str, dict] = {}
_chat_jobs_lock = threading.Lock()

# ほとんどのメッセージ（Dify連携ツールを使わない、または使っても軽いもの）はこの範囲で完了し、
# 今まで通り一発でChatResponseを返せる。これを超えたリクエストだけが非同期経路に切り替わる。
SYNC_WAIT_SECONDS = 8
# 完了/失敗したジョブをどれだけ保持するか（ポーリング側が取りに来る前にメモリを圧迫しないように）
JOB_TTL_SECONDS = 600


def _cleanup_old_jobs() -> None:
    cutoff = time.time() - JOB_TTL_SECONDS
    with _chat_jobs_lock:
        stale_ids = [jid for jid, job in _chat_jobs.items() if job["created_at"] < cutoff]
        for jid in stale_ids:
            del _chat_jobs[jid]


def _run_chat_job(job_id: str, request: ChatRequest) -> None:
    """バックグラウンドスレッドで_execute_chatを実行し、結果をジョブストアへ書き戻す。

    Depends(get_db)で注入されたセッションはリクエストハンドラの終了とともに
    クローズされてしまうため使えない。ここでは独立したDBセッションを都度生成する。
    """
    db = SessionLocal()
    try:
        result = _execute_chat(request, db)
        with _chat_jobs_lock:
            _chat_jobs[job_id]["status"] = "done"
            _chat_jobs[job_id]["result"] = result
    except HTTPException as e:
        with _chat_jobs_lock:
            _chat_jobs[job_id]["status"] = "error"
            _chat_jobs[job_id]["http_status"] = e.status_code
            _chat_jobs[job_id]["detail"] = e.detail
    except Exception as e:
        logger.error(f"Background AI chat job {job_id} failed: {e}", exc_info=True)
        with _chat_jobs_lock:
            _chat_jobs[job_id]["status"] = "error"
            _chat_jobs[job_id]["http_status"] = status.HTTP_500_INTERNAL_SERVER_ERROR
            _chat_jobs[job_id]["detail"] = f"AI chat failed: {e}"
    finally:
        db.close()
        with _chat_jobs_lock:
            _chat_jobs[job_id]["event"].set()


def _execute_chat(request: ChatRequest, db: Session) -> ChatResponse:
    """AIチャット本体（同期の猶予時間内で完了した場合も、非同期ジョブとして実行される場合も、ここが呼ばれる）

    **特徴:**
    - ReActパターンでツールを動的に呼び出し
    - ツール実行結果をLLMに戻して再推論
    - 複数ステップの推論が可能
    - 会話履歴の管理

    **フロー:**
    1. RAG検索（course_idがある場合）
    2. エージェント推論
    3. ツール呼び出し（必要に応じて）
    4. エージェント再推論（ツール結果を見て）
    5. 最終回答生成
    """
    logger.info(f"LangGraph AI chat request: user_id={request.user_id}, message='{request.message[:50]}...'")

    # 入力トークン数をチェック（簡易版）
    message_tokens = estimate_token_count(request.message)
    history_tokens = sum(
        estimate_token_count(msg.get("content", ""))
        for msg in request.conversation_history
    )
    total_input_tokens = message_tokens + history_tokens

    # トークン数上限チェック（5000トークンまで）
    MAX_INPUT_TOKENS = 5000
    if total_input_tokens > MAX_INPUT_TOKENS:
        logger.warning(f"Input tokens exceeded: {total_input_tokens} > {MAX_INPUT_TOKENS}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"入力が長すぎます。推定トークン数: {total_input_tokens} (上限: {MAX_INPUT_TOKENS})"
        )

    logger.info(f"Estimated input tokens: {total_input_tokens}")

    # 文字数に応じてmax_iterationsを動的に調整
    # 短い質問（50文字未満）: 3回（ツール2回 + 最終回答1回）
    # 中程度（50-150文字）: 4回
    # 長い質問（150文字以上）: 3回
    message_length = len(request.message)
    if request.max_iterations is None:
        if message_length < 50:
            calculated_max_iterations = 3
        elif message_length < 150:
            calculated_max_iterations = 4
        else:
            calculated_max_iterations = 3
    else:
        calculated_max_iterations = request.max_iterations

    logger.info(f"Message length: {message_length}, max_iterations: {calculated_max_iterations}")

    # グラフを取得
    graph = get_learning_coach_graph()

    # 画像添付がある場合はマルチモーダルのcontent blocksを構築
    # （画像はこのターンのみ送信し、DBやS3への保存は行わない）
    if request.image:
        user_content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": request.image.media_type,
                    "data": request.image.data
                }
            },
            {"type": "text", "text": request.message}
        ]
    else:
        user_content = request.message

    # DBに登録済みのAIアプリケーション（secret_key設定済み）を動的ツールとして構築
    from agents.tools_langchain import create_ai_application_tools
    dynamic_tools, sticky_dify_tool_name = create_ai_application_tools(
        db,
        request.message,
        request.user_id,
        session_id=request.session_id,
        # 添付画像はDify側アプリにも渡す（制作物添削アプリ等が画像を見て答えられるように）
        image=request.image.model_dump() if request.image else None,
    )

    # 初期ステートを構築
    initial_state: LearningCoachState = {
        "messages": [HumanMessage(content=user_content)],
        "user_id": request.user_id,
        "session_id": request.session_id,
        "course_id": request.course_id,
        "dynamic_tools": dynamic_tools,
        "rag_sources": [],
        "rag_context": "",
        "tool_results": [],
        "final_response": None,
        "dify_bypass_response": None,
        "sticky_dify_tool_name": sticky_dify_tool_name,
        "iteration_count": 0,
        "max_iterations": calculated_max_iterations
    }

    logger.info(f"Initial state has {len(initial_state['messages'])} messages")

    # 会話履歴があれば追加（オプション）
    if request.conversation_history:
        from langchain_core.messages import AIMessage
        history_messages = []
        for msg in request.conversation_history:
            if msg.get("role") == "user":
                history_messages.append(HumanMessage(content=msg.get("content", "")))
            elif msg.get("role") == "assistant":
                history_messages.append(AIMessage(content=msg.get("content", "")))

        # 履歴を先頭に追加
        initial_state["messages"] = history_messages + initial_state["messages"]

    # グラフを実行
    logger.info("Executing LangGraph workflow...")
    final_state = graph.invoke(initial_state)

    # レスポンスを構築
    response_message = final_state.get("final_response", "回答を生成できませんでした。")

    # ツール呼び出し情報
    tool_calls = final_state.get("tool_results") if final_state.get("tool_results") else None

    logger.info(f"AI response generated: {len(response_message)} characters, {final_state['iteration_count']} iterations")

    return ChatResponse(
        success=True,
        message=response_message,
        sources=None,  # 参照元は常にNoneを返す
        tool_calls=tool_calls,
        iteration_count=final_state["iteration_count"]
    )


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="AIチャット（LangGraph版）",
    description=(
        "学習サポートAIとのチャット機能（LangGraph + RAG + Tool Calling）。"
        f"{SYNC_WAIT_SECONDS}秒以内に完了すれば今まで通りChatResponseを直接返すが、"
        "Dify連携ツールの実検索等で時間がかかる場合はstatus=\"processing\"+job_idを返す。"
        "続きは GET /api/ai/chat/status/{job_id} でポーリングする。"
    )
)
# @limiter.limit("10/minute")  # Temporarily disabled for testing
def ai_chat_langgraph(request: ChatRequest):
    """
    リクエストを受け取ったら即座にバックグラウンドスレッドで_execute_chatを開始し、
    SYNC_WAIT_SECONDS秒だけ完了を待つ。ほとんどのメッセージはこの間に完了し、
    今まで通り一発でChatResponseが返る。完了しなかった場合のみ非同期扱いに切り替え、
    job_idを返してポーリングさせる（DifyのCrowdworks/Lancers/ココナラ検索アプリの
    実検索ステップが70〜90秒かかることがあり、CloudFront/BFFの同期タイムアウトの
    範囲に収まらないため）。
    """
    _cleanup_old_jobs()

    job_id = str(uuid.uuid4())
    with _chat_jobs_lock:
        _chat_jobs[job_id] = {
            "status": "pending",
            "result": None,
            "created_at": time.time(),
            "event": threading.Event(),
        }
    event = _chat_jobs[job_id]["event"]

    thread = threading.Thread(target=_run_chat_job, args=(job_id, request), daemon=True)
    thread.start()

    if event.wait(timeout=SYNC_WAIT_SECONDS):
        with _chat_jobs_lock:
            job = _chat_jobs.pop(job_id)
        if job["status"] == "done":
            return job["result"]
        raise HTTPException(status_code=job["http_status"], detail=job["detail"])

    logger.info(f"AI chat job {job_id} exceeded {SYNC_WAIT_SECONDS}s, switching to async polling")
    return ChatResponse(
        success=True,
        message="",
        iteration_count=0,
        status="processing",
        job_id=job_id
    )


@router.get(
    "/chat/status/{job_id}",
    response_model=ChatResponse,
    summary="AIチャット非同期ジョブの状態取得",
    description="POST /chat がstatus=\"processing\"を返した場合、そのjob_idでこのエンドポイントをポーリングする"
)
def get_chat_job_status(job_id: str):
    with _chat_jobs_lock:
        job = _chat_jobs.get(job_id)
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定されたjob_idが見つかりません（完了後に一定時間が経過したか、サーバーが再起動した可能性があります）"
            )
        if job["status"] == "pending":
            return ChatResponse(success=True, message="", iteration_count=0, status="processing", job_id=job_id)
        # done/errorはこの一度の取得で片付ける
        del _chat_jobs[job_id]

    if job["status"] == "error":
        raise HTTPException(status_code=job["http_status"], detail=job["detail"])
    return job["result"]


@router.get(
    "/health",
    summary="ヘルスチェック（LangGraph）",
    description="LangGraph AIエージェントの稼働状態を確認"
)
def health_check():
    """LangGraph AIエージェントのヘルスチェック"""
    try:
        # 環境変数チェック
        anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
        if not anthropic_api_key:
            return {
                "status": "unhealthy",
                "reason": "ANTHROPIC_API_KEY not configured"
            }

        # グラフを取得（初期化確認）
        graph = get_learning_coach_graph()

        return {
            "status": "healthy",
            "agent": "learning_coach",
            "graph_nodes": ["retrieve", "agent", "tools", "respond"]
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "reason": str(e)
        }
