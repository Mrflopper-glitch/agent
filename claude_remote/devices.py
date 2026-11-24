"""Device registry: per-device bearer tokens, stored only as SHA-256 hashes."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

ALL_SCOPES = ("view", "prompt", "approve", "screen")
TOKEN_PREFIX = "crd_"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass
class Device:
    name: str
    token_hash: str
    scopes: list[str] = field(default_factory=lambda: list(ALL_SCOPES))
    created_at: float = field(default_factory=time.time)
    last_seen: float | None = None
    revoked: bool = False


class DeviceRegistry:
    def __init__(self, path: Path):
        self.path = path
        self._devices: dict[str, Device] = {}
        self.load()

    def load(self) -> None:
        if self.path.exists():
            data = json.loads(self.path.read_text())
            self._devices = {d["name"]: Device(**d) for d in data.get("devices", [])}

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"devices": [asdict(d) for d in self._devices.values()]}, indent=2))
        os.chmod(tmp, 0o600)
        tmp.replace(self.path)

    def add(self, name: str, scopes: list[str] | None = None) -> str:
        if name in self._devices and not self._devices[name].revoked:
            raise ValueError(f"device {name!r} already exists; revoke it first")
        bad = set(scopes or []) - set(ALL_SCOPES)
        if bad:
            raise ValueError(f"unknown scopes: {sorted(bad)}")
        token = TOKEN_PREFIX + secrets.token_urlsafe(32)
        self._devices[name] = Device(name=name, token_hash=hash_token(token), scopes=list(scopes or ALL_SCOPES))
        self.save()
        return token

    def revoke(self, name: str) -> bool:
        dev = self._devices.get(name)
        if not dev or dev.revoked:
            return False
        dev.revoked = True
        self.save()
        return True

    def list(self) -> list[Device]:
        return list(self._devices.values())

    def authenticate(self, token: str) -> Device | None:
        if not isinstance(token, str) or not token.startswith(TOKEN_PREFIX):
            return None
        candidate = hash_token(token)
        match = None
        for dev in self._devices.values():
            # Compare against every device so timing does not reveal which hash matched.
            if hmac.compare_digest(dev.token_hash, candidate) and not dev.revoked:
                match = dev
        if match:
            match.last_seen = time.time()
        return match
