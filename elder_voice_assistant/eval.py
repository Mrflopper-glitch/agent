"""Measure how well the assistant understands voice notes, without reading the language.

Usage:
    python eval.py path/to/folder            # needs GEMINI_API_KEY in .env
    python eval.py path/to/folder --json report.json

The folder holds voice notes (.ogg .opus .mp3 .wav .m4a .aac .amr), each with a
.json file of the same name, for example amma_hospital.ogg + amma_hospital.json:

    {"language": "ta", "intent": "ride", "destination": "hospital", "time": "tomorrow 10:00"}

Use "" for destination/time when none is said. Time format: "<day> <HH:MM>"
(24-hour), "now", or just the day. Matching rules are in match_destination()
and match_time() below.
"""

import argparse
import json
import re
import sys
import time as time_mod
from collections import defaultdict
from pathlib import Path

from assistant import languages

AUDIO_TYPES = {".ogg": "audio/ogg", ".opus": "audio/ogg", ".mp3": "audio/mpeg",
               ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac",
               ".amr": "audio/amr"}
TARGET = 0.8
DAY_WORDS = ["day after tomorrow", "tomorrow", "today", "tonight", "now", "monday", "tuesday",
             "wednesday", "thursday", "friday", "saturday", "sunday"]
FILLER = {"the", "a", "an", "to", "at", "my", "of"}


def _norm(text):
    return " ".join(re.sub(r"[^a-z0-9: ]", " ", (text or "").lower()).split())


def match_destination(expected, actual):
    """Case/punctuation-insensitive. Match if equal, if one contains the other
    ("hospital" vs "Apollo hospital"), or if they share most of their words."""
    e, a = _norm(expected), _norm(actual)
    if not e or not a:
        return e == a
    if e == a or f" {e} " in f" {a} " or f" {a} " in f" {e} ":
        return True
    ew, aw = set(e.split()) - FILLER, set(a.split()) - FILLER
    return bool(ew) and len(ew & aw) / len(ew) >= 0.5


def parse_time(text):
    """Return (day word or None, "HH:MM" or None)."""
    t = _norm(text).replace("tonight", "today")
    day = next((d for d in DAY_WORDS if d in t), None)
    if day == "tonight":
        day = "today"
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", t)
    clock = None
    if m:
        hour, minute, ampm = int(m.group(1)), int(m.group(2) or 0), m.group(3)
        if ampm == "pm" and hour < 12:
            hour += 12
        if ampm == "am" and hour == 12:
            hour = 0
        if hour < 24 and minute < 60:
            clock = f"{hour:02d}:{minute:02d}"
    return day, clock


def match_time(expected, actual):
    """Day and clock time must both match (each only if the expected one has it)."""
    if not _norm(expected):
        return not _norm(actual)
    e_day, e_clock = parse_time(expected)
    a_day, a_clock = parse_time(actual)
    if e_day is None and e_clock is None:
        return _norm(expected) == _norm(actual)
    return (e_day is None or e_day == a_day) and (e_clock is None or e_clock == a_clock)


def find_samples(folder):
    samples = []
    for audio in sorted(Path(folder).iterdir()):
        if audio.suffix.lower() in AUDIO_TYPES:
            expected_file = audio.with_suffix(".json")
            if expected_file.exists():
                samples.append((audio, expected_file))
            else:
                print(f"warning: {audio.name} has no matching .json, skipped", file=sys.stderr)
    return samples


def evaluate(samples, understand, delay=0.0):
    """Run every sample through `understand(audio, mime_type)` and score it."""
    per_lang = defaultdict(lambda: defaultdict(int))
    failures = []
    for i, (audio_path, expected_path) in enumerate(samples):
        expected = json.loads(expected_path.read_text(encoding="utf-8"))
        lang = expected.get("language", "?")
        stats = per_lang[lang]
        stats["n"] += 1
        try:
            u = understand(audio_path.read_bytes(), AUDIO_TYPES[audio_path.suffix.lower()])
        except Exception as e:
            failures.append({"file": audio_path.name, "language": lang, "error": str(e)})
            continue
        checks = {
            "language": u.language == lang,
            "intent": u.intent == expected.get("intent"),
            "destination": match_destination(expected.get("destination", ""), u.destination),
            "time": match_time(expected.get("time", ""), u.time),
        }
        for k, ok in checks.items():
            stats[k] += int(ok)
        if all(checks.values()):
            stats["all"] += 1
        else:
            failures.append({
                "file": audio_path.name, "language": lang,
                "wrong": [k for k, ok in checks.items() if not ok],
                "expected": {k: expected.get(k, "") for k in checks},
                "got": {"language": u.language, "intent": u.intent,
                        "destination": u.destination, "time": u.time},
                "heard_english": u.translation,
            })
        if delay and i < len(samples) - 1:
            time_mod.sleep(delay)  # stay under free-tier requests-per-minute
    return per_lang, failures


def pct(part, whole):
    return 100.0 * part / whole if whole else 0.0


def report(per_lang, failures):
    lines = []
    header = f"{'Language':<12}{'Notes':>6}{'Lang':>8}{'Intent':>8}{'Dest':>8}{'Time':>8}{'All ok':>8}  Target"
    lines += [header, "-" * len(header)]
    total = defaultdict(int)
    for lang in sorted(per_lang):
        s = per_lang[lang]
        for k, v in s.items():
            total[k] += v
        lines.append(_row(f"{languages.language_name(lang)} ({lang})", s))
    lines.append("-" * len(header))
    lines.append(_row("OVERALL", total))
    lines.append(f"\nTarget: at least {TARGET:.0%} of notes fully correct per language "
                 "(language, intent, destination and time all right).")
    lines.append(f"\nFailures ({len(failures)}):")
    for f in failures:
        if "error" in f:
            lines.append(f"  {f['file']} [{f['language']}] ERROR: {f['error']}")
        else:
            lines.append(f"  {f['file']} [{f['language']}] wrong: {', '.join(f['wrong'])}")
            for k in f["wrong"]:
                lines.append(f"      {k}: expected {f['expected'][k]!r}, got {f['got'][k]!r}")
            lines.append(f"      heard (English): {f['heard_english']!r}")
    return "\n".join(lines)


def _row(label, s):
    n = s["n"]
    ok = pct(s["all"], n) >= TARGET * 100
    return (f"{label:<12}{n:>6}{pct(s['language'], n):>7.0f}%{pct(s['intent'], n):>7.0f}%"
            f"{pct(s['destination'], n):>7.0f}%{pct(s['time'], n):>7.0f}%"
            f"{pct(s['all'], n):>7.0f}%  {'PASS' if ok else 'BELOW'}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("folder")
    parser.add_argument("--json", help="also write the full results to this file")
    parser.add_argument("--delay", type=float, default=4.0,
                        help="seconds between Gemini calls (free tier is rate limited)")
    args = parser.parse_args(argv)

    from dotenv import load_dotenv
    import os
    from assistant.pipeline import GeminiPipeline
    load_dotenv()
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        print("GEMINI_API_KEY is not set (see .env.example)")
        return 2
    pipeline = GeminiPipeline(key, os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
                              os.environ.get("TIMEZONE", "Asia/Kolkata"))
    samples = find_samples(args.folder)
    if not samples:
        print(f"No voice note + .json pairs found in {args.folder}")
        return 2
    per_lang, failures = evaluate(
        samples, lambda audio, mime: pipeline.understand(audio=audio, mime_type=mime),
        delay=args.delay)
    print(report(per_lang, failures))
    if args.json:
        Path(args.json).write_text(json.dumps(
            {"per_language": {k: dict(v) for k, v in per_lang.items()}, "failures": failures},
            ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
