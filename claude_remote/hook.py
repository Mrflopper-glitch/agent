"""Claude Code PreToolUse hook that asks the relay (and so the watch) for a decision.

Standard library only: Claude Code runs it as a plain command with the relay's
URL and a per-session token in the environment.
"""

import json
import os
import sys
import urllib.error
import urllib.request


def decision(allow: bool, reason: str) -> dict:
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow" if allow else "deny",
            "permissionDecisionReason": reason,
        }
    }


def main() -> int:
    url = os.environ.get("CLAUDE_REMOTE_HOOK_URL")
    token = os.environ.get("CLAUDE_REMOTE_HOOK_TOKEN")
    payload = sys.stdin.read()
    if not url or not token:
        # Not launched by the relay: stay out of the way.
        return 0
    req = urllib.request.Request(
        url,
        data=payload.encode(),
        headers={"Content-Type": "application/json", "X-Claude-Remote-Hook": token},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=float(os.environ.get("CLAUDE_REMOTE_HOOK_TIMEOUT", "150"))) as resp:
            result = json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        result = decision(False, f"claude-remote relay unreachable: {exc}")
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
