"""Tool-permission requests that wait for a tap on the device."""

from __future__ import annotations

import asyncio
import secrets
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable


@dataclass
class Approval:
    id: str
    session_id: str
    tool: str
    summary: str
    expires_at: float
    future: asyncio.Future = field(repr=False)

    def public(self) -> dict:
        return {
            "request": self.id,
            "session": self.session_id,
            "tool": self.tool,
            "summary": self.summary,
            "expires": int(self.expires_at),
            "ttl": max(0, int(self.expires_at - time.time())),
        }


Notify = Callable[[str, dict], Awaitable[None]]


class ApprovalBroker:
    def __init__(self, timeout_s: float, notify: Notify):
        self.timeout_s = timeout_s
        self._notify = notify
        self._pending: dict[str, Approval] = {}

    def pending(self) -> list[Approval]:
        return list(self._pending.values())

    async def request(self, session_id: str, tool: str, summary: str) -> tuple[bool, str]:
        loop = asyncio.get_running_loop()
        approval = Approval(
            id=secrets.token_hex(4),
            session_id=session_id,
            tool=tool,
            summary=summary,
            expires_at=time.time() + self.timeout_s,
            future=loop.create_future(),
        )
        self._pending[approval.id] = approval
        await self._notify("approval", approval.public())
        try:
            allow, by = await asyncio.wait_for(approval.future, self.timeout_s)
        except asyncio.TimeoutError:
            allow, by = False, "timeout"
        finally:
            self._pending.pop(approval.id, None)
        await self._notify("approval_done", {"request": approval.id, "allow": allow, "by": by})
        return allow, by

    def resolve(self, request_id: str, allow: bool, by: str) -> bool:
        approval = self._pending.get(request_id)
        if not approval or approval.future.done():
            return False
        approval.future.set_result((bool(allow), by))
        return True

    def cancel_session(self, session_id: str) -> None:
        for approval in list(self._pending.values()):
            if approval.session_id == session_id and not approval.future.done():
                approval.future.set_result((False, "stopped"))
