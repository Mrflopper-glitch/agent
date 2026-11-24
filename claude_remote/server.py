"""FastAPI app: the device WebSocket, the Claude Code hook endpoint, and the dev emulator."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import PROTOCOL_VERSION, __version__
from .approvals import ApprovalBroker
from .backends import Backend, make_backend
from .config import Config
from .devices import Device, DeviceRegistry
from .media import MediaError, capture_screen, transcribe
from .protocol import decode, encode, summarize_tool
from .sessions import SessionManager

MAX_HOOK_BODY = 256 * 1024
# The ESP32 WebSockets client drops frames over 15 KB (WEBSOCKETS_MAX_DATA_SIZE).
HISTORY_FRAME_BUDGET = 12 * 1024

log = logging.getLogger(__name__)
EMULATOR_DIR = Path(__file__).resolve().parent / "emulator"


@dataclass(eq=False)
class Connection:
    ws: WebSocket
    device: Device
    subscribed: str | None = None
    audio: bytearray | None = None
    audio_rate: int = 16000
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def can(self, scope: str) -> bool:
        return scope in self.device.scopes

    async def send(self, msg_type: str, **fields) -> None:
        async with self.lock:
            await self.ws.send_text(encode(msg_type, **fields))


class AuthLimiter:
    def __init__(self, max_failures: int, window_s: float):
        self.max_failures = max_failures
        self.window_s = window_s
        self._failures: dict[str, deque] = defaultdict(deque)

    def blocked(self, key: str) -> bool:
        q = self._failures[key]
        while q and q[0] < time.time() - self.window_s:
            q.popleft()
        return len(q) >= self.max_failures

    def fail(self, key: str) -> None:
        self._failures[key].append(time.time())


class Relay:
    def __init__(self, cfg: Config, registry: DeviceRegistry, backend: Backend):
        self.cfg = cfg
        self.registry = registry
        self.connections: set[Connection] = set()
        self.broker = ApprovalBroker(cfg.approval_timeout_s, self._notify_approval)
        self.sessions = SessionManager(cfg, backend, self.broker, self.broadcast)
        self.limiter = AuthLimiter(cfg.max_auth_failures, cfg.auth_failure_window_s)

    def audit(self, device: str, action: str, **details) -> None:
        self.cfg.audit_file.parent.mkdir(parents=True, exist_ok=True)
        with self.cfg.audit_file.open("a") as f:
            f.write(json.dumps({"ts": time.time(), "device": device, "action": action, **details}) + "\n")

    async def broadcast(self, msg_type: str, fields: dict, session_id: str | None) -> None:
        for conn in list(self.connections):
            if not conn.can("view"):
                continue
            if msg_type == "event" and conn.subscribed != session_id:
                continue
            try:
                await conn.send(msg_type, **fields)
            except Exception:  # noqa: BLE001 - a dead socket is cleaned up by its own handler
                pass

    async def _notify_approval(self, msg_type: str, fields: dict) -> None:
        for conn in list(self.connections):
            if conn.can("approve"):
                try:
                    await conn.send(msg_type, **fields)
                except Exception:  # noqa: BLE001
                    pass

    def hello_fields(self, device: Device) -> dict:
        return {
            "device": device.name,
            "server": __version__,
            "protocol": PROTOCOL_VERSION,
            "scopes": device.scopes,
            "workspaces": [{"id": w.id, "name": w.name, "kind": w.kind} for w in self.cfg.workspaces],
            "features": {"stt": self.cfg.stt != "none", "screen": self.cfg.screen != "none"},
            "limits": {"prompt": self.cfg.max_prompt_chars, "audio_s": self.cfg.max_audio_seconds},
        }

    # --- device protocol -------------------------------------------------

    async def authenticate(self, ws: WebSocket) -> Device | None:
        client = ws.client.host if ws.client else "unknown"
        if self.limiter.blocked(client):
            await ws.send_text(encode("error", code="rate_limited", msg="too many failed logins"))
            return None
        try:
            raw = await asyncio.wait_for(ws.receive_text(), self.cfg.auth_timeout_s)
            msg = decode(raw)
        except (asyncio.TimeoutError, ValueError, KeyError):
            msg = {}
        self.registry.load()  # pick up add/revoke done by the CLI while the relay runs
        device = self.registry.authenticate(msg.get("token", "")) if msg.get("type") == "auth" else None
        if device is None:
            self.limiter.fail(client)
            log.warning("rejected device login from %s", client)
            await ws.send_text(encode("error", code="unauthorized", msg="bad or missing device token"))
            return None
        self.audit(device.name, "connect", client=client, fw=str(msg.get("fw", ""))[:40])
        return device

    async def handle(self, conn: Connection, msg: dict) -> None:
        t = msg["type"]
        need = {
            "list": "view", "open": "view", "new": "prompt", "prompt": "prompt", "stop": "prompt",
            "approve": "approve", "audio_start": "prompt", "audio_end": "prompt", "screen": "screen",
        }.get(t)
        if t == "ping":
            await conn.send("pong", t=msg.get("t"))
            return
        if need is None:
            await conn.send("error", code="unknown_type", msg=f"unknown message type {t!r}")
            return
        if not conn.can(need):
            await conn.send("error", code="forbidden", msg=f"device lacks the {need!r} scope")
            return
        sm = self.sessions
        if t == "list":
            await conn.send("sessions", items=[s.public() for s in sm.list()])
        elif t == "open":
            session = self._session(msg)
            conn.subscribed = session.id
            await conn.send("history", session=session.id, state=session.state, events=sm.history(session, HISTORY_FRAME_BUDGET))
        elif t == "new":
            workspace = self.cfg.workspace(str(msg.get("workspace", "")))
            if workspace is None:
                raise ValueError("unknown workspace")
            session = await sm.create(workspace, str(msg.get("text", "")))
            conn.subscribed = session.id
            self.audit(conn.device.name, "new", session=session.id, workspace=workspace.id, text=session.title)
            await conn.send("history", session=session.id, state=session.state, events=sm.history(session, HISTORY_FRAME_BUDGET))
        elif t == "prompt":
            session = self._session(msg)
            conn.subscribed = session.id
            text = str(msg.get("text", ""))
            self.audit(conn.device.name, "prompt", session=session.id, text=text[:200])
            await sm.prompt(session, text)
        elif t == "stop":
            session = self._session(msg)
            self.audit(conn.device.name, "stop", session=session.id)
            await sm.stop(session)
        elif t == "approve":
            allow = bool(msg.get("allow"))
            ok = self.broker.resolve(str(msg.get("request", "")), allow, conn.device.name)
            self.audit(conn.device.name, "approve", request=msg.get("request"), allow=allow, ok=ok)
            if not ok:
                await conn.send("error", code="no_such_request", msg="approval already resolved or expired")
        elif t == "audio_start":
            conn.audio = bytearray()
            conn.audio_rate = int(msg.get("rate", 16000))
            if conn.audio_rate not in (8000, 16000):
                conn.audio = None
                raise ValueError("audio rate must be 8000 or 16000")
        elif t == "audio_end":
            if conn.audio is None:
                raise ValueError("no audio in progress")
            pcm, conn.audio = bytes(conn.audio), None
            try:
                text = await transcribe(self.cfg, pcm, conn.audio_rate)
            except MediaError as exc:
                await conn.send("error", code="stt_failed", msg=str(exc))
                return
            await conn.send("transcript", text=text[: self.cfg.max_prompt_chars])
        elif t == "screen":
            try:
                frame = await capture_screen(self.cfg, int(msg.get("w", 240)), int(msg.get("h", 240)))
            except MediaError as exc:
                await conn.send("error", code="screen_failed", msg=str(exc))
                return
            self.audit(conn.device.name, "screen")
            await conn.send("screen", **frame)

    def _session(self, msg: dict):
        session = self.sessions.get(str(msg.get("session", "")))
        if session is None:
            raise ValueError("unknown session")
        return session

    def audio_chunk(self, conn: Connection, data: bytes) -> None:
        if conn.audio is None:
            raise ValueError("binary frame outside audio_start/audio_end")
        limit = int(self.cfg.max_audio_seconds * conn.audio_rate * 2)
        if len(conn.audio) + len(data) > limit:
            conn.audio = None
            raise ValueError("audio clip too long")
        conn.audio.extend(data)

    async def device_socket(self, ws: WebSocket) -> None:
        await ws.accept()
        device = await self.authenticate(ws)
        if device is None:
            await ws.close(code=4401)
            return
        conn = Connection(ws=ws, device=device)
        self.connections.add(conn)
        try:
            await conn.send("hello", **self.hello_fields(device))
            if conn.can("view"):
                await conn.send("sessions", items=[s.public() for s in self.sessions.list()])
            if conn.can("approve"):
                for approval in self.broker.pending():
                    await conn.send("approval", **approval.public())
            while True:
                frame = await ws.receive()
                if frame["type"] == "websocket.disconnect":
                    break
                try:
                    if frame.get("bytes") is not None:
                        self.audio_chunk(conn, frame["bytes"])
                    else:
                        await self.handle(conn, decode(frame.get("text") or ""))
                except (ValueError, RuntimeError) as exc:
                    await conn.send("error", code="bad_request", msg=str(exc))
        except WebSocketDisconnect:
            pass
        finally:
            self.connections.discard(conn)
            self.audit(device.name, "disconnect")

    async def watch_revocations(self, interval_s: float = 10.0) -> None:
        while True:
            await asyncio.sleep(interval_s)
            self.registry.load()
            active = {d.token_hash for d in self.registry.list() if not d.revoked}
            for conn in list(self.connections):
                if conn.device.token_hash not in active:
                    log.warning("closing connection of revoked device %s", conn.device.name)
                    await conn.ws.close(code=4403)

    # --- Claude Code hook ------------------------------------------------

    async def hook(self, token: str, payload: dict) -> dict:
        session = self.sessions.by_hook_token(token) if token else None
        if session is None:
            raise HTTPException(status_code=403, detail="bad hook token")
        tool = str(payload.get("tool_name", "tool"))
        if tool in self.cfg.auto_allow_tools:
            allow, reason = True, "auto-allowed read-only tool"
        else:
            summary = summarize_tool(tool, payload.get("tool_input"))
            allow, by = await self.sessions.request_approval(session, tool, summary)
            reason = f"{'approved' if allow else 'denied'} from watch ({by})" if by != "timeout" else "no answer from watch"
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow" if allow else "deny",
                "permissionDecisionReason": reason,
            }
        }


def create_app(cfg: Config, registry: DeviceRegistry | None = None, backend: Backend | None = None) -> FastAPI:
    registry = registry or DeviceRegistry(cfg.devices_file)
    relay = Relay(cfg, registry, backend or make_backend(cfg))

    @asynccontextmanager
    async def lifespan(_app):
        watcher = asyncio.create_task(relay.watch_revocations())
        yield
        watcher.cancel()
        await relay.sessions.shutdown()

    app = FastAPI(title="claude-remote", version=__version__, lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.relay = relay

    @app.get("/healthz")
    async def healthz():
        return {"ok": True, "version": __version__}

    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket):
        await relay.device_socket(ws)

    @app.post("/internal/hook")
    async def hook_endpoint(request: Request, x_claude_remote_hook: str = Header(default="")):
        if not x_claude_remote_hook or relay.sessions.by_hook_token(x_claude_remote_hook) is None:
            raise HTTPException(status_code=403, detail="bad hook token")
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_HOOK_BODY:
                raise HTTPException(status_code=413, detail="hook payload too large")
        try:
            payload = json.loads(body)
        except ValueError:
            raise HTTPException(status_code=400, detail="hook payload is not JSON") from None
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="hook payload must be an object")
        return await relay.hook(x_claude_remote_hook, payload)

    if cfg.enable_emulator:
        app.mount("/emulator", StaticFiles(directory=EMULATOR_DIR, html=True), name="emulator")

        @app.get("/")
        async def root():
            return RedirectResponse("/emulator/")

    return app
