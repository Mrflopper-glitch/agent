"""Wire-format helpers shared by the relay and its tests. See docs/claude-remote/protocol.md."""

from __future__ import annotations

import json
from typing import Any

MAX_TEXT_FRAME = 16 * 1024

# Session states shown on the device.
IDLE, RUNNING, WAITING, ERROR = "idle", "running", "waiting", "error"

# Event kinds streamed to the device.
EVENT_KINDS = ("user", "text", "tool", "result", "status", "error")


def clip(text: str, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "\u2026"


def encode(msg_type: str, **fields: Any) -> str:
    return json.dumps({"type": msg_type, **fields}, separators=(",", ":"), ensure_ascii=False)


def decode(raw: str) -> dict:
    if len(raw) > MAX_TEXT_FRAME:
        raise ValueError("frame too large")
    msg = json.loads(raw)
    if not isinstance(msg, dict) or not isinstance(msg.get("type"), str):
        raise ValueError("message must be an object with a string 'type'")
    return msg


def summarize_tool(tool: str, tool_input: dict | None, limit: int = 160) -> str:
    tool_input = tool_input or {}
    for key in ("command", "file_path", "path", "url", "pattern", "query", "action"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            return clip(value, limit)
    if not tool_input:
        return tool
    return clip(json.dumps(tool_input, separators=(",", ":"), ensure_ascii=False), limit)
