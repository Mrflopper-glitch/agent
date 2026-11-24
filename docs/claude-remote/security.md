# Security model

The watch can make Claude Code run commands on your computer, so the relay treats it like an SSH key.

- **Transport**: the relay binds to `127.0.0.1` and is reached through a TLS tunnel. The firmware only
  accepts `wss://`, validated against bundled roots (ISRG Root X1/X2, GTS Root R1/R4; replace
  `firmware/watch/include/root_cas.h` to pin your own). `ws://` needs the `WATCH_ALLOW_INSECURE_WS`
  build flag and is meant for a trusted LAN only.
- **Device tokens**: 32 random bytes (`crd_` prefix), shown once, stored on the host only as SHA-256
  and compared in constant time. The registry file is `0600`. Tokens live in the watch's NVS and are
  never echoed over serial. `revoke-device` drops live connections within 10 s.
- **Scopes**: `view`, `prompt`, `approve`, `screen`, checked on every message. A shared display can
  be `view` only.
- **Approvals**: everything except read-only tools (`Read`, `Glob`, `Grep`, `LS`, `TodoWrite`,
  `WebSearch` by default) needs an explicit tap. Timeouts, a stopped session, or an unreachable relay
  all deny. The hook endpoint needs a per-session random secret, so other local processes cannot
  forge approvals.
- **Limits**: failed logins are rate-limited per address; prompts (4000 chars), frames (16 KB text),
  audio clips (30 s) and event text (600 chars) are bounded.
- **Audit**: connects, prompts, approvals, stops and screen captures are appended to
  `data/claude_remote/audit.log` (JSON lines).
- **Prompts stay off the process list**: prompts go to `claude` over stdin, not argv.

Known gaps for this prototype: no on-device PIN or wrist-detect lock, no certificate pinning by
default (CA validation only), no flash encryption or secure boot on the ESP32 (enable both before
carrying a provisioned watch), and the computer-use workspace inherits whatever access the MCP
server you configure has.
