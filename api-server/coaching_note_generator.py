"""
AI Coaching Note Generator

会議のTranscript（発言者・本文・時刻のリスト）から、8項目の構造化コーチングノート下書きを生成する。
Google Meet APIとの接続は別処理（未実装）が担当し、この関数はテキスト化されたTranscriptを
受け取って要約するところのみを担う。
"""
import os
import re
import json
import logging
from typing import Any, Dict, List, Optional

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

NOTE_FIELDS = [
    "session_summary",
    "client_status_and_goal",
    "main_issues",
    "coach_feedback",
    "decisions",
    "client_next_actions",
    "coach_follow_up",
    "next_session_check",
]

SYSTEM_PROMPT = """あなたはコーチング面談の文字起こしから、コーチ確認用のノート下書きを作成するアシスタントです。

以下のルールを厳守してください:
- 文字起こしに書かれていない内容を推測・補完しない
- 期限や次回日時など曖昧で文字起こしから確定できない情報は null にする
- 出力は必ず次の8個のキーを持つ1つのJSONオブジェクトのみ。前置き・後書き・コードブロック記法は一切付けない
- client_next_actions以外の値は文字列またはnull。情報が無い項目は null にする

キーと内容:
- session_summary: セッション概要（文字列）
- client_status_and_goal: Clientの現状と目標（文字列）
- main_issues: 主な課題（文字列）
- coach_feedback: Coachからのフィードバック（文字列）
- decisions: 今回決めたこと（文字列）
- client_next_actions: Clientの次回までのアクション。**1つの文字列にまとめず、1項目1文字列の文字列配列で返す**
  （例: ["TypeScript入門コースの第2章まで進める", "職務経歴書のドラフトを作成する"]）。
  該当する行動項目が無い場合は空配列 [] にする
- coach_follow_up: Coach側のフォロー事項（文字列）
- next_session_check: 次回確認すること（文字列）
"""

_llm: Optional[ChatAnthropic] = None


def _get_llm() -> ChatAnthropic:
    global _llm
    if _llm is None:
        anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")

        model_name = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")
        _llm = ChatAnthropic(
            model=model_name,
            anthropic_api_key=anthropic_api_key,
            temperature=0.2,
            max_tokens=2048,
        )
        logger.info(f"Coaching note generator LLM initialized with model: {model_name}")
    return _llm


def _format_transcript(entries: List[Dict[str, Any]]) -> str:
    lines = []
    for entry in entries:
        speaker = entry.get("speaker") or "unknown"
        timestamp = entry.get("timestamp")
        text = entry.get("text") or ""
        prefix = f"[{timestamp}] " if timestamp else ""
        lines.append(f"{prefix}{speaker}: {text}")
    return "\n".join(lines)


def _parse_note_json(raw_text: str) -> Dict[str, Optional[str]]:
    cleaned = raw_text.strip()
    fence_match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1)

    parsed = json.loads(cleaned)

    result: Dict[str, Optional[str]] = {}
    for field in NOTE_FIELDS:
        value = parsed.get(field)
        if field == "client_next_actions":
            # DBのclient_next_actionsはText(単一文字列)のまま、1行1項目の
            # 改行区切りテキストとして保存する。公開時にこの改行で
            # webcoach_next_coaching_goalへ分割する（routers/notes.py参照）。
            if isinstance(value, list):
                items = [str(item).strip() for item in value if str(item).strip()]
                result[field] = "\n".join(items) if items else None
            else:
                result[field] = value if isinstance(value, str) and value.strip() else None
        else:
            result[field] = value if isinstance(value, str) and value.strip() else None
    return result


def generate_coaching_note_draft(transcript_entries: List[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    """
    Transcriptから8項目のコーチングノート下書きを生成する。

    Args:
        transcript_entries: 発言単位のリスト。各要素は
            {"speaker": "coach"|"client"|str, "text": str, "timestamp": Optional[str]}

    Returns:
        Dict[str, Optional[str]]: NOTE_FIELDSの8キーを持つdict。値は文字列またはNone

    Raises:
        ValueError: ANTHROPIC_API_KEY未設定、またはtranscript_entriesが空の場合
        json.JSONDecodeError: モデルの応答が有効なJSONでなかった場合
    """
    if not transcript_entries:
        raise ValueError("transcript_entries must not be empty")

    llm = _get_llm()
    transcript_text = _format_transcript(transcript_entries)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"以下がコーチング面談の文字起こしです。\n\n{transcript_text}"),
    ]

    response = llm.invoke(messages)
    raw_text = response.content if isinstance(response.content, str) else str(response.content)

    try:
        return _parse_note_json(raw_text)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse coaching note JSON from LLM response: {raw_text[:500]}")
        raise
