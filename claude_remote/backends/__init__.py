from .base import Backend, RunContext
from .claude_cli import ClaudeCliBackend
from .fake import FakeBackend

__all__ = ["Backend", "RunContext", "ClaudeCliBackend", "FakeBackend", "make_backend"]


def make_backend(cfg) -> Backend:
    if cfg.backend == "fake":
        return FakeBackend()
    if cfg.backend == "claude":
        return ClaudeCliBackend(cfg)
    raise ValueError(f"unknown backend {cfg.backend!r}")
