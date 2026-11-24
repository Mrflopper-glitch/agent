"""Relay-side Claude sessions: state, bounded event history, and turn execution."""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Awaitable, Callable

from .approvals import ApprovalBroker
from .backends import Backend, RunContext
from .config import Config, Workspace
from .protocol import ERROR, IDLE, RUNNING, WAITING, clip

log = logging.getLogger(__name__)
Broadcast = Callable[[str, dict, str | None], Awaitable[None]]


@dataclass
class Session:
    id: str
    workspace_id: str
    title: str
    state: str = IDLE
    backend_id: str | None = None
    updated_at: float = field(default_factory=time.time)
    seq: int = 0
    events: deque = field(default_factory=lambda: deque(maxlen=200))
    hook_token: str = field(default_factory=lambda: secrets.token_urlsafe(24))
    task: asyncio.Task | None = None

    def public(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "state": self.state,
            "workspace": self.workspace_id,
            "updated": int(self.updated_at),
        }


class SessionManager:
    def __init__(self, cfg: Config, backend: Backend, broker: ApprovalBroker, broadcast: Broadcast):
        self.cfg = cfg
        self.backend = backend
        self.broker = broker
        self._broadcast = broadcast
        self._sessions: dict[str, Session] = {}
        self._store = cfg.data_dir / "sessions.json"
        self.hook_url = f"http://127.0.0.1:{cfg.port}/internal/hook"
        self._load()

    # Persistence keeps backend ids so a restarted relay can still resume conversations.
    def _load(self) -> None:
        if not self._store.exists():
            return
        for item in json.loads(self._store.read_text()):
            s = Session(id=item["id"], workspace_id=item["workspace"], title=item["title"],
                        backend_id=item.get("backend_id"), updated_at=item.get("updated", time.time()))
            s.events = deque(maxlen=self.cfg.history_events)
            self._sessions[s.id] = s

    def _save(self) -> None:
        self._store.parent.mkdir(parents=True, exist_ok=True)
        data = [{"id": s.id, "workspace": s.workspace_id, "title": s.title,
                 "backend_id": s.backend_id, "updated": s.updated_at} for s in self._sessions.values()]
        self._store.write_text(json.dumps(data, indent=2))

    def list(self) -> list[Session]:
        return sorted(self._sessions.values(), key=lambda s: s.updated_at, reverse=True)

    def get(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def by_hook_token(self, token: str) -> Session | None:
        return next((s for s in self._sessions.values() if secrets.compare_digest(s.hook_token, token)), None)

    def history(self, session: Session) -> list[dict]:
        return list(session.events)

    async def _emit(self, session: Session, kind: str, text: str) -> None:
        session.seq += 1
        session.updated_at = time.time()
        event = {"session": session.id, "seq": session.seq, "kind": kind,
                 "text": clip(text, self.cfg.max_event_chars)}
        session.events.append(event)
        await self._broadcast("event", event, session.id)

    async def _set_state(self, session: Session, state: str) -> None:
        if session.state != state:
            session.state = state
            await self._broadcast("state", {"session": session.id, "state": state}, None)

    def _check_prompt(self, text: str) -> str:
        text = (text or "").strip()
        if not text:
            raise ValueError("empty prompt")
        if len(text) > self.cfg.max_prompt_chars:
            raise ValueError("prompt too long")
        return text

    async def create(self, workspace: Workspace, text: str) -> Session:
        text = self._check_prompt(text)
        session = Session(id=secrets.token_hex(4), workspace_id=workspace.id, title=clip(text, 40))
        session.events = deque(maxlen=self.cfg.history_events)
        self._sessions[session.id] = session
        self._save()
        await self._broadcast("sessions", {"items": [s.public() for s in self.list()]}, None)
        await self.prompt(session, text)
        return session

    async def prompt(self, session: Session, text: str) -> None:
        text = self._check_prompt(text)
        if session.task and not session.task.done():
            raise RuntimeError("session is busy")
        workspace = self.cfg.workspace(session.workspace_id)
        if workspace is None:
            raise ValueError("workspace no longer configured")
        await self._emit(session, "user", text)
        await self._set_state(session, RUNNING)
        session.task = asyncio.create_task(self._run(session, workspace, text))

    async def _request_approval(self, session: Session, tool: str, summary: str) -> bool:
        await self._set_state(session, WAITING)
        try:
            allow, _ = await self.broker.request(session.id, tool, summary)
        finally:
            await self._set_state(session, RUNNING)
        return allow

    async def _run(self, session: Session, workspace: Workspace, text: str) -> None:
        ctx = RunContext(
            session_id=session.id,
            workspace=workspace,
            prompt=text,
            resume_id=session.backend_id,
            hook_url=self.hook_url,
            hook_token=session.hook_token,
            request_approval=lambda tool, summary: self._request_approval(session, tool, summary),
        )
        final_state = IDLE
        try:
            async for event in self.backend.run(ctx):
                if event["kind"] == "backend_session":
                    session.backend_id = event["id"]
                    self._save()
                    continue
                if event["kind"] == "error":
                    final_state = ERROR
                await self._emit(session, event["kind"], event.get("text", ""))
        except asyncio.CancelledError:
            await self._emit(session, "status", "stopped")
            raise
        except Exception as exc:  # noqa: BLE001 - surface any backend failure on the device
            log.exception("backend failed")
            final_state = ERROR
            await self._emit(session, "error", f"backend error: {exc}")
        finally:
            self._save()
            await self._set_state(session, final_state)

    async def stop(self, session: Session) -> None:
        self.broker.cancel_session(session.id)
        await self.backend.stop(session.id)
        if session.task and not session.task.done():
            try:
                await asyncio.wait_for(asyncio.shield(session.task), 6)
            except asyncio.TimeoutError:
                session.task.cancel()
        await self._emit(session, "status", "stopped")

    async def shutdown(self) -> None:
        for session in self._sessions.values():
            if session.task and not session.task.done():
                await self.stop(session)
