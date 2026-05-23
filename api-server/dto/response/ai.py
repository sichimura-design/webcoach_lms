"""
AI chat response DTOs
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class AISource(BaseModel):
    """RAG検索ソース情報"""
    chunk_index: int = Field(..., description="チャンクのインデックス")
    module_name: str = Field(..., description="モジュール名")
    filename: str = Field("", description="ファイル名")
    section_name: str = Field("", description="セクション名")
    similarity: float = Field(..., description="類似度スコア", ge=0.0, le=1.0)


class ToolCallResult(BaseModel):
    """ツール呼び出し結果"""
    tool_name: str = Field(..., description="実行されたツール名")
    success: bool = Field(..., description="実行成功フラグ")
    result: Optional[Dict[str, Any]] = Field(None, description="ツール実行結果")
    error: Optional[str] = Field(None, description="エラーメッセージ")


class AIResponse(BaseModel):
    """AIチャットレスポンス"""
    success: bool = Field(..., description="処理成功フラグ")
    message: str = Field(..., description="AIからの応答メッセージ")
    sources: Optional[List[AISource]] = Field(None, description="RAG検索で使用されたソース情報")
    tool_calls: Optional[List[ToolCallResult]] = Field(None, description="実行されたツール呼び出し")
    context: Optional[Dict[str, Any]] = Field(None, description="追加のコンテキスト情報")
    timestamp: datetime = Field(default_factory=datetime.now, description="レスポンスのタイムスタンプ")
