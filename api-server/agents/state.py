"""
Agent State Definitions
エージェントのステート定義
"""
from typing import List, Dict, Any, Optional, TypedDict, Annotated
from langchain_core.messages import BaseMessage
from langchain_core.tools import BaseTool
import operator


class LearningCoachState(TypedDict):
    """学習サポートエージェントのステート"""

    # 会話履歴
    messages: Annotated[List[BaseMessage], operator.add]

    # ユーザー情報
    user_id: int
    course_id: Optional[int]

    # DBの webcoach_ai_application から動的に生成されたツール（リクエストごとに構築）
    dynamic_tools: List[BaseTool]

    # RAGコンテキスト
    rag_sources: List[Dict[str, Any]]
    rag_context: str

    # ツール実行結果
    tool_results: List[Dict[str, Any]]

    # 最終回答
    final_response: Optional[str]

    # メタデータ
    iteration_count: int
    max_iterations: int
