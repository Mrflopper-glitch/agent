import hashlib
import hmac
import json

import pytest
import requests

from app import create_app
from assistant.messaging import (MessagingError, RecipientNotAllowed, WhatsAppClient,
                                 parse_webhook, verify_signature)
from conftest import AMMA, STRANGER, ride, spoken

SECRET = "app-secret"


def sign(body, secret=SECRET):
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def audio_payload(sender, msg_id="wamid.A", media="MEDIA1"):
    return {"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {
        "messaging_product": "whatsapp",
        "messages": [{"from": sender, "id": msg_id, "type": "audio",
                      "audio": {"id": media, "mime_type": "audio/ogg; codecs=opus",
                                "voice": True}}]}}]}]}


# ---------------------------------------------------------------- signature
def test_signature_valid():
    body = b'{"a":1}'
    assert verify_signature(SECRET, body, sign(body))


@pytest.mark.parametrize("header", ["", None, "sha256=deadbeef", "md5=abc", sign(b"other")])
def test_signature_invalid(header):
    assert not verify_signature(SECRET, b'{"a":1}', header)


def test_signature_needs_secret():
    body = b"x"
    assert not verify_signature("", body, sign(body, ""))


# ---------------------------------------------------------------- parsing
def test_parse_audio_text_and_other():
    payload = audio_payload("+91 11111 11111")
    payload["entry"][0]["changes"][0]["value"]["messages"] += [
        {"from": "447700000001", "id": "w2", "type": "text", "text": {"body": "BOOKED"}},
        {"from": "447700000001", "id": "w3", "type": "image", "image": {"id": "i"}},
    ]
    a, t, o = parse_webhook(payload)
    assert (a.kind, a.from_phone, a.media_id) == ("audio", "911111111111", "MEDIA1")
    assert (t.kind, t.text) == ("text", "BOOKED")
    assert o.kind == "other"


def test_parse_status_only_and_garbage():
    status = {"entry": [{"changes": [{"value": {"statuses": [{"status": "read"}]}}]}]}
    assert parse_webhook(status) == []
    assert parse_webhook({}) == []
    assert parse_webhook(None) == []


# ---------------------------------------------------------------- client (mocked HTTP)
class Resp:
    def __init__(self, status=200, payload=None, content=b""):
        self.status_code, self._p, self.content = status, payload or {}, content
        self.text = json.dumps(self._p)

    def json(self):
        return self._p


class Session:
    def __init__(self, *responses, exc=None):
        self.responses, self.exc, self.calls = list(responses), exc, []

    def _next(self, method, url, kw):
        self.calls.append((method, url, kw))
        if self.exc:
            raise self.exc
        return self.responses.pop(0)

    def post(self, url, **kw):
        return self._next("POST", url, kw)

    def get(self, url, **kw):
        return self._next("GET", url, kw)


def test_send_text_body():
    s = Session(Resp(200, {"messages": [{"id": "wamid.1"}]}))
    c = WhatsAppClient("TOK", "PID", ["447700000001"], "v23.0", session=s)
    assert c.send_text("+44 7700 000001", "hello") == "wamid.1"
    method, url, kw = s.calls[0]
    assert url == "https://graph.facebook.com/v23.0/PID/messages"
    assert kw["json"] == {"messaging_product": "whatsapp", "to": "447700000001",
                          "type": "text", "text": {"body": "hello"}}
    assert kw["headers"]["Authorization"] == "Bearer TOK"


def test_send_audio_uploads_then_sends():
    s = Session(Resp(200, {"id": "MID"}), Resp(200, {"messages": [{"id": "wamid.2"}]}))
    c = WhatsAppClient("TOK", "PID", ["447700000001"], session=s)
    c.send_audio("447700000001", b"OGG", "audio/ogg")
    assert s.calls[0][1].endswith("/PID/media")
    assert s.calls[1][2]["json"]["audio"] == {"id": "MID"}


def test_unallowed_recipient_makes_no_http_call():
    s = Session()
    c = WhatsAppClient("TOK", "PID", ["447700000001"], session=s)
    with pytest.raises(RecipientNotAllowed):
        c.send_text(STRANGER, "x")
    with pytest.raises(RecipientNotAllowed):
        c.send_audio(STRANGER, b"x", "audio/ogg")
    assert s.calls == []


@pytest.mark.parametrize("session", [
    Session(Resp(400, {"error": {"message": "bad"}})),
    Session(exc=requests.ConnectionError("down")),
])
def test_send_failures_raise_messaging_error(session):
    c = WhatsAppClient("TOK", "PID", ["447700000001"], session=session)
    with pytest.raises(MessagingError):
        c.send_text("447700000001", "x")


def test_download_media_two_steps():
    s = Session(Resp(200, {"url": "https://lookaside.example/abc", "mime_type": "audio/ogg"}),
                Resp(200, content=b"BYTES"))
    data, mime = WhatsAppClient("TOK", "PID", [], session=s).download_media("M1")
    assert (data, mime) == (b"BYTES", "audio/ogg")
    assert s.calls[1][1] == "https://lookaside.example/abc"


@pytest.mark.parametrize("session", [
    Session(Resp(404, {"error": "x"})),
    Session(Resp(200, {"no_url": True})),
    Session(Resp(200, {"url": "u"}), Resp(500)),
    Session(exc=requests.Timeout("slow")),
])
def test_download_failures(session):
    with pytest.raises(MessagingError):
        WhatsAppClient("TOK", "PID", [], session=session).download_media("M1")


# ---------------------------------------------------------------- Flask app
@pytest.fixture
def client(env):
    env.cfg.whatsapp_app_secret = SECRET
    env.cfg.whatsapp_verify_token = "verify-me"
    app = create_app(env.cfg, env.bot)
    app.testing = True
    return app.test_client(), env


def test_webhook_verification(client):
    c, _ = client
    ok = c.get("/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42")
    assert ok.status_code == 200 and ok.data == b"42"
    bad = c.get("/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42")
    assert bad.status_code == 403


def test_webhook_rejects_bad_signature(client):
    c, env = client
    body = json.dumps(audio_payload(AMMA.phone)).encode()
    r = c.post("/webhook", data=body, headers={"X-Hub-Signature-256": sign(body, "wrong"),
                                               "Content-Type": "application/json"})
    assert r.status_code == 403
    r = c.post("/webhook", data=body, headers={"Content-Type": "application/json"})
    assert r.status_code == 403
    assert env.wa.sent == [] and env.pipe.calls == []


def test_webhook_processes_signed_voice_note(client):
    c, env = client
    env.pipe.push(ride("ta"))
    body = json.dumps(audio_payload(AMMA.phone)).encode()
    r = c.post("/webhook", data=body, headers={"X-Hub-Signature-256": sign(body),
                                               "Content-Type": "application/json"})
    assert r.status_code == 200
    assert spoken(env.wa, AMMA.phone)[-1][0] == "ta"


def test_webhook_ignores_stranger(client):
    c, env = client
    body = json.dumps(audio_payload(STRANGER)).encode()
    r = c.post("/webhook", data=body, headers={"X-Hub-Signature-256": sign(body),
                                               "Content-Type": "application/json"})
    assert r.status_code == 200 and env.wa.sent == []


def test_health(client):
    c, _ = client
    assert c.get("/health").json == {"ok": True}
