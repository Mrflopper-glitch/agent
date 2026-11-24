"""Scripted backend for demos and tests: no Claude install or API key needed."""

from __future__ import annotations

import asyncio
import secrets
from typing import AsyncIterator

from .base import Backend, RunContext


class FakeBackend(Backend):
    def __init__(self, delay_s: float = 0.4):
        self.delay_s = delay_s
        self._stopped: set[str] = set()

    async def _pause(self, ctx: RunContext) -> bool:
        await asyncio.sleep(self.delay_s)
        return ctx.session_id not in self._stopped

    async def run(self, ctx: RunContext) -> AsyncIterator[dict]:
        self._stopped.discard(ctx.session_id)
        if not ctx.resume_id:
            yield {"kind": "backend_session", "id": "fake-" + secrets.token_hex(4)}
        if not await self._pause(ctx):
            return
        yield {"kind": "text", "text": f"Looking into: {ctx.prompt}"}
        command = "git status --short"
        yield {"kind": "tool", "text": f"Bash: {command}"}
        allowed = await ctx.request_approval("Bash", command)
        if not await self._pause(ctx):
            return
        if allowed:
            yield {"kind": "text", "text": "Working tree is clean. Nothing to commit."}
        else:
            yield {"kind": "text", "text": "Skipped the command, as you asked."}
        yield {"kind": "result", "text": "done \u00b7 2 turns \u00b7 $0.00"}

    async def stop(self, session_id: str) -> None:
        self._stopped.add(session_id)
