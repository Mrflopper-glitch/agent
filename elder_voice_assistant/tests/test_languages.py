import re
from pathlib import Path

import pytest

from assistant import languages, strings
from assistant.languages import detect_yes_no, is_in_script


@pytest.mark.parametrize("text", [
    # Tamil
    "ஆம்", "ஆமா", "சரி", "சரிங்க", "aama", "Aamaa", "sari", "seri", "ஆம்.",
    # Hindi
    "हाँ", "हां", "हाँ जी", "ठीक है", "haan", "Haan ji", "theek hai", "bilkul", "हाँ।",
    # Telugu
    "అవును", "సరే", "అలాగే", "avunu", "sare", "Avunandi",
    # English (also used inside every language)
    "yes", "Yes!", "yeah", "OK", "okay sure",
])
def test_yes(text):
    assert detect_yes_no(text) == "yes"


@pytest.mark.parametrize("text", [
    "இல்லை", "வேண்டாம்", "illa", "vendam", "venaam",
    "नहीं", "ना", "nahi", "nahin", "nahi ji", "rehne do",
    "కాదు", "వద్దు", "లేదు", "vaddu", "kaadu", "ledu",
    "no", "No.", "nope", "cancel it", "don't",
])
def test_no(text):
    assert detect_yes_no(text) == "no"


@pytest.mark.parametrize("text", [
    "", "   ", "hmm", "what did you say", "யார் நீங்க", "क्या", "ఏంటి",
    "yes no", "aama illa", "haan nahi", "avunu kaadu",
])
def test_unclear(text):
    assert detect_yes_no(text) == "unclear"


@pytest.mark.parametrize("text,expected", [
    ("aama, hospital ku thaan", "yes"),          # Tanglish
    ("haan bhai, taxi bhej do", "yes"),          # Hinglish
    ("avunu, hospital ki taxi", "yes"),          # Telugu-English
    ("சரி ok", "yes"),
    ("vaddu, cancel cheyyi", "no"),
    ("nahi, abhi nahi chahiye", "no"),
    ("illa vendam", "no"),
])
def test_code_mixed_answers(text, expected):
    assert detect_yes_no(text) == expected


def test_keywords_are_whole_words():
    assert detect_yes_no("hospital") == "unclear"     # contains "ha"? no - whole words only
    assert detect_yes_no("nothing") == "unclear"      # not "no"
    assert detect_yes_no("yesterday") == "unclear"


def test_normalize_keeps_indic_combining_marks():
    assert languages.normalize("ஆம்!") == "ஆம்"
    assert languages.normalize("हाँ।") == "हाँ"
    assert languages.normalize("అవును?") == "అవును"


def test_script_check():
    assert is_in_script("நாளை கார் வேண்டுமா?", "ta")
    assert is_in_script("நாளை 10 மணிக்கு hospital போக கார் வேண்டுமா?", "ta")
    assert not is_in_script("Do you want a car?", "ta")
    assert is_in_script("क्या आपको गाड़ी चाहिए?", "hi")
    assert not is_in_script("మీకు కారు కావాలా?", "hi")
    assert is_in_script("మీకు కారు కావాలా?", "te")
    assert is_in_script("Do you want a car?", "en")
    assert not is_in_script("", "en")


def test_every_language_has_keywords_and_voice():
    for code, cfg in languages.LANGUAGES.items():
        assert cfg["yes"] and cfg["no"] and cfg["name"]
        assert cfg["tts"]["gtts"] and cfg["tts"]["edge"]
        assert len(cfg["script"]) == 2


# ---------------------------------------------------------------- strings
def test_every_string_in_every_language():
    for key, phrases in strings.STRINGS.items():
        assert set(phrases) == set(languages.SUPPORTED), key
        for lang, text in phrases.items():
            assert text.strip(), (key, lang)


def test_placeholders_match_across_languages():
    for key, phrases in strings.STRINGS.items():
        found = {lang: set(re.findall(r"{(\w+)}", t)) for lang, t in phrases.items()}
        assert len({frozenset(v) for v in found.values()}) == 1, (key, found)


def test_non_english_lines_marked_for_review():
    source = Path(strings.__file__).read_text(encoding="utf-8")
    lines = [l for l in source.splitlines() if re.match(r'\s+"(ta|hi|te)":', l)]
    assert len(lines) == 3 * len(strings.STRINGS)
    for line in lines:
        assert line.rstrip().endswith("# needs native-speaker review"), line


def test_non_english_strings_use_native_script():
    for key, phrases in strings.STRINGS.items():
        for lang in ("ta", "hi", "te"):
            text = re.sub(r"{\w+}", "", phrases[lang])
            assert is_in_script(text, lang), (key, lang)


def test_fixed_phrases_never_claim_to_be_human():
    for phrases in strings.STRINGS.values():
        assert "I am a person" not in phrases["en"] and "human" not in phrases["en"].lower()
