"""Shared fakes. Every external service (WhatsApp, Gemini, TTS) is replaced here;
no test touches the network."""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from assistant.config import Config, Elder  # noqa: E402
from assistant.db import Database  # noqa: E402
from assistant.flow import Assistant  # noqa: E402
from assistant.messaging import Incoming, MessagingError, WhatsAppClient  # noqa: E402
from assistant.pipeline import PipelineError, Understanding  # noqa: E402
from assistant.tts import TTSError  # noqa: E402

AMMA = Elder("Amma", "911111111111", "ta", "Ravi", "447700000001", "12 Gandhi St, Chennai")
DADI = Elder("Dadi", "912222222222", "hi", "Priya", "447700000002")
AMMAMMA = Elder("Ammamma", "913333333333", "te", "Kiran", "447700000003")
GRANDPA = Elder("Grandpa", "914444444444", "en", "Ravi", "447700000001")  # same family as Amma
ELDER_BY_LANG = {"ta": AMMA, "hi": DADI, "te": AMMAMMA, "en": GRANDPA}
STRANGER = "919999999999"


class FakeWhatsApp(WhatsAppClient):
    """Real allow-list check, fake network."""

    def __init__(self, allowed):
        super().__init__("token", "PHONE_ID", allowed)
        self.sent = []          # (to, kind, content)
        self.fail_audio = False
        self.fail_text_to = set()
        self.fail_download = False
        self.media = {"MEDIA1": (b"OGG-ORIGINAL", "audio/ogg")}

    def _post_message(self, body):
        to, kind = body["to"], body["type"]
        if kind == "text" and to in self.fail_text_to:
            raise MessagingError("send failed (fake)")
        if kind == "audio" and self.fail_audio:
            raise MessagingError("audio send failed (fake)")
        content = body["text"]["body"] if kind == "text" else self._uploads[body["audio"]["id"]]
        self.sent.append((to, kind, content))
        return f"wamid.{len(self.sent)}"

    def upload_media(self, data, mime_type, filename="audio"):
        self._uploads = getattr(self, "_uploads", {})
        media_id = f"up{len(self._uploads)}"
        self._uploads[media_id] = data
        return media_id

    def download_media(self, media_id):
        if self.fail_download:
            raise MessagingError("download failed (fake)")
        return self.media[media_id]

    # helpers
    def to(self, phone, kind=None):
        return [c for t, k, c in self.sent if t == phone and (kind is None or k == kind)]


class FakePipeline:
    def __init__(self):
        self.queue = []
        self.calls = []

    def push(self, item):
        self.queue.append(item)

    def understand(self, audio=None, mime_type="audio/ogg", text=None):
        self.calls.append({"audio": audio, "text": text})
        item = self.queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class FakeTTS:
    """Audio bytes encode the language and text so tests can read them back."""

    def __init__(self):
        self.fail_langs = set()

    def synthesize(self, text, lang):
        if lang in self.fail_langs:
            raise TTSError(f"no voice for {lang} (fake)")
        return f"AUDIO[{lang}]:{text}".encode(), "audio/ogg"


def spoken(wa, phone):
    """Decode FakeTTS audio sent to phone into (lang, text) pairs."""
    out = []
    for c in wa.to(phone, "audio"):
        if c.startswith(b"AUDIO["):
            head, text = c.decode().split(":", 1)
            out.append((head[6:-1], text))
    return out


def ride(lang="ta", destination="hospital", time="tomorrow 10:00", confidence=0.9,
         question=None, intent="ride", transcript="...", translation=None):
    questions = {
        "ta": "நாளை காலை 10 மணிக்கு மருத்துவமனைக்கு கார் வேண்டுமா? ஆம் அல்லது இல்லை சொல்லுங்கள்.",
        "hi": "क्या आपको कल सुबह 10 बजे अस्पताल जाने के लिए गाड़ी चाहिए? हाँ या ना बोलिए।",
        "te": "మీకు రేపు ఉదయం 10 గంటలకు ఆసుపత్రికి కారు కావాలా? అవును లేదా కాదు చెప్పండి.",
        "en": "Do you want a car to the hospital tomorrow at 10? Please say yes or no.",
    }
    return Understanding(
        language=lang, transcript=transcript,
        translation=translation or f"I need a car to the {destination} {time}",
        intent=intent, pickup="", destination=destination, time=time, confidence=confidence,
        question=questions.get(lang, "") if question is None else question,
        summary=f"Wants a car to {destination} {time}".strip())


def answer(text, lang="ta"):
    return Understanding(lang, text, text, "unclear", "", "", "", 0.9, "", "")


@pytest.fixture
def env(tmp_path):
    cfg = Config(db_path=str(tmp_path / "t.db"), audio_dir=str(tmp_path / "audio"),
                 elders=[AMMA, DADI, AMMAMMA, GRANDPA], process_in_background=False)
    wa = FakeWhatsApp(cfg.allowed_recipients())
    pipe = FakePipeline()
    tts = FakeTTS()
    db = Database(cfg.db_path)
    bot = Assistant(cfg, db, wa, pipe, tts)
    counter = {"n": 0}

    def voice(sender, media="MEDIA1"):
        counter["n"] += 1
        return bot.handle(Incoming(f"wamid.in{counter['n']}", sender, "audio", media_id=media,
                                   mime_type="audio/ogg"))

    def text(sender, body):
        counter["n"] += 1
        return bot.handle(Incoming(f"wamid.in{counter['n']}", sender, "text", text=body))

    class Env:
        pass
    e = Env()
    e.cfg, e.wa, e.pipe, e.tts, e.db, e.bot, e.voice, e.text = cfg, wa, pipe, tts, db, bot, voice, text
    yield e
    # Safety rule checked after EVERY flow test: nobody outside the config was contacted.
    allowed = cfg.allowed_recipients()
    assert {to for to, _, _ in wa.sent} <= allowed


__all__ = ["AMMA", "DADI", "AMMAMMA", "GRANDPA", "ELDER_BY_LANG", "STRANGER", "spoken", "ride",
           "answer", "PipelineError", "Incoming"]
