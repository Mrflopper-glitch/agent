# claude-remote: a watch-sized remote for Claude Code

A wrist-sized client (reference: LilyGO T-Watch S3) that shows concise, streamed Claude Code
replies, takes push-to-talk prompts, and approves or denies tool use, from any Wi-Fi or a phone
hotspot. Claude Code and any computer-use engine run on your host (or a cloud VM); the watch is only
the display, input, audio and a secure remote client.

```
 T-Watch S3 (ESP32-S3)                    host / cloud VM
 ┌─────────────────────┐   wss:// (TLS)   ┌──────────────────────────────────────────┐
 │ touch, scroll, PTT  │ ───────────────▶ │ TLS tunnel (Cloudflare / Tailscale / ...) │
 │ streamed replies    │ ◀─────────────── │   └▶ relay  127.0.0.1:8765  (claude_remote)│
 │ approve / deny      │  device token    │        ├─ sessions: `claude -p` stream-json │
 │ local game demo     │                  │        ├─ PreToolUse hook ─▶ watch approval │
 └─────────────────────┘                  │        ├─ STT (whisper.cpp etc., optional)  │
   phone hotspot / Wi-Fi                  │        └─ computer-use MCP workspace (opt.) │
                                          └──────────────────────────────────────────┘
```

## Pieces

| Path | What it is |
| --- | --- |
| `claude_remote/` | Python relay (FastAPI). Device auth, sessions, approvals, Claude Code runner, STT/screen hooks. |
| `claude_remote/emulator/` | Browser version of the watch UI (240x240, 2x), same protocol. Served only when enabled. |
| `firmware/watch/lib/watchcore/` | Board-independent C++ UI, protocol and provisioning, unit-tested on the host. |
| `firmware/watch/src/main.cpp` | T-Watch S3 board layer: ST7789, FT6336 touch, AXP2101, PDM mic, DRV2605, Wi-Fi, TLS WebSocket. |
| `tests/` | Relay tests with a fake Claude backend, fake STT and fake screen. |

Related docs: [protocol](protocol.md), [hardware and battery](hardware.md), [security](security.md).

## Run it without hardware

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-remote.txt
.venv/bin/python -m pytest                                    # relay tests
.venv/bin/python -m claude_remote add-device emulator         # prints a one-time token
.venv/bin/python -m claude_remote serve --fake                # fake Claude, STT, screen
# open http://127.0.0.1:8765/emulator/ and paste the token
```

`--fake` replies with a canned answer and asks the watch to approve one `Bash` call, so the whole
loop (prompt, stream, approval, push-to-talk transcript, local game) works with nothing installed.

Firmware without hardware:

```bash
pip install platformio
cd firmware/watch
pio test -e native     # watchcore unit tests on the host
pio run -e twatch-s3   # compiles the T-Watch S3 image
```

## Run it for real

1. `python -m claude_remote init-config`, then edit `~/.config/claude-remote/config.toml`: add a
   workspace per repo, and optionally a `kind = "computer"` workspace with a computer-use MCP config.
   Set `stt = "command"` with a local whisper.cpp command for push-to-talk.
2. `python -m claude_remote add-device my-watch` and keep the printed `crd_...` token.
3. `python -m claude_remote serve` (binds 127.0.0.1), then expose it over TLS, e.g.
   `cloudflared tunnel --url http://127.0.0.1:8765` or `tailscale funnel 8765`.
4. Flash: `cd firmware/watch && pio run -e twatch-s3 -t upload`, then in `pio device monitor`:

   ```
   hotspot <phone-hotspot-ssid> <password>
   wifi <home-ssid> <password>          # optional, up to 3
   relay wss://<your-tunnel-host>/ws
   token crd_...
   ```

The watch tries the phone hotspot first on every boot, then the saved networks, and reconnects to
the relay with heartbeats. Revoke a lost watch with `python -m claude_remote revoke-device my-watch`;
a running relay drops it within 10 s.

## Using the watch

- **Home**: `+ <workspace>` rows pick where a new session starts; below them, recent sessions.
  Hold the bottom bar (or press the crown) and speak to start a session.
- **Transcript**: the relay's STT result is shown first; tap **Send** or **Discard**, so a misheard
  prompt never runs.
- **Chat**: replies stream in, newest at the bottom; drag to scroll back. **Hold to talk** replies,
  **Stop** interrupts, **Back** returns home.
- **Approval**: any tool outside the read-only allowlist pops a full-screen card with the command
  and a countdown, plus a haptic tap. **Allow** / **Deny**; no answer means deny.
- **Game**: an offline dodge game, available even when disconnected. No cloud game streaming.

The relay adds a system prompt asking Claude to answer in one or two sentences for a 240x240 screen
and to write long output to files instead.

## Not in this prototype

Screen preview on the watch (the relay and emulator support it; JPEG decode on the watch is next),
speaker playback / TTS, onboard LTE/eSIM, OTA updates, BLE provisioning from the phone, and
measured battery numbers.
