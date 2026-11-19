"""State machine tests, in all four languages."""

import pytest

from assistant import strings
from assistant.db import InvalidTransition
from assistant.pipeline import PipelineError
from conftest import AMMA, DADI, ELDER_BY_LANG, GRANDPA, STRANGER, answer, ride, spoken

LANGS = ["ta", "hi", "te", "en"]
YES = {"ta": "ஆம்", "hi": "हाँ", "te": "అవును", "en": "yes"}
YES_ROMAN = {"ta": "aama", "hi": "haan", "te": "avunu", "en": "yeah"}
NO = {"ta": "வேண்டாம்", "hi": "नहीं", "te": "వద్దు", "en": "no"}
NO_ROMAN = {"ta": "illa", "hi": "nahi", "te": "vaddu", "en": "nope"}


def last_request(e, elder):
    rows = e.db._query("SELECT id FROM requests WHERE elder_phone=? ORDER BY id DESC LIMIT 1",
                       (elder.phone,))
    return e.db.get_request(rows[0]["id"])


def start_ride(e, lang):
    elder = ELDER_BY_LANG[lang]
    e.pipe.push(ride(lang))
    assert e.voice(elder.phone) == "asked_confirmation"
    return elder, last_request(e, elder)


# ---------------------------------------------------------------- happy path
@pytest.mark.parametrize("lang", LANGS)
def test_full_flow_to_booked(env, lang):
    elder, req = start_ride(env, lang)
    assert req["state"] == "awaiting_elder_confirmation"
    assert req["language"] == lang
    said = spoken(env.wa, elder.phone)
    assert said[-1][0] == lang
    assert said[-1][1].startswith(strings.get("assistant_intro", lang))

    env.pipe.push(answer(YES[lang], lang))
    assert env.voice(elder.phone) == "sent_to_family"
    assert spoken(env.wa, elder.phone)[-1] == (lang, strings.get("sent_to_family", lang))

    family_texts = env.wa.to(elder.family_phone, "text")
    summary = family_texts[-1]
    assert f"RIDE REQUEST #{req['id']}" in summary
    assert "hospital" in summary and "tomorrow 10:00" in summary
    assert f"({lang})" in summary and "Nothing has been booked automatically" in summary
    # original audio forwarded to the family
    assert b"OGG-ORIGINAL" in env.wa.to(elder.family_phone, "audio")

    assert env.text(elder.family_phone, f"BOOKED {req['id']}") == "booked"
    assert spoken(env.wa, elder.phone)[-1] == (lang, strings.get("booked", lang))
    assert env.db.state_history(req["id"]) == [
        "received", "understood", "awaiting_elder_confirmation", "awaiting_family", "booked"]


@pytest.mark.parametrize("lang", LANGS)
def test_romanized_yes_works(env, lang):
    elder, req = start_ride(env, lang)
    env.pipe.push(answer(YES_ROMAN[lang], lang))
    assert env.voice(elder.phone) == "sent_to_family"


@pytest.mark.parametrize("lang", LANGS)
def test_typed_yes_needs_no_ai_call(env, lang):
    elder, req = start_ride(env, lang)
    calls = len(env.pipe.calls)
    assert env.text(elder.phone, YES[lang]) == "sent_to_family"
    assert len(env.pipe.calls) == calls


# ---------------------------------------------------------------- branches
@pytest.mark.parametrize("lang", LANGS)
@pytest.mark.parametrize("word", ["native", "roman"])
def test_elder_says_no_cancels(env, lang, word):
    elder, req = start_ride(env, lang)
    env.pipe.push(answer((NO if word == "native" else NO_ROMAN)[lang], lang))
    assert env.voice(elder.phone) == "cancelled"
    assert env.db.get_request(req["id"])["state"] == "cancelled"
    assert spoken(env.wa, elder.phone)[-1] == (lang, strings.get("cancelled", lang))
    assert not any("RIDE REQUEST" in t for t in env.wa.to(elder.family_phone, "text"))


@pytest.mark.parametrize("lang", LANGS)
def test_family_no_declines_kindly(env, lang):
    elder, req = start_ride(env, lang)
    env.text(elder.phone, YES[lang])
    assert env.text(elder.family_phone, f"no {req['id']}") == "declined"
    assert env.db.get_request(req["id"])["state"] == "declined"
    assert spoken(env.wa, elder.phone)[-1] == (lang, strings.get("declined", lang))


@pytest.mark.parametrize("lang", LANGS)
def test_low_confidence_asks_repeat(env, lang):
    elder = ELDER_BY_LANG[lang]
    env.pipe.push(ride(lang, confidence=0.3))
    assert env.voice(elder.phone) == "asked_repeat"
    req = last_request(env, elder)
    assert req["state"] == "needs_repeat"
    assert spoken(env.wa, elder.phone)[-1] == (lang, strings.get("ask_repeat", lang))
    # next voice note starts a fresh request
    env.pipe.push(ride(lang))
    assert env.voice(elder.phone) == "asked_confirmation"


@pytest.mark.parametrize("lang", LANGS)
def test_missing_destination_asks_where(env, lang):
    elder = ELDER_BY_LANG[lang]
    env.pipe.push(ride(lang, destination=""))
    assert env.voice(elder.phone) == "asked_destination"
    assert last_request(env, elder)["state"] == "needs_repeat"
    assert spoken(env.wa, elder.phone)[-1] == (lang, strings.get("ask_destination", lang))


@pytest.mark.parametrize("lang", LANGS)
def test_unclear_intent_asks_repeat(env, lang):
    elder = ELDER_BY_LANG[lang]
    env.pipe.push(ride(lang, intent="unclear", destination="", question=""))
    assert env.voice(elder.phone) == "asked_repeat"


@pytest.mark.parametrize("lang", LANGS)
def test_unclear_yes_no_asks_again_then_hands_to_family(env, lang):
    elder, req = start_ride(env, lang)
    for _ in range(env.cfg.max_unclear_replies):
        env.pipe.push(answer("hmm what", lang))
        assert env.voice(elder.phone) == "asked_yes_no_again"
        assert spoken(env.wa, elder.phone)[-1] == (lang, strings.get("yes_no_unclear", lang))
        assert env.db.get_request(req["id"])["state"] == "awaiting_elder_confirmation"
    env.pipe.push(answer("hmm", lang))
    assert env.voice(elder.phone) == "handed_to_family"
    assert env.db.get_request(req["id"])["state"] == "handed_to_family"
    assert spoken(env.wa, elder.phone)[-1] == (lang, strings.get("unclear_family_will_help", lang))
    assert "could not confirm" in env.wa.to(elder.family_phone, "text")[-1]


@pytest.mark.parametrize("lang", LANGS)
def test_yes_and_no_together_is_unclear(env, lang):
    elder, req = start_ride(env, lang)
    env.pipe.push(answer(f"{YES[lang]} {NO[lang]}", lang))
    assert env.voice(elder.phone) == "asked_yes_no_again"


@pytest.mark.parametrize("lang", LANGS)
@pytest.mark.parametrize("intent", ["medical", "legal", "financial", "other"])
def test_non_ride_goes_to_family(env, lang, intent):
    elder = ELDER_BY_LANG[lang]
    env.pipe.push(ride(lang, intent=intent, destination="", question=""))
    assert env.voice(elder.phone) == "handed_to_family"
    assert last_request(env, elder)["state"] == "handed_to_family"
    # The elder hears only the fixed phrase - never AI-generated advice.
    assert spoken(env.wa, elder.phone) == [(lang, strings.get("non_ride", lang))]
    alert = env.wa.to(elder.family_phone, "text")[-1]
    assert "not a ride" in alert and "gave no advice" in alert
    assert b"OGG-ORIGINAL" in env.wa.to(elder.family_phone, "audio")


def test_medical_goes_to_family_even_when_confidence_low(env):
    env.pipe.push(ride("ta", intent="medical", destination="", question="", confidence=0.2))
    assert env.voice(AMMA.phone) == "handed_to_family"
    assert "HEALTH-RELATED" in env.wa.to(AMMA.family_phone, "text")[-1]


def test_low_confidence_other_asks_repeat(env):
    env.pipe.push(ride("hi", intent="other", destination="", question="", confidence=0.2))
    assert env.voice(DADI.phone) == "asked_repeat"


# ---------------------------------------------------------------- language
def test_unknown_language_falls_back_to_preferred(env):
    env.pipe.push(ride("", question="something"))  # pipeline maps unsupported -> ""
    env.voice(DADI.phone)  # Dadi prefers Hindi
    lang, text = spoken(env.wa, DADI.phone)[-1]
    assert lang == "hi"
    assert text == strings.get("assistant_intro", "hi") + " " + strings.get(
        "confirm_ride_with_time", "hi", destination="hospital", time="tomorrow 10:00")
    assert last_request(env, DADI)["language"] == "hi"


def test_detected_language_wins_over_preferred(env):
    env.pipe.push(ride("en"))
    env.voice(AMMA.phone)  # Amma prefers Tamil but spoke English
    assert spoken(env.wa, AMMA.phone)[-1][0] == "en"
    env.pipe.push(answer("yes", "en"))
    env.voice(AMMA.phone)
    assert spoken(env.wa, AMMA.phone)[-1] == ("en", strings.get("sent_to_family", "en"))
    assert "English (en)" in env.wa.to(AMMA.family_phone, "text")[-1]


@pytest.mark.parametrize("lang,transcript", [
    ("ta", "நாளைக்கு காலை 10 மணிக்கு hospital போகணும், ஒரு taxi வேணும்"),
    ("hi", "kal subah 10 baje hospital jaana hai, ek taxi chahiye"),
    ("te", "repu 10 gantalaki hospital ki vellali, taxi kavali"),
    ("en", "I need a taxi to the hospital tomorrow at 10 please"),
])
def test_code_mixed_speech_flows_through(env, lang, transcript):
    elder = ELDER_BY_LANG[lang]
    env.pipe.push(ride(lang, transcript=transcript))
    assert env.voice(elder.phone) == "asked_confirmation"
    req = last_request(env, elder)
    assert req["transcript"] == transcript
    env.pipe.push(answer("ok", lang))  # English "ok" inside any language
    assert env.voice(elder.phone) == "sent_to_family"
    assert transcript in env.wa.to(elder.family_phone, "text")[-1]


@pytest.mark.parametrize("lang", ["ta", "hi", "te"])
def test_ai_question_in_wrong_script_is_replaced_by_template(env, lang):
    elder = ELDER_BY_LANG[lang]
    env.pipe.push(ride(lang, question="Do you want a car? Say yes or no."))
    env.voice(elder.phone)
    text = spoken(env.wa, elder.phone)[-1][1]
    assert text.endswith(strings.get("confirm_ride_with_time", lang, destination="hospital",
                                     time="tomorrow 10:00"))


def test_overlong_ai_question_is_replaced(env):
    env.pipe.push(ride("en", question="Do you want a car " * 40, time=""))
    env.voice(GRANDPA.phone)
    assert spoken(env.wa, GRANDPA.phone)[-1][1].endswith(
        strings.get("confirm_ride_no_time", "en", destination="hospital"))


def test_home_address_used_as_default_pickup(env):
    elder, req = start_ride(env, "ta")
    assert req["pickup"] == AMMA.home_address


# ---------------------------------------------------------------- safety
def test_unconfigured_number_is_ignored(env):
    assert env.voice(STRANGER) == "ignored"
    assert env.text(STRANGER, "BOOKED") == "ignored"
    assert env.wa.sent == [] and env.pipe.calls == []


def test_client_refuses_unconfigured_recipient(env):
    from assistant.messaging import RecipientNotAllowed
    with pytest.raises(RecipientNotAllowed):
        env.wa.send_text(STRANGER, "hi")
    with pytest.raises(RecipientNotAllowed):
        env.wa.send_audio(STRANGER, b"x", "audio/ogg")
    assert env.wa.sent == []


@pytest.mark.parametrize("lang", LANGS)
def test_confirmation_always_identifies_as_assistant(env, lang):
    elder = ELDER_BY_LANG[lang]
    for q in [None, ""]:  # AI question and template fallback
        env.pipe.push(ride(lang, question=q))
        env.voice(elder.phone)
        assert spoken(env.wa, elder.phone)[-1][1].startswith(strings.get("assistant_intro", lang))
        env.text(elder.phone, NO[lang])


@pytest.mark.parametrize("lang", LANGS)
@pytest.mark.parametrize("error", [
    PipelineError("Gemini error HTTP 500"),
    PipelineError("AI output was not valid JSON: 'garbage'"),
    PipelineError("Gemini rate limit / free-tier quota reached (HTTP 429)"),
])
def test_pipeline_error_tells_elder_and_alerts_family(env, lang, error):
    elder = ELDER_BY_LANG[lang]
    env.pipe.push(error)
    assert env.voice(elder.phone) == "failed"
    req = last_request(env, elder)
    assert req["state"] == "failed"
    # Before detection we only know the preferred language.
    assert spoken(env.wa, elder.phone) == [
        (elder.preferred_language, strings.get("error_family_will_help", elder.preferred_language))]
    alert = env.wa.to(elder.family_phone, "text")[-1]
    assert "PROBLEM" in alert and str(error) in alert


def test_media_download_failure(env):
    env.wa.fail_download = True
    assert env.voice(AMMA.phone) == "failed"
    assert spoken(env.wa, AMMA.phone)[-1] == ("ta", strings.get("error_family_will_help", "ta"))
    assert "download failed" in env.wa.to(AMMA.family_phone, "text")[-1]


def test_error_while_confirming(env):
    elder, req = start_ride(env, "te")
    env.pipe.push(PipelineError("timeout"))
    assert env.voice(elder.phone) == "failed"
    assert env.db.get_request(req["id"])["state"] == "failed"
    assert spoken(env.wa, elder.phone)[-1] == ("te", strings.get("error_family_will_help", "te"))


@pytest.mark.parametrize("lang", LANGS)
def test_tts_failure_sends_text_in_language_and_alerts_family(env, lang):
    elder = ELDER_BY_LANG[lang]
    env.tts.fail_langs.add(lang)
    env.pipe.push(ride(lang))
    assert env.voice(elder.phone) == "asked_confirmation"
    text = env.wa.to(elder.phone, "text")[-1]
    assert text.startswith(strings.get("assistant_intro", lang))
    assert env.wa.to(elder.phone, "audio") == []
    assert "Voice reply failed" in env.wa.to(elder.family_phone, "text")[-1]


def test_audio_send_failure_falls_back_to_text(env):
    env.wa.fail_audio = True
    env.pipe.push(ride("hi"))
    env.voice(DADI.phone)
    assert env.wa.to(DADI.phone, "text")[-1].startswith(strings.get("assistant_intro", "hi"))
    assert "Could not send a voice reply" in env.wa.to(DADI.family_phone, "text")[-1]


def test_family_unreachable_on_yes_tells_elder(env):
    elder, req = start_ride(env, "ta")
    env.wa.fail_text_to.add(elder.family_phone)
    assert env.text(elder.phone, "aama") == "failed"
    assert env.db.get_request(req["id"])["state"] == "failed"
    assert spoken(env.wa, elder.phone)[-1] == ("ta", strings.get("error_family_will_help", "ta"))


def test_unexpected_exception_still_answers_elder(env):
    env.pipe.push(RuntimeError("boom"))
    env.voice(AMMA.phone)
    assert spoken(env.wa, AMMA.phone)[-1] == ("ta", strings.get("error_family_will_help", "ta"))


def test_nothing_is_ever_booked_without_family(env):
    elder, req = start_ride(env, "en")
    env.text(elder.phone, "yes")
    assert env.db.get_request(req["id"])["state"] == "awaiting_family"
    # elder cannot mark it booked themselves
    env.pipe.push(ride("en"))
    env.text(elder.phone, "BOOKED")
    assert env.db.get_request(req["id"])["state"] == "awaiting_family"


# ---------------------------------------------------------------- family commands
def test_family_commands(env):
    # Ravi is family for both Amma (ta) and Grandpa (en)
    _, r1 = start_ride(env, "ta")
    env.text(AMMA.phone, "sari")
    _, r2 = start_ride(env, "en")
    env.text(GRANDPA.phone, "yes")
    fam = AMMA.family_phone
    assert env.text(fam, "BOOKED") == "family_ambiguous"
    assert f"#{r1['id']}" in env.wa.to(fam, "text")[-1]
    assert env.text(fam, "booked 999") == "family_unknown_request"
    assert env.text(fam, f"Booked #{r2['id']} uber white swift") == "booked"
    assert spoken(env.wa, GRANDPA.phone)[-1] == ("en", strings.get("booked", "en"))
    assert env.text(fam, "BOOKED") == "booked"  # only r1 left
    assert env.db.get_request(r1["id"])["state"] == "booked"
    assert env.text(fam, "BOOKED") == "family_nothing_waiting"
    assert env.text(fam, "hello?") == "family_help"
    assert env.voice(fam) == "family_help"


def test_family_command_parsing():
    from assistant.flow import parse_family_command as p
    assert p("BOOKED") == ("BOOKED", None)
    assert p("  booked 12") == ("BOOKED", 12)
    assert p("Booked #7 ola") == ("BOOKED", 7)
    assert p("booked 9:30 pickup") == ("BOOKED", None)
    assert p("NO 3") == ("NO", 3)
    assert p("nope") == (None, None)
    assert p("not today") == (None, None)
    assert p("") == (None, None)


def test_duplicate_webhook_delivery_is_ignored(env):
    from assistant.messaging import Incoming
    env.pipe.push(ride("ta"))
    msg = Incoming("wamid.same", AMMA.phone, "audio", media_id="MEDIA1")
    assert env.bot.handle(msg) == "asked_confirmation"
    assert env.bot.handle(msg) == "duplicate"
    assert len(env.pipe.calls) == 1


def test_non_voice_message_asks_for_voice(env):
    from assistant.messaging import Incoming
    assert env.bot.handle(Incoming("wamid.img", DADI.phone, "other")) == "asked_for_voice"
    assert spoken(env.wa, DADI.phone) == [("hi", strings.get("send_voice_please", "hi"))]


def test_typed_request_from_elder(env):
    env.pipe.push(ride("en"))
    assert env.text(GRANDPA.phone, "need taxi to hospital tomorrow 10") == "asked_confirmation"
    assert env.pipe.calls[-1]["text"] == "need taxi to hospital tomorrow 10"


def test_invalid_transitions_are_rejected(env):
    rid = env.db.create_request(AMMA.phone, AMMA.family_phone, "ta")
    with pytest.raises(InvalidTransition):
        env.db.set_state(rid, "booked")
    env.db.set_state(rid, "understood")
    env.db.set_state(rid, "awaiting_elder_confirmation")
    with pytest.raises(InvalidTransition):
        env.db.set_state(rid, "booked")  # family must be asked first
    env.db.set_state(rid, "cancelled")
    with pytest.raises(InvalidTransition):
        env.db.set_state(rid, "awaiting_family")  # terminal


def test_messages_are_logged_with_language(env):
    elder, req = start_ride(env, "te")
    rows = env.db._query("SELECT * FROM messages WHERE direction='out' AND phone=?",
                         (elder.phone,))
    assert rows[-1]["language"] == "te" and rows[-1]["request_id"] == req["id"]
