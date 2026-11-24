"""Runs Claude Code headless (`claude -p`) and maps its stream-json output to device events."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import sys
from pathlib import Path
from typing import AsyncIterator

from ..protocol import summarize_tool
from .base import Backend, RunContext

log = logging.getLogger(__name__)
HOOK_SCRIPT = Path(__file__).resolve().parent.parent / "hook.py"

COMPUTER_PROMPT = (
    " You are driving the user's computer through the computer-use tools you were given. "
    "Describe each step in a few words before taking it."
)


def hook_settings(timeout_s: float) -> dict:
    command = f'"{sys.executable}" "{HOOK_SCRIPT}"'
    return {
        "hooks": {
            "PreToolUse": [
                {"matcher": "*", "hooks": [{"type": "command", "command": command, "timeout": int(timeout_s)}]}
            ]
        }
    }


def parse_stream_line(line: str) -> list[dict]:
    """Turn one stream-json line from `claude -p --output-format stream-json` into events."""
    try:
        msg = json.loads(line)
    except json.JSONDecodeError:
        return []
    kind = msg.get("type")
    events: list[dict] = []
    if kind == "system" and msg.get("subtype") == "init" and msg.get("session_id"):
        events.append({"kind": "backend_session", "id": msg["session_id"]})
    elif kind == "assistant":
        for block in (msg.get("message") or {}).get("content") or []:
            if block.get("type") == "text" and block.get("text", "").strip():
                events.append({"kind": "text", "text": block["text"]})
            elif block.get("type") == "tool_use":
                name = block.get("name", "tool")
                events.append({"kind": "tool", "text": f"{name}: {summarize_tool(name, block.get('input'))}"})
    elif kind == "user":
        for block in (msg.get("message") or {}).get("content") or []:
            if isinstance(block, dict) and block.get("type") == "tool_result" and block.get("is_error"):
                content = block.get("content")
                if isinstance(content, list):
                    content = " ".join(c.get("text", "") for c in content if isinstance(c, dict))
                events.append({"kind": "error", "text": f"tool failed: {content}"})
    elif kind == "result":
        parts = ["done" if msg.get("subtype") == "success" and not msg.get("is_error") else "failed"]
        if msg.get("num_turns") is not None:
            parts.append(f"{msg['num_turns']} turns")
        if msg.get("total_cost_usd") is not None:
            parts.append(f"${msg['total_cost_usd']:.2f}")
        events.append({"kind": "result" if parts[0] == "done" else "error", "text": " \u00b7 ".join(parts)})
    return events


class ClaudeCliBackend(Backend):
    def __init__(self, cfg):
        self.cfg = cfg
        self._procs: dict[str, asyncio.subprocess.Process] = {}

    def build_args(self, ctx: RunContext) -> list[str]:
        system_prompt = self.cfg.system_prompt
        if ctx.workspace.kind == "computer":
            system_prompt += COMPUTER_PROMPT
        args = [
            self.cfg.claude_bin,
            "-p",
            "--output-format", "stream-json",
            "--verbose",
            "--permission-mode", self.cfg.permission_mode,
            "--settings", json.dumps(hook_settings(self.cfg.approval_timeout_s + 30)),
            "--append-system-prompt", system_prompt,
        ]
        if ctx.workspace.mcp_config:
            args += ["--mcp-config", ctx.workspace.mcp_config]
        if ctx.resume_id:
            args += ["--resume", ctx.resume_id]
        return args

    async def run(self, ctx: RunContext) -> AsyncIterator[dict]:
        env = dict(os.environ)
        env.update(
            CLAUDE_REMOTE_HOOK_URL=ctx.hook_url,
            CLAUDE_REMOTE_HOOK_TOKEN=ctx.hook_token,
            CLAUDE_REMOTE_SESSION=ctx.session_id,
        )
        try:
            proc = await asyncio.create_subprocess_exec(
                *self.build_args(ctx),
                cwd=ctx.workspace.path,
                env=env,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                limit=8 * 1024 * 1024,
                start_new_session=True,
            )
        except FileNotFoundError:
            yield {"kind": "error", "text": f"claude CLI not found: {self.cfg.claude_bin}"}
            return
        self._procs[ctx.session_id] = proc
        # The prompt goes over stdin so it never shows up in the host's process list.
        proc.stdin.write(ctx.prompt.encode())
        await proc.stdin.drain()
        proc.stdin.close()
        stderr_task = asyncio.create_task(proc.stderr.read())
        try:
            async for raw in proc.stdout:
                for event in parse_stream_line(raw.decode(errors="replace")):
                    yield event
            code = await proc.wait()
            stderr = (await stderr_task).decode(errors="replace").strip()
            if code not in (0, -signal.SIGINT, -signal.SIGTERM):
                tail = stderr.splitlines()[-1] if stderr else ""
                yield {"kind": "error", "text": f"claude exited {code}: {tail}".strip()}
        finally:
            self._procs.pop(ctx.session_id, None)
            if proc.returncode is None:
                proc.kill()

    async def stop(self, session_id: str) -> None:
        proc = self._procs.get(session_id)
        if not proc or proc.returncode is not None:
            return
        try:
            os.killpg(proc.pid, signal.SIGINT)
            await asyncio.wait_for(proc.wait(), 5)
        except (ProcessLookupError, asyncio.TimeoutError):
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
