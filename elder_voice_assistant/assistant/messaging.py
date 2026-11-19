"""Meta WhatsApp Cloud API: verify webhooks, parse them, send and fetch media.

Safety: WhatsAppClient refuses to send to any number that is not a configured
elder or family member. This is the single choke point for outgoing messages.
"""

import hashlib
import hmac
from dataclasses import dataclass

import requests

from .config import normalize_phone

GRAPH = "https://graph.facebook.com"
TIMEOUT = 30


class MessagingError(Exception):
    pass


class RecipientNotAllowed(MessagingError):
    pass


def verify_signature(app_secret, raw_body, header_value):
    """Check Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body)."""
    if not app_secret or not header_value or not header_value.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header_value[len("sha256="):])


@dataclass
class Incoming:
    wa_message_id: str
    from_phone: str
    kind: str            # "audio", "text" or "other"
    text: str = ""
    media_id: str = ""
    mime_type: str = ""


def parse_webhook(payload):
    """Extract incoming messages from a webhook body. Status updates are ignored."""
    found = []
    for entry in (payload or {}).get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) or {}
            for m in value.get("messages", []) or []:
                mtype = m.get("type")
                msg = Incoming(wa_message_id=m.get("id", ""),
                               from_phone=normalize_phone(m.get("from")), kind="other")
                if mtype == "audio":
                    audio = m.get("audio", {}) or {}
                    msg.kind = "audio"
                    msg.media_id = audio.get("id", "")
                    msg.mime_type = audio.get("mime_type", "audio/ogg")
                elif mtype == "text":
                    msg.kind = "text"
                    msg.text = (m.get("text", {}) or {}).get("body", "")
                elif mtype == "button":  # quick-reply buttons on templates
                    msg.kind = "text"
                    msg.text = (m.get("button", {}) or {}).get("text", "")
                found.append(msg)
    return found


class WhatsAppClient:
    def __init__(self, token, phone_number_id, allowed_numbers, api_version="v23.0",
                 session=None):
        self.token = token
        self.phone_number_id = phone_number_id
        self.allowed = {normalize_phone(n) for n in allowed_numbers}
        self.base = f"{GRAPH}/{api_version}"
        self.http = session or requests.Session()

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def _check_allowed(self, to):
        to = normalize_phone(to)
        if to not in self.allowed:
            raise RecipientNotAllowed(f"Refusing to message unconfigured number {to}")
        return to

    def _post_message(self, body):
        try:
            r = self.http.post(f"{self.base}/{self.phone_number_id}/messages",
                               headers=self._headers(), json=body, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise MessagingError(f"WhatsApp send failed: {e}") from e
        if r.status_code >= 300:
            raise MessagingError(f"WhatsApp send failed ({r.status_code}): {r.text[:300]}")
        try:
            return r.json().get("messages", [{}])[0].get("id", "")
        except ValueError:
            return ""

    def send_text(self, to, text):
        to = self._check_allowed(to)
        return self._post_message({"messaging_product": "whatsapp", "to": to, "type": "text",
                                   "text": {"body": text[:4096]}})

    def upload_media(self, data, mime_type, filename="audio"):
        try:
            r = self.http.post(f"{self.base}/{self.phone_number_id}/media",
                               headers=self._headers(),
                               data={"messaging_product": "whatsapp", "type": mime_type},
                               files={"file": (filename, data, mime_type)}, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise MessagingError(f"Media upload failed: {e}") from e
        if r.status_code >= 300:
            raise MessagingError(f"Media upload failed ({r.status_code}): {r.text[:300]}")
        media_id = r.json().get("id")
        if not media_id:
            raise MessagingError("Media upload returned no id")
        return media_id

    def send_audio(self, to, data, mime_type):
        """Upload audio bytes and send them as an audio message."""
        to = self._check_allowed(to)  # check before uploading anything
        ext = {"audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a"}.get(
            mime_type.split(";")[0], "bin")
        media_id = self.upload_media(data, mime_type.split(";")[0], f"audio.{ext}")
        return self._post_message({"messaging_product": "whatsapp", "to": to, "type": "audio",
                                   "audio": {"id": media_id}})

    def download_media(self, media_id):
        """Return (bytes, mime_type) for an incoming media id."""
        try:
            meta = self.http.get(f"{self.base}/{media_id}", headers=self._headers(),
                                 timeout=TIMEOUT)
            if meta.status_code >= 300:
                raise MessagingError(f"Media lookup failed ({meta.status_code}): {meta.text[:300]}")
            info = meta.json()
            r = self.http.get(info["url"], headers=self._headers(), timeout=TIMEOUT)
        except requests.RequestException as e:
            raise MessagingError(f"Media download failed: {e}") from e
        except (ValueError, KeyError) as e:
            raise MessagingError(f"Media lookup returned bad data: {e}") from e
        if r.status_code >= 300:
            raise MessagingError(f"Media download failed ({r.status_code})")
        return r.content, info.get("mime_type", "audio/ogg")
