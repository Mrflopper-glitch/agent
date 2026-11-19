"""SQLite storage: message log, ride requests and their state history."""

import sqlite3
import threading
from datetime import datetime, timezone

# State machine. Keys are states, values are the states they may move to.
TRANSITIONS = {
    "received": {"understood", "failed"},
    "understood": {"awaiting_elder_confirmation", "needs_repeat", "handed_to_family", "failed"},
    "awaiting_elder_confirmation": {"awaiting_family", "cancelled", "handed_to_family", "failed"},
    "awaiting_family": {"booked", "declined", "failed"},
    # Terminal states
    "booked": set(), "cancelled": set(), "declined": set(),
    "needs_repeat": set(), "handed_to_family": set(), "failed": set(),
}
OPEN_STATES = {"received", "understood", "awaiting_elder_confirmation", "awaiting_family"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_message_id TEXT UNIQUE,
    direction TEXT NOT NULL,          -- in / out
    phone TEXT NOT NULL,
    kind TEXT NOT NULL,               -- text / audio / other
    body TEXT,
    language TEXT,
    request_id INTEGER,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    elder_phone TEXT NOT NULL,
    family_phone TEXT NOT NULL,
    state TEXT NOT NULL,
    language TEXT,
    transcript TEXT, translation TEXT, intent TEXT,
    pickup TEXT, destination TEXT, time TEXT,
    confidence REAL, summary TEXT, question TEXT,
    audio_path TEXT, audio_mime TEXT,
    unclear_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS request_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    from_state TEXT, to_state TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
);
"""

REQUEST_FIELDS = {"language", "transcript", "translation", "intent", "pickup", "destination",
                  "time", "confidence", "summary", "question", "audio_path", "audio_mime",
                  "unclear_count", "error"}


class InvalidTransition(Exception):
    pass


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    def __init__(self, path):
        self.path = path
        self._lock = threading.Lock()
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def _exec(self, sql, params=()):
        with self._lock:
            cur = self.conn.execute(sql, params)
            self.conn.commit()
            return cur

    def _query(self, sql, params=()):
        with self._lock:
            return self.conn.execute(sql, params).fetchall()

    # --- messages ----------------------------------------------------------
    def log_inbound(self, wa_message_id, phone, kind, body=None):
        """Record an incoming message. Returns False if it was already seen
        (Meta re-delivers webhooks), so it must not be processed twice."""
        try:
            self._exec(
                "INSERT INTO messages (wa_message_id, direction, phone, kind, body, created_at)"
                " VALUES (?, 'in', ?, ?, ?, ?)", (wa_message_id, phone, kind, body, _now()))
            return True
        except sqlite3.IntegrityError:
            return False

    def log_outbound(self, phone, kind, body, language=None, request_id=None, wa_message_id=None):
        self._exec(
            "INSERT INTO messages (wa_message_id, direction, phone, kind, body, language,"
            " request_id, created_at) VALUES (?, 'out', ?, ?, ?, ?, ?, ?)",
            (wa_message_id, phone, kind, body, language, request_id, _now()))

    def messages(self, phone=None):
        if phone:
            return self._query("SELECT * FROM messages WHERE phone=? ORDER BY id", (phone,))
        return self._query("SELECT * FROM messages ORDER BY id")

    # --- requests ----------------------------------------------------------
    def create_request(self, elder_phone, family_phone, language):
        now = _now()
        cur = self._exec(
            "INSERT INTO requests (elder_phone, family_phone, state, language, created_at,"
            " updated_at) VALUES (?, ?, 'received', ?, ?, ?)",
            (elder_phone, family_phone, language, now, now))
        rid = cur.lastrowid
        self._exec("INSERT INTO request_events (request_id, from_state, to_state, created_at)"
                   " VALUES (?, NULL, 'received', ?)", (rid, now))
        return rid

    def get_request(self, request_id):
        rows = self._query("SELECT * FROM requests WHERE id=?", (request_id,))
        return dict(rows[0]) if rows else None

    def update_request(self, request_id, **fields):
        bad = set(fields) - REQUEST_FIELDS
        if bad:
            raise ValueError(f"Unknown request fields: {bad}")
        if not fields:
            return
        cols = ", ".join(f"{k}=?" for k in fields)
        self._exec(f"UPDATE requests SET {cols}, updated_at=? WHERE id=?",
                   (*fields.values(), _now(), request_id))

    def set_state(self, request_id, new_state, note=None):
        req = self.get_request(request_id)
        if req is None:
            raise InvalidTransition(f"Request {request_id} does not exist")
        old = req["state"]
        if new_state not in TRANSITIONS.get(old, set()):
            raise InvalidTransition(f"Request {request_id}: {old} -> {new_state} not allowed")
        now = _now()
        self._exec("UPDATE requests SET state=?, updated_at=? WHERE id=?",
                   (new_state, now, request_id))
        self._exec("INSERT INTO request_events (request_id, from_state, to_state, note,"
                   " created_at) VALUES (?, ?, ?, ?, ?)", (request_id, old, new_state, note, now))

    def state_history(self, request_id):
        rows = self._query("SELECT to_state FROM request_events WHERE request_id=? ORDER BY id",
                           (request_id,))
        return [r["to_state"] for r in rows]

    def latest_request_for_elder(self, elder_phone, state):
        rows = self._query("SELECT * FROM requests WHERE elder_phone=? AND state=?"
                           " ORDER BY id DESC LIMIT 1", (elder_phone, state))
        return dict(rows[0]) if rows else None

    def requests_awaiting_family(self, family_phone):
        rows = self._query("SELECT * FROM requests WHERE family_phone=? AND"
                           " state='awaiting_family' ORDER BY id DESC", (family_phone,))
        return [dict(r) for r in rows]
