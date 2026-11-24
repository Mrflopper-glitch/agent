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
