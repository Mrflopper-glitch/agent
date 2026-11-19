"""Speech understanding with one Gemini API call.

understand() sends the voice note (or text) to Gemini and returns a validated
Understanding. Anything malformed raises PipelineError; it never guesses.
"""

import base64
import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

from . import languages

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
TIMEOUT = 60
INTENTS = ("ride", "medical", "legal", "financial", "other", "unclear")


class PipelineError(Exception):
    pass


@dataclass
class Understanding:
    language: str           # detected code, or "" if Gemini gave something unsupported
    transcript: str         # in the original language/script
    translation: str        # English
    intent: str             # one of INTENTS
    pickup: str
    destination: str
    time: str               # "tomorrow 10:00", "today 17:30", "now" or ""
    confidence: float       # 0..1
    question: str           # yes/no confirmation in the detected language
    summary: str            # one line, English

    def to_dict(self):
        return asdict(self)


def build_prompt(now):
    langs = ", ".join(f"{c} ({languages.language_name(c)})" for c in languages.SUPPORTED)
    return f"""You transcribe and interpret a WhatsApp voice message from an elderly person in India.
You are part of an automated assistant. You never claim to be a person.
The message may be in one of: {langs}. It is often code-mixed with English words
(e.g. Tanglish, Hinglish, Telugu mixed with English like "hospital", "taxi", "doctor").
For code-mixed speech, report the main non-English language. Use "en" only if the
speaker mostly speaks English.

Current local date and time: {now:%A %Y-%m-%d %H:%M}.

Return ONLY a JSON object with exactly these keys:
- "language": one of {list(languages.SUPPORTED)}, or "unknown"
- "transcript": what was said, in the original language and script
- "translation": faithful English translation
- "intent": one of {list(INTENTS)}. "ride" = they want a car/taxi/auto/cab to go somewhere.
  "medical"/"legal"/"financial" = health, legal or money matters. "other" = anything else.
  "unclear" = you cannot tell.
- "pickup": pickup place in English, "" if not said
- "destination": destination in English (e.g. "hospital", "Apollo Hospital", "temple"), "" if not said
- "time": when, as "<day> <HH:MM>" with 24-hour time, where day is "today", "tomorrow",
  "day after tomorrow" or a weekday name (e.g. "tomorrow 10:00"); "now" if immediately;
  only the day if no time was said; "" if not said
- "confidence": number 0 to 1, how sure you are of the transcript and fields
- "question": ONLY if intent is "ride": one short, polite sentence in the SAME language
  as "language", restating the ride (destination and time) and asking them to answer
  yes or no. Plain words an elderly person understands. No advice of any kind.
  Otherwise "".
- "summary": one line in English describing the request, for their family member
Never give medical, legal or financial advice. Never invent details that were not said."""


def _strip_fences(text):
    text = text.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    return m.group(1) if m else text


def _clean_str(value):
    if value is None:
        return ""
    if not isinstance(value, (str, int, float)):
        raise PipelineError(f"Expected text, got {type(value).__name__}")
    return str(value).strip()


def parse_understanding(raw):
    """Validate Gemini's text output and turn it into an Understanding."""
    try:
        data = json.loads(_strip_fences(raw or ""))
    except (json.JSONDecodeError, TypeError) as e:
        raise PipelineError(f"AI output was not valid JSON: {str(raw)[:200]!r}") from e
    if not isinstance(data, dict):
        raise PipelineError("AI output was not a JSON object")
    for key in ("language", "transcript", "intent", "confidence"):
        if key not in data:
            raise PipelineError(f"AI output missing {key!r}")
    try:
        confidence = float(data["confidence"])
    except (TypeError, ValueError) as e:
        raise PipelineError(f"AI confidence is not a number: {data['confidence']!r}") from e
    if confidence != confidence:  # NaN
        raise PipelineError("AI confidence is NaN")
    confidence = max(0.0, min(1.0, confidence))
    lang = _clean_str(data.get("language")).lower()
    intent = _clean_str(data.get("intent")).lower()
    if intent not in INTENTS:
        intent = "other" if intent else "unclear"
    return Understanding(
        language=lang if languages.is_supported(lang) else "",
        transcript=_clean_str(data.get("transcript")),
        translation=_clean_str(data.get("translation")),
        intent=intent,
        pickup=_clean_str(data.get("pickup")),
        destination=_clean_str(data.get("destination")),
        time=_clean_str(data.get("time")),
        confidence=confidence,
        question=_clean_str(data.get("question")),
        summary=_clean_str(data.get("summary")),
    )


class GeminiPipeline:
    def __init__(self, api_key, model="gemini-2.5-flash", tz="Asia/Kolkata", session=None):
        self.api_key = api_key
        self.model = model
        self.tz = ZoneInfo(tz)
        self.http = session or requests.Session()

    def understand(self, audio=None, mime_type="audio/ogg", text=None):
        if not audio and not text:
            raise PipelineError("Nothing to understand: no audio and no text")
        parts = [{"text": build_prompt(datetime.now(self.tz))}]
        if audio:
            parts.append({"inline_data": {"mime_type": mime_type.split(";")[0],
                                          "data": base64.b64encode(audio).decode()}})
        else:
            parts.append({"text": f"The message was typed, not spoken. Message: {text}"})
        body = {"contents": [{"role": "user", "parts": parts}],
                "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
        try:
            r = self.http.post(API.format(model=self.model), json=body, timeout=TIMEOUT,
                               headers={"x-goog-api-key": self.api_key})
        except requests.RequestException as e:
            raise PipelineError(f"Gemini request failed: {e}") from e
        if r.status_code == 429:
            raise PipelineError("Gemini rate limit / free-tier quota reached (HTTP 429)")
        if r.status_code >= 300:
            raise PipelineError(f"Gemini error HTTP {r.status_code}: {r.text[:300]}")
        try:
            candidate = r.json()["candidates"][0]
            raw = "".join(p.get("text", "") for p in candidate["content"]["parts"])
        except (ValueError, KeyError, IndexError, TypeError) as e:
            raise PipelineError(f"Gemini response had no text: {r.text[:300]}") from e
        return parse_understanding(raw)
