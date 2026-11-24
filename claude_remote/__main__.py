"""CLI: `python -m claude_remote {serve,add-device,list-devices,revoke-device,init-config}`."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from .config import default_config_path, load_config
from .devices import ALL_SCOPES, DeviceRegistry

SAMPLE_CONFIG = """\
# claude-remote relay config. Every key is optional.
host = "127.0.0.1"          # keep on loopback; expose it with a TLS tunnel (see docs)
port = 8765
backend = "claude"          # "claude" runs `claude -p`; "fake" needs no Claude install
permission_mode = "default" # tools outside auto_allow_tools ask the watch first
approval_timeout_s = 90
stt = "none"                # "fake" or "command" (stt_command gets {wav})
# stt_command = "whisper-cli -m /path/ggml-base.en.bin -nt -f {wav}"
screen = "none"             # "fake" or "command" (screen_command gets {png})
# screen_command = "screencapture -x {png}"
enable_emulator = false

[[workspaces]]
id = "agent"
name = "agent repo"
path = "~/agent"

# [[workspaces]]
# id = "desktop"
# name = "Computer"
# kind = "computer"
# path = "~"
# mcp_config = "~/.config/claude-remote/computer-use.mcp.json"
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="claude_remote")
    parser.add_argument("--config", type=Path, default=None, help=f"default: {default_config_path()}")
    sub = parser.add_subparsers(dest="cmd", required=True)
    serve = sub.add_parser("serve")
    serve.add_argument("--host")
    serve.add_argument("--port", type=int)
    serve.add_argument("--fake", action="store_true", help="fake backend, STT and screen; enables the emulator")
    add = sub.add_parser("add-device")
    add.add_argument("name")
    add.add_argument("--scopes", default=",".join(ALL_SCOPES))
    sub.add_parser("list-devices")
    revoke = sub.add_parser("revoke-device")
    revoke.add_argument("name")
    sub.add_parser("init-config")
    args = parser.parse_args(argv)

    if args.cmd == "init-config":
        path = args.config or default_config_path()
        if path.exists():
            print(f"{path} already exists", file=sys.stderr)
            return 1
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(SAMPLE_CONFIG)
        print(f"wrote {path}")
        return 0

    cfg = load_config(args.config)
    registry = DeviceRegistry(cfg.devices_file)

    if args.cmd == "add-device":
        token = registry.add(args.name, [s for s in args.scopes.split(",") if s])
        print(f"device {args.name!r} added. Token (shown once, store it on the device):\n{token}")
        return 0
    if args.cmd == "list-devices":
        for d in registry.list():
            status = "revoked" if d.revoked else "active"
            print(f"{d.name:20} {status:8} scopes={','.join(d.scopes)} last_seen={d.last_seen or '-'}")
        return 0
    if args.cmd == "revoke-device":
        if not registry.revoke(args.name):
            print(f"no active device {args.name!r}", file=sys.stderr)
            return 1
        print(f"revoked {args.name!r}; a running relay drops its connections within 10s")
        return 0

    import uvicorn

    from .server import create_app

    if args.fake:
        cfg.backend, cfg.stt, cfg.screen, cfg.enable_emulator = "fake", "fake", "fake", True
    cfg.host = args.host or cfg.host
    cfg.port = args.port or cfg.port
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    uvicorn.run(create_app(cfg, registry), host=cfg.host, port=cfg.port, ws_max_size=64 * 1024, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
