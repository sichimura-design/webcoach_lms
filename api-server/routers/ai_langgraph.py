"""
AI chat endpoints with LangGraph
LangGraph統合版のAIチャットエンドポイント
"""
import os
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from dto.response.ai import AIResponse, AISource
from agents.learning_coach_agent import get_learning_coach_graph
from agents.state import LearningCoachState

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# レート制限設定
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/ai", tags=["AI - LangGraph"])


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
    max_iterations: Optional[int] = Field(None, description="最大推論回数（Noneの場合は文字数で自動調整）", ge=1, le=5)


class ChatResponse(BaseModel):
    """AIチャットレスポンス（LangGraph版）"""
    success: bool = Field(..., description="成功フラグ")
    message: str = Field(..., description="AI回答")
    sources: Optional[List[AISource]] = Field(None, description="RAG検索ソース")
    tool_calls: Optional[List[dict]] = Field(None, description="使用したツール一覧")
    iteration_count: int = Field(..., description="実行した推論回数")
    timestamp: datetime = Field(default_factory=datetime.now, description="レスポンス生成時刻")


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


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="AIチャット（LangGraph版）",
    description="学習サポートAIとのチャット機能（LangGraph + RAG + Tool Calling）"
)
# @limiter.limit("10/minute")  # Temporarily disabled for testing
def ai_chat_langgraph(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    AIチャット機能（LangGraph版）

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

    Args:
        request: チャットリクエスト
        db: データベースセッション

    Returns:
        AIチャットレスポンス
    """
    try:
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

        # 初期ステートを構築
        initial_state: LearningCoachState = {
            "messages": [HumanMessage(content=request.message)],
            "user_id": request.user_id,
            "course_id": request.course_id,
            "rag_sources": [],
            "rag_context": "",
            "tool_results": [],
            "final_response": None,
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

        # RAGソースを変換
        sources = None
        if final_state.get("rag_sources"):
            sources = [
                AISource(
                    chunk_index=src["chunk_index"],
                    module_name=src["module_name"],
                    filename=src["filename"],
                    section_name=src["section_name"],
                    similarity=src["similarity"]
                )
                for src in final_state["rag_sources"]
            ]

        # ツール呼び出し情報
        tool_calls = final_state.get("tool_results") if final_state.get("tool_results") else None

        logger.info(f"AI response generated: {len(response_message)} characters, {final_state['iteration_count']} iterations")

        return ChatResponse(
            success=True,
            message=response_message,
            sources=sources,
            tool_calls=tool_calls,
            iteration_count=final_state["iteration_count"]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LangGraph AI chat failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI chat failed: {str(e)}"
        )


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
