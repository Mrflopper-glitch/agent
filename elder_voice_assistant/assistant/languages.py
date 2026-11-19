"""Per-language configuration: names, yes/no keywords and TTS voices.

To add a language: add an entry to LANGUAGES below, add its phrases to
strings.py, and you are done. No logic changes are needed anywhere else.

Yes/no detection is deliberately a plain keyword check (no AI). Every
language's lists are checked for every message, because elders often answer
with English "yes"/"ok" even when they speak Tamil, Hindi or Telugu.
"""

import unicodedata

LANGUAGES = {
    "en": {
        "name": "English",
        "yes": ["yes", "yeah", "yep", "yup", "ya", "ok", "okay", "sure", "correct",
                "right", "fine", "confirm", "go ahead", "please do"],
        "no": ["no", "nope", "nah", "cancel", "don't", "dont", "do not", "not",
               "wrong", "stop", "never mind"],
        # Unicode range of the native script, used to check that an AI-written
        # sentence really is in this language before it is spoken.
        "script": (0x0041, 0x007A),
        # gTTS language code / edge-tts voice name
        "tts": {"gtts": "en", "gtts_tld": "co.in", "edge": "en-IN-NeerjaNeural"},
    },
    "ta": {
        "name": "Tamil",
        "yes": ["ஆம்", "ஆமாம்", "ஆமா", "ஆமாங்க", "சரி", "சரிங்க", "ஓகே", "வேணும்",
                "aam", "aama", "aamaa", "aamam", "aamaam", "amam", "aamanga",
                "sari", "seri", "saringa", "seringa", "venum", "vaenum"],
        "no": ["இல்லை", "இல்ல", "இல்லைங்க", "வேண்டாம்", "வேணாம்", "வேண்டா",
               "illai", "illa", "illainga", "illanga", "vendam", "vendaam",
               "venam", "venaam", "venda"],
        "script": (0x0B80, 0x0BFF),
        "tts": {"gtts": "ta", "edge": "ta-IN-PallaviNeural"},
    },
    "hi": {
        "name": "Hindi",
        "yes": ["हाँ", "हां", "हा", "जी हाँ", "जी हां", "ठीक", "ठीक है", "सही",
                "बिल्कुल", "हाँ जी", "haan", "han", "haa", "ha", "haanji", "haan ji",
                "ji haan", "jee haan", "theek", "thik", "theek hai", "thik hai", "sahi",
                "bilkul", "achha", "accha"],
        "no": ["नहीं", "नही", "ना", "मत", "रहने दो", "nahi", "nahin", "nahee", "na",
               "naa", "mat", "rehne do", "rahne do"],
        "script": (0x0900, 0x097F),
        "tts": {"gtts": "hi", "edge": "hi-IN-SwaraNeural"},
    },
    "te": {
        "name": "Telugu",
        "yes": ["అవును", "అవునండి", "సరే", "సరేనండి", "అలాగే", "ఓకే", "కావాలి",
                "avunu", "avnu", "avunandi", "sare", "saree", "sarenandi", "alage",
                "alaage", "kavali", "kaavali"],
        "no": ["కాదు", "వద్దు", "లేదు", "వద్దండి", "కాదండి", "kaadu", "kadu",
               "vaddu", "vaddandi", "ledu", "ledhu", "kaadandi"],
        "script": (0x0C00, 0x0C7F),
        "tts": {"gtts": "te", "edge": "te-IN-ShrutiNeural"},
    },
}

SUPPORTED = tuple(LANGUAGES.keys())


def is_supported(code):
    return isinstance(code, str) and code in LANGUAGES


def language_name(code):
    return LANGUAGES.get(code, {}).get("name", code or "unknown")


def is_in_script(text, lang):
    """True if most letters in text belong to lang's script."""
    low, high = LANGUAGES[lang]["script"]
    letters = [ch for ch in text if unicodedata.category(ch)[0] in "LM"]
    if not letters:
        return False
    in_script = sum(1 for ch in letters if low <= ord(ch.lower()) <= high)
    return in_script / len(letters) >= 0.6


def normalize(text):
    """Lowercase, NFC-normalise and replace punctuation/symbols with spaces.

    We cannot use regex \\w for tokenising: Indic vowel signs and the virama
    are combining marks, which \\w treats as word breaks ("ஆம்" would split).
    """
    text = unicodedata.normalize("NFC", text or "").lower()
    # Treat apostrophes as part of words ("don't")
    text = text.replace("’", "'")
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        if ch == "'" or not (cat.startswith("P") or cat.startswith("S")):
            out.append(ch)
        else:
            out.append(" ")
    return " ".join("".join(out).split())


def _contains(padded_text, keyword):
    return f" {normalize(keyword)} " in padded_text


def detect_yes_no(text):
    """Return "yes", "no" or "unclear". Deterministic keyword check.

    If both a yes-word and a no-word appear ("yes... no wait"), the answer is
    "unclear" so the elder is asked again rather than guessed for.
    """
    padded = f" {normalize(text)} "
    if not padded.strip():
        return "unclear"
    said_yes = any(_contains(padded, k) for lang in LANGUAGES.values() for k in lang["yes"])
    said_no = any(_contains(padded, k) for lang in LANGUAGES.values() for k in lang["no"])
    if said_yes and not said_no:
        return "yes"
    if said_no and not said_yes:
        return "no"
    return "unclear"
