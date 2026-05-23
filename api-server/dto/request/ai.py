"""
AI chat request DTOs
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class AIRequest(BaseModel):
    """AIチャットリクエスト"""
    message: str = Field(..., description="ユーザーからのメッセージ", min_length=1)
    user_id: Optional[int] = Field(None, description="ユーザーID（コンテキスト取得用）")
    course_id: Optional[int] = Field(None, description="コースID（RAG検索用）")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="追加のコンテキスト情報")
    max_chunks: int = Field(5, ge=1, le=20, description="RAGで使用する最大チャンク数")
    use_tools: bool = Field(False, description="BFF APIツールの使用を許可するか")


class ToolCall(BaseModel):
    """ツール呼び出しリクエスト"""
    name: str = Field(..., description="ツール名")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="ツール引数")
