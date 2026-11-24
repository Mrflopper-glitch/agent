from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Awaitable, Callable

from ..config import Workspace


@dataclass
class RunContext:
    session_id: str
    workspace: Workspace
    prompt: str
    resume_id: str | None
    hook_url: str
    hook_token: str
    request_approval: Callable[[str, str], Awaitable[bool]]


class Backend(ABC):
    """Runs one prompt turn and yields events.

    Each event is a dict with a ``kind``: one of protocol.EVENT_KINDS, or
    ``"backend_session"`` with the ``id`` to resume the conversation later.
    """

    @abstractmethod
    def run(self, ctx: RunContext) -> AsyncIterator[dict]: ...

    async def stop(self, session_id: str) -> None:
        """Interrupt the running turn of ``session_id``, if any."""
