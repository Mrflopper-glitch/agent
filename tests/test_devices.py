import json
import stat

import pytest

from claude_remote.devices import DeviceRegistry


def test_token_is_only_stored_hashed(registry, cfg):
    token = registry.add("watch")
    raw = cfg.devices_file.read_text()
    assert token not in raw
    assert json.loads(raw)["devices"][0]["name"] == "watch"
    assert stat.S_IMODE(cfg.devices_file.stat().st_mode) == 0o600


def test_authenticate_and_revoke(registry, cfg):
    token = registry.add("watch", ["view"])
    assert registry.authenticate(token).name == "watch"
    assert registry.authenticate(token + "x") is None
    assert registry.authenticate("") is None
    assert registry.revoke("watch")
    assert DeviceRegistry(cfg.devices_file).authenticate(token) is None


def test_duplicate_and_bad_scopes(registry):
    registry.add("watch")
    with pytest.raises(ValueError):
        registry.add("watch")
    with pytest.raises(ValueError):
        registry.add("other", ["root"])
