"""Relay configuration, loaded from a TOML file with safe defaults."""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "claude_remote"

DEFAULT_SYSTEM_PROMPT = (
    "Your replies are read on a 240x240 smartwatch screen. Keep each reply short: "
    "lead with the outcome in one or two sentences, avoid tables and long code blocks, "
    "and say when a longer result was written to a file instead."
)

# Read-only tools that never need a tap on the watch.
DEFAULT_AUTO_ALLOW = ["Read", "Glob", "Grep", "LS", "TodoWrite", "WebSearch"]


@dataclass
class Workspace:
    id: str
    name: str
    path: str
    kind: str = "code"  # "code" (Claude Code in a repo) or "computer" (computer-use engine)
    mcp_config: str | None = None


@dataclass
class Config:
    host: str = "127.0.0.1"
    port: int = 8765
    data_dir: Path = DEFAULT_DATA_DIR
    backend: str = "claude"  # "claude" or "fake"
    claude_bin: str = "claude"
    permission_mode: str = "default"
    system_prompt: str = DEFAULT_SYSTEM_PROMPT
    auto_allow_tools: list[str] = field(default_factory=lambda: list(DEFAULT_AUTO_ALLOW))
    approval_timeout_s: float = 90.0
    max_event_chars: int = 600
    max_prompt_chars: int = 4000
    history_events: int = 200
    auth_timeout_s: float = 5.0
    max_auth_failures: int = 5
    auth_failure_window_s: float = 300.0
    stt: str = "none"  # "none", "fake" or "command"
    stt_command: str | None = None  # e.g. "whisper-cli -m ggml-base.en.bin -nt -f {wav}"
    max_audio_seconds: float = 30.0
    screen: str = "none"  # "none", "fake" or "command"
    screen_command: str | None = None  # e.g. "screencapture -x {png}" (macOS)
    enable_emulator: bool = False
    workspaces: list[Workspace] = field(default_factory=list)
    public_url: str | None = None

    @property
    def devices_file(self) -> Path:
        return self.data_dir / "devices.json"

    @property
    def audit_file(self) -> Path:
        return self.data_dir / "audit.log"

    def workspace(self, workspace_id: str) -> Workspace | None:
        return next((w for w in self.workspaces if w.id == workspace_id), None)


def default_config_path() -> Path:
    return Path(os.environ.get("CLAUDE_REMOTE_CONFIG", DEFAULT_DATA_DIR / "config.toml"))


def load_config(path: Path | None = None) -> Config:
    path = path or default_config_path()
    raw: dict = {}
    if path.exists():
        raw = tomllib.loads(path.read_text())
    workspaces = [Workspace(**w) for w in raw.pop("workspaces", [])]
    if "data_dir" in raw:
        raw["data_dir"] = Path(raw["data_dir"]).expanduser()
    cfg = Config(**raw, workspaces=workspaces)
    if not cfg.workspaces:
        cfg.workspaces = [Workspace(id="home", name="Home", path=str(Path.home()))]
    for ws in cfg.workspaces:
        ws.path = str(Path(ws.path).expanduser().resolve())
    return cfg
