import base64

import pytest
from starlette.websockets import WebSocketDisconnect

from .conftest import login, recv_until


def test_rejects_bad_token(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "auth", "token": "crd_nope"})
        assert ws.receive_json()["code"] == "unauthorized"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 4401


def test_rate_limits_failed_logins(client, cfg, token):
    for _ in range(cfg.max_auth_failures):
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "token": "crd_nope"})
            ws.receive_json()
    with client.websocket_connect("/ws") as ws:
        assert ws.receive_json()["code"] == "rate_limited"


def test_hello_lists_workspaces(client, token):
    ws, hello = login(client, token)
    assert hello["workspaces"] == [{"id": "repo", "name": "Repo", "kind": "code"}]
    assert hello["features"] == {"stt": True, "screen": True}
    ws.send_json({"type": "ping", "t": 7})
    assert ws.receive_json() == {"type": "pong", "t": 7}


@pytest.mark.parametrize("allow,expected", [(True, "clean"), (False, "Skipped")])
def test_prompt_approval_flow(client, token, allow, expected):
    ws, _ = login(client, token)
    ws.send_json({"type": "new", "workspace": "repo", "text": "what changed?"})
    approval, seen = recv_until(ws, "approval")
    history = next(m for m in seen if m["type"] == "history")
    session = history["session"]
    assert approval["tool"] == "Bash" and approval["summary"] == "git status --short"
    ws.send_json({"type": "approve", "request": approval["request"], "allow": allow})
    done, _ = recv_until(ws, "approval_done")
    assert done["allow"] is allow and done["by"] == "watch"
    _, seen = recv_until(ws, "event")
    events = [m for m in seen if m["type"] == "event"]
    while not any(e["kind"] == "result" for e in events):
        msg = ws.receive_json()
        if msg["type"] == "event":
            events.append(msg)
    assert any(expected in e["text"] for e in events)
    state, _ = recv_until(ws, "state")
    assert state == {"type": "state", "session": session, "state": "idle"}
    ws.send_json({"type": "open", "session": session})
    replay, _ = recv_until(ws, "history")
    assert [e["kind"] for e in replay["events"]][0] == "user"


def test_scopes_are_enforced(client, registry):
    viewer = registry.add("viewer", ["view"])
    ws, _ = login(client, viewer)
    ws.send_json({"type": "new", "workspace": "repo", "text": "rm -rf"})
    assert ws.receive_json()["code"] == "forbidden"
    ws.send_json({"type": "screen"})
    assert ws.receive_json()["code"] == "forbidden"


def test_bad_requests_do_not_drop_connection(client, token):
    ws, _ = login(client, token)
    ws.send_json({"type": "new", "workspace": "nope", "text": "hi"})
    assert ws.receive_json()["code"] == "bad_request"
    ws.send_json({"type": "launch_missiles"})
    assert ws.receive_json()["code"] == "unknown_type"
    ws.send_bytes(b"\x00\x01")
    assert ws.receive_json()["code"] == "bad_request"
    ws.send_text("not json")
    assert ws.receive_json()["code"] == "bad_request"


def test_push_to_talk_transcript(client, token):
    ws, _ = login(client, token)
    ws.send_json({"type": "audio_start", "rate": 16000})
    ws.send_bytes(b"\x00\x00" * 16000)
    ws.send_json({"type": "audio_end"})
    msg, _ = recv_until(ws, "transcript")
    assert "1.0s" in msg["text"]


def test_audio_length_cap(client, cfg, token):
    ws, _ = login(client, token)
    ws.send_json({"type": "audio_start", "rate": 8000})
    ws.send_bytes(b"\x00" * int(cfg.max_audio_seconds * 8000 * 2 + 2))
    assert "too long" in ws.receive_json()["msg"]


def test_screen_preview_fits_requested_size(client, token):
    ws, _ = login(client, token)
    ws.send_json({"type": "screen", "w": 240, "h": 240})
    msg, _ = recv_until(ws, "screen")
    assert msg["w"] <= 240 and msg["h"] <= 240
    assert base64.b64decode(msg["jpeg"])[:2] == b"\xff\xd8"


def test_hook_requires_session_token(client):
    resp = client.post("/internal/hook", json={"tool_name": "Bash"}, headers={"X-Claude-Remote-Hook": "nope"})
    assert resp.status_code == 403


def test_hook_auto_allows_read_only_tools(client, token):
    relay = client.app.state.relay
    ws, _ = login(client, token)
    ws.send_json({"type": "new", "workspace": "repo", "text": "hi"})
    recv_until(ws, "approval")
    session = relay.sessions.list()[0]
    resp = client.post("/internal/hook", json={"tool_name": "Read", "tool_input": {"file_path": "x"}},
                       headers={"X-Claude-Remote-Hook": session.hook_token})
    assert resp.json()["hookSpecificOutput"]["permissionDecision"] == "allow"


def test_emulator_disabled_by_default(client):
    assert client.get("/emulator/").status_code == 404
    assert client.get("/healthz").json()["ok"] is True


def test_emulator_served_when_enabled(cfg, registry):
    from fastapi.testclient import TestClient

    from claude_remote.backends import FakeBackend
    from claude_remote.server import create_app

    cfg.enable_emulator = True
    with TestClient(create_app(cfg, registry, FakeBackend(delay_s=0))) as c:
        page = c.get("/emulator/")
        assert page.status_code == 200 and "watch.js" in page.text
        assert c.get("/emulator/watch.js").status_code == 200


def _hook_after_watch(client, token, tool, answer):
    import threading

    relay = client.app.state.relay
    ws, _ = login(client, token)
    ws.send_json({"type": "new", "workspace": "repo", "text": "hi"})
    first, _ = recv_until(ws, "approval")
    ws.send_json({"type": "approve", "request": first["request"], "allow": True})
    session = relay.sessions.list()[0]
    result = {}

    def call():
        result["resp"] = client.post("/internal/hook", json={"tool_name": tool, "tool_input": {"command": "rm -rf build"}},
                                     headers={"X-Claude-Remote-Hook": session.hook_token})

    worker = threading.Thread(target=call)
    worker.start()
    card, _ = recv_until(ws, "approval")
    assert card["tool"] == tool and "rm -rf build" in card["summary"]
    if answer is not None:
        ws.send_json({"type": "approve", "request": card["request"], "allow": answer})
    worker.join(10)
    return result["resp"].json()["hookSpecificOutput"]


def test_hook_waits_for_watch_allow(client, token):
    assert _hook_after_watch(client, token, "Bash", True)["permissionDecision"] == "allow"


def test_hook_waits_for_watch_deny(client, token):
    assert _hook_after_watch(client, token, "Bash", False)["permissionDecision"] == "deny"


def test_hook_denies_on_timeout(client, token):
    client.app.state.relay.broker.timeout_s = 0.3
    out = _hook_after_watch(client, token, "Bash", None)
    assert out["permissionDecision"] == "deny" and "no answer" in out["permissionDecisionReason"]


def test_hook_rejects_oversized_body(client, token):
    relay = client.app.state.relay
    ws, _ = login(client, token)
    ws.send_json({"type": "new", "workspace": "repo", "text": "hi"})
    recv_until(ws, "approval")
    session = relay.sessions.list()[0]
    resp = client.post("/internal/hook", content=b"{" + b" " * (300 * 1024) + b"}",
                       headers={"X-Claude-Remote-Hook": session.hook_token, "content-type": "application/json"})
    assert resp.status_code == 413


def test_history_fits_watch_frame(client, token):
    import json

    relay = client.app.state.relay
    ws, _ = login(client, token)
    ws.send_json({"type": "new", "workspace": "repo", "text": "hi"})
    recv_until(ws, "approval")
    session = relay.sessions.list()[0]
    for i in range(200):
        session.events.append({"session": session.id, "seq": i, "kind": "text", "text": "x" * 600})
    ws.send_json({"type": "open", "session": session.id})
    history, _ = recv_until(ws, "history")
    assert len(json.dumps(history)) < 15 * 1024
    assert history["events"][-1]["seq"] == 199


def test_revocation_closes_replaced_device(client, registry, token):
    relay = client.app.state.relay
    ws, _ = login(client, token)
    registry.revoke("watch")
    registry.add("watch")
    import asyncio

    async def one_pass():
        task = asyncio.create_task(relay.watch_revocations(interval_s=0))
        await asyncio.sleep(0.05)
        task.cancel()

    client.portal.call(one_pass)
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        for _ in range(10):
            ws.receive_json()
