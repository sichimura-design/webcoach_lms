"""
Difyのストリーミング応答（SSE）のモック。

_call_dify_chat は response_mode=streaming で呼び、_read_dify_stream で blocking と同じ形に組み直す。
テストでは blocking の応答（answer/conversation_id/metadata）を書き、ここでSSEの行に変換する。
"""
import json
from unittest.mock import MagicMock


def sse_lines(payload, task_id="task-1"):
    """blocking形式の応答をSSEの行（bytes）に変換する。answerは2つに分けて送る"""
    conv = payload.get("conversation_id")
    base = {"task_id": task_id, **({"conversation_id": conv} if conv else {})}
    answer = payload.get("answer", "")
    half = len(answer) // 2
    events = [
        {"event": "workflow_started", **base},
        {"event": "message", "answer": answer[:half], **base},
        {"event": "ping"},
        {"event": "message", "answer": answer[half:], **base},
        {"event": "message_end", "metadata": payload.get("metadata") or {}, **base},
    ]
    lines = []
    for e in events:
        lines.append(b"data: " + json.dumps(e, ensure_ascii=False).encode("utf-8"))
        lines.append(b"")
    return lines


def dify_response(payload, task_id="task-1"):
    """/files/upload（json）と /chat-messages（ストリーミング）のどちらにも使えるレスポンスのモック"""
    resp = MagicMock()
    resp.json.return_value = payload
    resp.raise_for_status.return_value = None
    resp.iter_lines.side_effect = lambda *a, **k: iter(sse_lines(payload, task_id))
    return resp
