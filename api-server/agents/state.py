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

    # 教材ページで学習者が開いているレッスン・見出し・選択文章等（routers/ai_langgraph.LessonContext）。
    # 教材ページ以外からのチャットではNone
    lesson_context: Optional[Dict[str, Any]]

    # 教材ページでの回答の根拠区分（material / mixed / general）。respond_nodeで確定する
    grounding: Optional[str]

    # フロント側のチャットセッションID（Dify連携ツールの会話継続キャッシュを
    # このセッション単位で区切るために使う。tools_langchain.create_ai_application_tools参照）
    session_id: Optional[str]

    # DBの webcoach_ai_application から動的に生成されたツール（リクエストごとに構築）
    dynamic_tools: List[BaseTool]

    # RAGコンテキスト
    rag_sources: List[Dict[str, Any]]
    rag_context: str

    # ツール実行結果
    tool_results: List[Dict[str, Any]]

    # 最終回答
    final_response: Optional[str]

    # AIアプリケーション（Dify）ツールの応答をそのまま最終回答として使う場合の内容。
    # 設定されている場合、agentノードによる言い換えをスキップしてそのまま返す
    # （Difyアプリ側がボタンのdata-message値など厳密な文字列一致を前提にした
    # フローを持つことがあり、LLMによる要約・言い換えで壊れてしまうため）。
    dify_bypass_response: Optional[str]

    # 前ターンで使用していたDifyアプリのツール名で、このターンで固定すべきもの
    # （ユーザーが直前のDify応答のボタン値を送った場合のみ。Noneなら通常通りLLMに選ばせる）
    sticky_dify_tool_name: Optional[str]

    # 前ターンで使用していたDifyアプリのツール名（固定はしない。続きの発言なら
    # 同じツールを使うようsystem promptでLLMに伝える）
    continuing_dify_tool_name: Optional[str]

    # 専門モード（制作物添削等）の指示文。ユーザー発言には混ぜずsystem promptにだけ入れる
    mode_instruction: Optional[str]

    # メタデータ
    iteration_count: int
    max_iterations: int
