import base64
import json
from datetime import datetime

import pytest
import requests

from assistant.pipeline import GeminiPipeline, PipelineError, build_prompt, parse_understanding

GOOD = {
    "language": "ta", "transcript": "நாளைக்கு hospital போகணும்",
    "translation": "I need to go to the hospital tomorrow", "intent": "ride",
    "pickup": "", "destination": "hospital", "time": "tomorrow 10:00", "confidence": 0.88,
    "question": "நாளை மருத்துவமனைக்கு கார் வேண்டுமா?", "summary": "Car to hospital tomorrow 10am",
}


def test_parse_good():
    u = parse_understanding(json.dumps(GOOD, ensure_ascii=False))
    assert u.language == "ta" and u.intent == "ride" and u.destination == "hospital"
    assert u.confidence == pytest.approx(0.88)


def test_parse_markdown_fenced():
    u = parse_understanding("```json\n" + json.dumps(GOOD) + "\n```")
    assert u.destination == "hospital"


@pytest.mark.parametrize("raw", [
    "", "not json", "{broken", "[1, 2]", "null", '"a string"', None,
])
def test_malformed_output_raises(raw):
    with pytest.raises(PipelineError):
        parse_understanding(raw)


@pytest.mark.parametrize("missing", ["language", "transcript", "intent", "confidence"])
def test_missing_required_key_raises(missing):
    data = dict(GOOD)
    del data[missing]
    with pytest.raises(PipelineError):
        parse_understanding(json.dumps(data))


@pytest.mark.parametrize("conf", ["high", None, [], "NaN"])
def test_bad_confidence_raises(conf):
    with pytest.raises(PipelineError):
        parse_understanding(json.dumps({**GOOD, "confidence": conf}))


def test_nested_object_field_raises():
    with pytest.raises(PipelineError):
        parse_understanding(json.dumps({**GOOD, "destination": {"name": "x"}}))


def test_confidence_clamped_and_string_number_ok():
    assert parse_understanding(json.dumps({**GOOD, "confidence": 7})).confidence == 1.0
    assert parse_understanding(json.dumps({**GOOD, "confidence": -1})).confidence == 0.0
    assert parse_understanding(json.dumps({**GOOD, "confidence": "0.5"})).confidence == 0.5


@pytest.mark.parametrize("lang", ["unknown", "kn", "", "TAMIL", None])
def test_unsupported_language_becomes_empty(lang):
    assert parse_understanding(json.dumps({**GOOD, "language": lang})).language == ""


def test_language_code_case_insensitive():
    assert parse_understanding(json.dumps({**GOOD, "language": "HI"})).language == "hi"


def test_unknown_intent_becomes_other_and_blank_becomes_unclear():
    assert parse_understanding(json.dumps({**GOOD, "intent": "shopping"})).intent == "other"
    assert parse_understanding(json.dumps({**GOOD, "intent": ""})).intent == "unclear"


def test_missing_optional_fields_default_to_empty():
    u = parse_understanding(json.dumps({"language": "en", "transcript": "hi", "intent": "other",
                                        "confidence": 0.9}))
    assert u.destination == "" and u.question == "" and u.summary == ""


def test_prompt_mentions_languages_and_code_mixing():
    p = build_prompt(datetime(2026, 11, 19, 9, 0))
    for code in ("ta", "hi", "te", "en"):
        assert f"{code} (" in p
    assert "code-mixed" in p and "2026-11-19" in p and "never claim to be a person" in p


# ---------------------------------------------------------------- HTTP (mocked)
class FakeResponse:
    def __init__(self, status, payload=None, text=""):
        self.status_code = status
        self._payload = payload
        self.text = text or json.dumps(payload)

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class FakeSession:
    def __init__(self, response=None, exc=None):
        self.response, self.exc, self.calls = response, exc, []

    def post(self, url, **kw):
        self.calls.append((url, kw))
        if self.exc:
            raise self.exc
        return self.response


def gemini_ok(text):
    return FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": text}]}}]})


def test_understand_sends_audio_inline_and_key_in_header():
    s = FakeSession(gemini_ok(json.dumps(GOOD)))
    u = GeminiPipeline("KEY", "gemini-x", session=s).understand(audio=b"abc",
                                                                mime_type="audio/ogg; codecs=opus")
    assert u.destination == "hospital"
    url, kw = s.calls[0]
    assert "models/gemini-x:generateContent" in url and "KEY" not in url
    assert kw["headers"]["x-goog-api-key"] == "KEY"
    inline = kw["json"]["contents"][0]["parts"][1]["inline_data"]
    assert inline == {"mime_type": "audio/ogg", "data": base64.b64encode(b"abc").decode()}
    assert kw["json"]["generationConfig"]["responseMimeType"] == "application/json"


def test_understand_text_message():
    s = FakeSession(gemini_ok(json.dumps(GOOD)))
    GeminiPipeline("KEY", session=s).understand(text="taxi to temple")
    assert "taxi to temple" in s.calls[0][1]["json"]["contents"][0]["parts"][1]["text"]


@pytest.mark.parametrize("response,needle", [
    (FakeResponse(429, {"error": "quota"}), "429"),
    (FakeResponse(500, {"error": "boom"}), "500"),
    (FakeResponse(200, {"candidates": []}), "no text"),
    (FakeResponse(200, {"promptFeedback": {"blockReason": "SAFETY"}}), "no text"),
    (FakeResponse(200, None, text="<html>"), "no text"),
    (gemini_ok("I think they want a taxi"), "not valid JSON"),
])
def test_api_failures_raise_pipeline_error(response, needle):
    with pytest.raises(PipelineError, match=needle):
        GeminiPipeline("KEY", session=FakeSession(response)).understand(audio=b"x")


def test_network_error_raises_pipeline_error():
    s = FakeSession(exc=requests.ConnectionError("dns"))
    with pytest.raises(PipelineError, match="request failed"):
        GeminiPipeline("KEY", session=s).understand(audio=b"x")


def test_nothing_to_understand():
    with pytest.raises(PipelineError):
        GeminiPipeline("KEY", session=FakeSession()).understand()
