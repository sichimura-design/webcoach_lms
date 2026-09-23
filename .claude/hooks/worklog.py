#!/usr/bin/env python3
"""Claude Code hook: 依頼内容・ファイル編集・コマンド実行を .claude/worklog.jsonl に1行ずつ追記する。"""
import datetime
import json
import os
import sys

MAX_LEN = 2000  # 長いプロンプト/コマンドは切り詰める

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool_input = data.get("tool_input") or {}
entry = {
    "time": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    "session": data.get("session_id"),
    "event": data.get("hook_event_name"),
    "cwd": data.get("cwd"),
}
if data.get("prompt"):
    entry["prompt"] = data["prompt"][:MAX_LEN]
if data.get("tool_name"):
    entry["tool"] = data["tool_name"]
if tool_input.get("file_path"):
    entry["file"] = tool_input["file_path"]
if tool_input.get("command"):
    entry["command"] = tool_input["command"][:MAX_LEN]
if tool_input.get("description"):
    entry["description"] = tool_input["description"]

log_dir = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or ".", ".claude")
os.makedirs(log_dir, exist_ok=True)
with open(os.path.join(log_dir, "worklog.jsonl"), "a", encoding="utf-8") as f:
    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
