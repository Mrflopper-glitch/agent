"""TTS, config, eval.py and the add-a-language guarantee."""

import json

import pytest

import eval as evaluator
from assistant import config, languages, strings, tts
from assistant.pipeline import Understanding
from conftest import spoken


# ---------------------------------------------------------------- TTS
class Recorder:
    def __init__(self, name, fail=False):
        self.name, self.fail, self.calls = name, fail, []

    def synthesize(self, text, lang):
        self.calls.append((text, lang))
        if self.fail:
            raise tts.TTSError("down")
        return b"MP3", "audio/mpeg"


def test_tts_per_language_override():
    g, e = Recorder("gtts"), Recorder("edge")
    t = tts.TTS("gtts", {"ta": "edge"}, convert_to_ogg=False, providers={"gtts": g, "edge": e})
    t.synthesize("x", "ta")
    t.synthesize("y", "hi")
    assert e.calls == [("x", "ta")] and g.calls == [("y", "hi")]


def test_tts_unknown_provider_and_language():
    with pytest.raises(ValueError):
        tts.TTS("nope", convert_to_ogg=False)
    t = tts.TTS("gtts", convert_to_ogg=False, providers={"gtts": Recorder("gtts")})
    with pytest.raises(tts.TTSError):
        t.synthesize("x", "fr")


def test_tts_error_propagates():
    t = tts.TTS("gtts", convert_to_ogg=False, providers={"gtts": Recorder("gtts", fail=True)})
    with pytest.raises(tts.TTSError):
        t.synthesize("x", "en")


def test_tts_ogg_conversion_falls_back_to_mp3(monkeypatch):
    monkeypatch.setattr(tts, "mp3_to_ogg_opus", lambda data: None)
    t = tts.TTS("gtts", convert_to_ogg=True, providers={"gtts": Recorder("gtts")})
    assert t.synthesize("x", "en") == (b"MP3", "audio/mpeg")
    monkeypatch.setattr(tts, "mp3_to_ogg_opus", lambda data: b"OGG")
    assert t.synthesize("x", "en") == (b"OGG", "audio/ogg")


def test_gtts_provider_uses_language_voice(monkeypatch):
    seen = {}

    class FakeGTTS:
        def __init__(self, text, lang, tld, slow):
            seen.update(text=text, lang=lang, tld=tld)

        def write_to_fp(self, fp):
            fp.write(b"mp3bytes")

    import gtts
    monkeypatch.setattr(gtts, "gTTS", FakeGTTS)
    assert tts.GTTSProvider().synthesize("வணக்கம்", "ta") == (b"mp3bytes", "audio/mpeg")
    assert seen["lang"] == "ta"


def test_gtts_provider_wraps_errors(monkeypatch):
    class Broken:
        def __init__(self, *a, **k):
            raise RuntimeError("429 Too Many Requests")

    import gtts
    monkeypatch.setattr(gtts, "gTTS", Broken)
    with pytest.raises(tts.TTSError, match="429"):
        tts.GTTSProvider().synthesize("x", "te")


# ---------------------------------------------------------------- config
def write_contacts(tmp_path, elders):
    p = tmp_path / "contacts.json"
    p.write_text(json.dumps({"elders": elders}), encoding="utf-8")
    return str(p)


def test_load_contacts_and_allowed_numbers(tmp_path):
    path = write_contacts(tmp_path, [{"name": "Amma", "phone": "+91 98765 43210",
                                      "preferred_language": "ta",
                                      "family_phone": "+44 7700 900123"}])
    cfg = config.from_env({"CONTACTS_FILE": path, "TTS_PROVIDER_TA": "edge"})
    assert cfg.elders[0].phone == "919876543210"
    assert cfg.allowed_recipients() == {"919876543210", "447700900123"}
    assert cfg.tts_overrides == {"ta": "edge"}
    assert cfg.elder_by_phone("+91-98765-43210").name == "Amma"
    assert "GEMINI_API_KEY" in config.check_required(cfg)


@pytest.mark.parametrize("bad", [
    [{"name": "X", "phone": "1", "preferred_language": "fr", "family_phone": "2"}],
    [{"name": "X", "phone": "", "preferred_language": "ta", "family_phone": "2"}],
    [{"name": "X", "phone": "1", "preferred_language": "ta", "family_phone": "2"},
     {"name": "Y", "phone": "2", "preferred_language": "ta", "family_phone": "3"}],
])
def test_bad_contacts_rejected(tmp_path, bad):
    with pytest.raises(ValueError):
        config.load_contacts(write_contacts(tmp_path, bad))


def test_example_contacts_file_is_valid():
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent
    assert config.load_contacts(str(root / "contacts.example.json"))


# ---------------------------------------------------------------- fifth language
def test_adding_a_language_needs_no_logic_changes(env, monkeypatch):
    """Kannada added purely as data: keywords, strings and a voice."""
    kn = {"name": "Kannada", "yes": ["ಹೌದು", "houdu"], "no": ["ಬೇಡ", "beda"],
          "script": (0x0C80, 0x0CFF), "tts": {"gtts": "kn", "edge": "kn-IN-SapnaNeural"}}
    monkeypatch.setitem(languages.LANGUAGES, "kn", kn)
    monkeypatch.setattr(languages, "SUPPORTED", tuple(languages.LANGUAGES))
    for key in strings.STRINGS:
        monkeypatch.setitem(strings.STRINGS[key], "kn", strings.STRINGS[key]["en"] + " [kn]")
    from conftest import AMMA, ride
    env.pipe.push(ride("kn", question="ನಾಳೆ ಆಸ್ಪತ್ರೆಗೆ ಕಾರು ಬೇಕೇ?"))
    assert env.voice(AMMA.phone) == "asked_confirmation"
    assert spoken(env.wa, AMMA.phone)[-1][0] == "kn"
    assert env.text(AMMA.phone, "houdu") == "sent_to_family"
    assert "Kannada (kn)" in env.wa.to(AMMA.family_phone, "text")[-1]


# ---------------------------------------------------------------- eval.py
@pytest.mark.parametrize("expected,actual,ok", [
    ("hospital", "Hospital", True),
    ("hospital", "Apollo Hospital", True),
    ("Apollo Hospital", "apollo hospital, Greams Road", True),
    ("temple", "the temple", True),
    ("hospital", "railway station", False),
    ("", "", True),
    ("hospital", "", False),
])
def test_match_destination(expected, actual, ok):
    assert evaluator.match_destination(expected, actual) is ok


@pytest.mark.parametrize("expected,actual,ok", [
    ("tomorrow 10:00", "tomorrow 10:00", True),
    ("tomorrow 10:00", "Tomorrow 10 am", True),
    ("tomorrow 17:30", "tomorrow 5:30 pm", True),
    ("tomorrow 10:00", "today 10:00", False),
    ("tomorrow 10:00", "tomorrow 11:00", False),
    ("day after tomorrow 09:00", "day after tomorrow 9:00", True),
    ("day after tomorrow 09:00", "tomorrow 09:00", False),
    ("today", "today 16:00", True),
    ("now", "now", True),
    ("", "", True),
    ("", "tomorrow", False),
])
def test_match_time(expected, actual, ok):
    assert evaluator.match_time(expected, actual) is ok


def U(lang, intent, dest, time):
    return Understanding(lang, "t", "heard", intent, "", dest, time, 0.9, "", "")


def test_evaluate_and_report(tmp_path):
    cases = {
        "ta1": ({"language": "ta", "intent": "ride", "destination": "hospital",
                 "time": "tomorrow 10:00"}, U("ta", "ride", "Hospital", "tomorrow 10:00")),
        "ta2": ({"language": "ta", "intent": "ride", "destination": "temple", "time": ""},
                U("hi", "ride", "temple", "")),
        "hi1": ({"language": "hi", "intent": "medical", "destination": "", "time": ""},
                U("hi", "medical", "", "")),
        "te1": ({"language": "te", "intent": "ride", "destination": "station", "time": "now"},
                RuntimeError("quota")),
    }
    for name, (exp, _) in cases.items():
        (tmp_path / f"{name}.ogg").write_bytes(name.encode())
        (tmp_path / f"{name}.json").write_text(json.dumps(exp))
    (tmp_path / "orphan.ogg").write_bytes(b"x")  # no json -> skipped

    def understand(audio, mime):
        result = cases[audio.decode()][1]
        if isinstance(result, Exception):
            raise result
        return result

    samples = evaluator.find_samples(tmp_path)
    assert len(samples) == 4
    per_lang, failures = evaluator.evaluate(samples, understand)
    assert per_lang["ta"]["n"] == 2 and per_lang["ta"]["language"] == 1
    assert per_lang["ta"]["all"] == 1 and per_lang["hi"]["all"] == 1
    out = evaluator.report(per_lang, failures)
    assert "Tamil (ta)" in out and "50%" in out and "OVERALL" in out
    assert "ta2.ogg [ta] wrong: language" in out
    assert "te1.ogg [te] ERROR: quota" in out
    assert "Hindi (hi)" in out and "PASS" in out and "BELOW" in out
