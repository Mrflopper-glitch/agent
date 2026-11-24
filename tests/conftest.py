from contextlib import ExitStack

import pytest
from fastapi.testclient import TestClient

from claude_remote.backends import FakeBackend
from claude_remote.config import Config, Workspace
from claude_remote.devices import DeviceRegistry
from claude_remote.server import create_app


@pytest.fixture
def cfg(tmp_path):
    return Config(
        data_dir=tmp_path / "data",
        backend="fake",
        stt="fake",
        screen="fake",
        approval_timeout_s=5,
        workspaces=[Workspace(id="repo", name="Repo", path=str(tmp_path))],
    )


@pytest.fixture
def registry(cfg):
    return DeviceRegistry(cfg.devices_file)


@pytest.fixture
def token(registry):
    return registry.add("watch")


@pytest.fixture
def client(cfg, registry):
    app = create_app(cfg, registry, FakeBackend(delay_s=0))
    with TestClient(app) as c, ExitStack() as sockets:
        c.sockets = sockets
        yield c


def login(client, token):
    ws = client.sockets.enter_context(client.websocket_connect("/ws"))
    ws.send_json({"type": "auth", "token": token, "fw": "test"})
    hello = ws.receive_json()
    assert hello["type"] == "hello", hello
    sessions = ws.receive_json()
    assert sessions["type"] == "sessions"
    return ws, hello


def recv_until(ws, msg_type, limit=50):
    seen = []
    for _ in range(limit):
        msg = ws.receive_json()
        seen.append(msg)
        if msg["type"] == msg_type:
            return msg, seen
    raise AssertionError(f"no {msg_type!r} in {seen}")
