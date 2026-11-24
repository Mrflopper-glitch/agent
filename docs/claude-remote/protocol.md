# Watch ↔ relay protocol (version 1)

One WebSocket per device at `wss://<relay>/ws`. Text frames are JSON objects with a `type`; binary
frames carry push-to-talk audio. Frames are capped at 16 KB of text (64 KB at the transport).

## Handshake

The first frame must be `{"type":"auth","token":"crd_...","fw":"twatch-s3/0.1.0","protocol":1}`
within `auth_timeout_s`. Bad tokens get `error` `unauthorized` and close code 4401; repeated
failures from one address get `rate_limited`. Success returns `hello` then `sessions`, plus any
pending `approval` cards if the device has the `approve` scope.

```json
{"type":"hello","device":"watch","server":"0.1.0","protocol":1,"scopes":["view","prompt","approve","screen"],
 "workspaces":[{"id":"agent","name":"agent repo","kind":"code"}],"features":{"stt":true,"screen":false}}
```

## Device → relay

| type | scope | fields |
| --- | --- | --- |
| `ping` | any | `t` (echoed in `pong`) |
| `list` | view | |
| `open` | view | `session`; subscribes and returns `history` |
| `new` | prompt | `workspace`, `text`; creates, subscribes, returns `history` |
| `prompt` | prompt | `session`, `text` (max 4000 chars) |
| `stop` | prompt | `session` |
| `approve` | approve | `request`, `allow` |
| `audio_start` | prompt | `rate` (8000 or 16000); then binary PCM16LE mono frames |
| `audio_end` | prompt | returns `transcript`; the device confirms before sending it as a prompt |
| `screen` | screen | `w`, `h`; returns a JPEG preview of the host screen |

## Relay → device

| type | fields |
| --- | --- |
| `sessions` | `items`: `id`, `title`, `state`, `workspace`, `updated` |
| `history` | `session`, `state`, `events` (last 200, each like `event`) |
| `event` | `session`, `seq`, `kind` (`user`, `text`, `tool`, `result`, `status`, `error`), `text` (≤ 600 chars) |
| `state` | `session`, `state` (`idle`, `running`, `waiting`, `error`) |
| `approval` | `request`, `session`, `tool`, `summary`, `expires` (unix), `ttl` (seconds left) |
| `approval_done` | `request`, `allow`, `by` (device name or `timeout`) |
| `transcript` | `text` |
| `screen` | `w`, `h`, `jpeg` (base64) |
| `error` | `code`, `msg`; the connection stays open except for auth errors |

`event` frames are only sent to the connection subscribed to that session; `state`, `sessions` and
approvals go to every connected device with the matching scope.

## Claude Code hook

Sessions run `claude -p --output-format stream-json --verbose` with a `PreToolUse` hook
(`claude_remote/hook.py`) that posts the tool call to `POST /internal/hook` with a per-session
secret in `X-Claude-Remote-Hook`. Tools in `auto_allow_tools` return allow immediately; anything
else becomes an `approval` and blocks until a device answers or `approval_timeout_s` passes (deny).
