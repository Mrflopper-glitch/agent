"""The conversation state machine.

    received -> understood -> awaiting_elder_confirmation -> awaiting_family -> booked
    branches: cancelled (elder said no), declined (family said NO),
              needs_repeat (unclear / low confidence / no destination),
              handed_to_family (non-ride request, or yes/no unclear too often),
              failed (any error; elder told the family will help, family alerted)

Nothing is ever booked by this code. The family member books the cab
themselves and replies BOOKED.
"""

import logging
import os
import re
import threading

from . import languages, strings
from .db import InvalidTransition
from .messaging import Incoming

log = logging.getLogger(__name__)

ALWAYS_TO_FAMILY = {"medical", "legal", "financial"}  # never answered by the bot
MAX_QUESTION_CHARS = 300

FAMILY_HELP = ("This is the ride assistant. Reply BOOKED once you have booked the cab, or NO "
               "if you cannot. If several requests are waiting, add the number, e.g. BOOKED 12.")

_FAMILY_CMD = re.compile(r"^\s*(booked|no)\b[\s#:.\-]*(?:(\d+)(?![\d:.]))?", re.I)


def parse_family_command(text):
    """Return (command, request_id or None), or (None, None) if not a command."""
    m = _FAMILY_CMD.match(text or "")
    if not m:
        return None, None
    return m.group(1).upper(), (int(m.group(2)) if m.group(2) else None)


class Assistant:
    def __init__(self, cfg, db, wa, pipeline, tts):
        self.cfg = cfg
        self.db = db
        self.wa = wa
        self.pipeline = pipeline
        self.tts = tts
        self._lock = threading.Lock()  # one message at a time keeps state simple

    # ------------------------------------------------------------------ entry
    def handle(self, msg: Incoming):
        """Process one incoming message. Returns a short outcome string (for logs/tests)."""
        with self._lock:
            if not self.db.log_inbound(msg.wa_message_id, msg.from_phone, msg.kind,
                                       msg.text or msg.media_id):
                return "duplicate"
            elder = self.cfg.elder_by_phone(msg.from_phone)
            family_of = self.cfg.elders_for_family(msg.from_phone)
            try:
                if elder:
                    return self._handle_elder(elder, msg)
                if family_of:
                    return self._handle_family(msg)
            except Exception as e:  # last-resort guard: never leave the elder in silence
                log.exception("Unhandled error")
                if elder:
                    self._fail(elder, None, elder.preferred_language, "handling a message", e)
                else:
                    self._send_text_safely(msg.from_phone, f"Assistant error: {e}")
                return "error"
            log.warning("Ignoring message from unconfigured number %s", msg.from_phone)
            return "ignored"

    # ------------------------------------------------------------------ elder
    def _handle_elder(self, elder, msg):
        if msg.kind == "other":
            self.say(elder, elder.preferred_language, strings.get("send_voice_please",
                                                                  elder.preferred_language))
            return "asked_for_voice"
        pending = self.db.latest_request_for_elder(elder.phone, "awaiting_elder_confirmation")
        if pending:
            return self._handle_confirmation(elder, pending, msg)
        return self._handle_new_request(elder, msg)

    def _understand(self, msg, request_id=None):
        """Download audio if needed and run the AI pipeline."""
        if msg.kind == "audio":
            audio, mime = self.wa.download_media(msg.media_id)
            if request_id is not None:
                path = self._save_audio(request_id, audio, mime)
                self.db.update_request(request_id, audio_path=path, audio_mime=mime)
            return self.pipeline.understand(audio=audio, mime_type=mime)
        return self.pipeline.understand(text=msg.text)

    def _handle_new_request(self, elder, msg):
        pref = elder.preferred_language
        rid = self.db.create_request(elder.phone, elder.family_phone, pref)
        try:
            u = self._understand(msg, rid)
        except Exception as e:
            return self._fail(elder, rid, pref, "understanding the voice message", e)

        # Reply in the detected language; fall back to the preferred one.
        lang = u.language or pref
        self.db.update_request(
            rid, language=lang, transcript=u.transcript, translation=u.translation,
            intent=u.intent, pickup=u.pickup or elder.home_address, destination=u.destination,
            time=u.time, confidence=u.confidence, summary=u.summary)
        self.db.set_state(rid, "understood")
        low = u.confidence < self.cfg.confidence_threshold

        if u.intent == "ride" and not low and u.destination:
            question = self._confirmation_question(u, lang)
            self.db.update_request(rid, question=question)
            self.db.set_state(rid, "awaiting_elder_confirmation")
            self.say(elder, lang, f"{strings.get('assistant_intro', lang)} {question}", rid)
            return "asked_confirmation"

        if u.intent == "ride" and not low:
            self.db.set_state(rid, "needs_repeat", "no destination")
            self.say(elder, lang, strings.get("ask_destination", lang), rid)
            return "asked_destination"

        if u.intent in ALWAYS_TO_FAMILY or (u.intent == "other" and not low):
            self.db.set_state(rid, "handed_to_family", u.intent)
            self._alert_family(elder, self._non_ride_alert(elder, rid, u, lang))
            self._forward_audio(elder, rid)
            self.say(elder, lang, strings.get("non_ride", lang), rid)
            return "handed_to_family"

        self.db.set_state(rid, "needs_repeat", f"intent={u.intent} confidence={u.confidence}")
        self.say(elder, lang, strings.get("ask_repeat", lang), rid)
        return "asked_repeat"

    def _confirmation_question(self, u, lang):
        """Use the AI's question only if it is short and really in `lang`;
        otherwise build one from the fixed strings."""
        q = u.question
        if (q and u.language == lang and len(q) <= MAX_QUESTION_CHARS
                and languages.is_in_script(q, lang)):
            return q
        if u.time:
            return strings.get("confirm_ride_with_time", lang, destination=u.destination,
                               time=u.time)
        return strings.get("confirm_ride_no_time", lang, destination=u.destination)

    def _handle_confirmation(self, elder, req, msg):
        rid, lang = req["id"], req["language"] or elder.preferred_language
        if msg.kind == "text":
            heard = msg.text
        else:
            try:
                heard = self._understand(msg).transcript
            except Exception as e:
                return self._fail(elder, rid, lang, "understanding the yes/no answer", e)

        answer = languages.detect_yes_no(heard)  # deterministic, no AI
        if answer == "yes":
            self.db.set_state(rid, "awaiting_family", f"elder said: {heard}")
            if not self._send_family_request(elder, self.db.get_request(rid)):
                return self._fail(elder, rid, lang, "sending the request to the family",
                                  "WhatsApp message to the family member failed")
            self.say(elder, lang, strings.get("sent_to_family", lang), rid)
            return "sent_to_family"
        if answer == "no":
            self.db.set_state(rid, "cancelled", f"elder said: {heard}")
            self.say(elder, lang, strings.get("cancelled", lang), rid)
            self._alert_family(elder, f"FYI: {elder.name} cancelled ride request #{rid} "
                                      "themselves. Nothing to do.")
            return "cancelled"

        count = (req["unclear_count"] or 0) + 1
        self.db.update_request(rid, unclear_count=count)
        if count > self.cfg.max_unclear_replies:
            self.db.set_state(rid, "handed_to_family", "yes/no unclear")
            self._alert_family(elder, (
                f"{elder.name} could not confirm ride request #{rid} (yes/no was unclear "
                f"{count} times). Please call them.\nRequest: {req['summary']}\n"
                f"Their last answer (heard): {heard!r}"))
            self.say(elder, lang, strings.get("unclear_family_will_help", lang), rid)
            return "handed_to_family"
        self.say(elder, lang, strings.get("yes_no_unclear", lang), rid)
        return "asked_yes_no_again"

    # ----------------------------------------------------------------- family
    def _handle_family(self, msg):
        phone = msg.from_phone
        command, wanted = parse_family_command(msg.text if msg.kind == "text" else "")
        if not command:
            self._send_text_safely(phone, FAMILY_HELP)
            return "family_help"
        waiting = self.db.requests_awaiting_family(phone)
        if wanted is not None:
            req = next((r for r in waiting if r["id"] == wanted), None)
            if not req:
                self._send_text_safely(phone, f"Request #{wanted} is not waiting for you. "
                                              + self._waiting_list(waiting))
                return "family_unknown_request"
        elif not waiting:
            self._send_text_safely(phone, "There is no ride request waiting right now.")
            return "family_nothing_waiting"
        elif len(waiting) > 1:
            self._send_text_safely(phone, "More than one request is waiting. "
                                          + self._waiting_list(waiting))
            return "family_ambiguous"
        else:
            req = waiting[0]

        elder = self.cfg.elder_by_phone(req["elder_phone"])
        lang = req["language"] or elder.preferred_language
        if command == "BOOKED":
            self.db.set_state(req["id"], "booked", msg.text)
            self.say(elder, lang, strings.get("booked", lang), req["id"])
            self._send_text_safely(phone, f"Thanks. {elder.name} has been told (in "
                                          f"{languages.language_name(lang)}) that request "
                                          f"#{req['id']} is booked.")
            return "booked"
        self.db.set_state(req["id"], "declined", msg.text)
        self.say(elder, lang, strings.get("declined", lang), req["id"])
        self._send_text_safely(phone, f"OK. {elder.name} has been told kindly that request "
                                      f"#{req['id']} could not be booked. Please call them.")
        return "declined"

    @staticmethod
    def _waiting_list(waiting):
        if not waiting:
            return "No requests are waiting."
        lines = [f"#{r['id']}: {r['summary'] or r['destination']}" for r in waiting]
        return "Waiting: " + "; ".join(lines) + ". Reply BOOKED <number> or NO <number>."

    def _send_family_request(self, elder, req):
        lang = req["language"]
        text = (
            f"RIDE REQUEST #{req['id']} from {elder.name} (+{elder.phone})\n"
            f"Summary: {req['summary']}\n"
            f"Pickup: {req['pickup'] or 'not said'}\n"
            f"Destination: {req['destination']}\n"
            f"Time: {req['time'] or 'not said'} (asked at {req['created_at']} UTC)\n"
            f"Language detected: {languages.language_name(lang)} ({lang})\n"
            f"What they said (English): {req['translation']}\n"
            f"Original: {req['transcript']}\n"
            f"AI confidence: {req['confidence']:.2f}\n"
            f"{elder.name} has confirmed: YES.\n\n"
            f"Please book a cab yourself (Ola/Uber), then reply BOOKED {req['id']}. "
            f"Reply NO {req['id']} if you cannot. Nothing has been booked automatically.")
        if not self._alert_family(elder, text, request_id=req["id"]):
            return False
        self._forward_audio(elder, req["id"])
        return True

    def _non_ride_alert(self, elder, rid, u, lang):
        topic = {"medical": "HEALTH-RELATED", "legal": "LEGAL", "financial": "MONEY-RELATED"} \
            .get(u.intent, "OTHER")
        return (f"{topic} REQUEST #{rid} from {elder.name} (+{elder.phone}) - not a ride, the "
                f"assistant cannot help with this and gave no advice. Please contact them.\n"
                f"Summary: {u.summary}\n"
                f"Language detected: {languages.language_name(lang)} ({lang})\n"
                f"What they said (English): {u.translation}\n"
                f"Original: {u.transcript}")

    def _forward_audio(self, elder, rid):
        req = self.db.get_request(rid)
        path = req and req["audio_path"]
        if not path:
            return
        try:
            with open(path, "rb") as f:
                self.wa.send_audio(elder.family_phone, f.read(), req["audio_mime"] or "audio/ogg")
            self.db.log_outbound(elder.family_phone, "audio", f"original audio #{rid}",
                                 req["language"], rid)
        except Exception as e:
            log.warning("Could not forward audio: %s", e)
            self._send_text_safely(elder.family_phone,
                                   f"(The original voice note for #{rid} could not be attached: {e})")

    # --------------------------------------------------------------- sending
    def say(self, elder, lang, text, request_id=None):
        """Speak `text` to the elder in `lang`. Never raises.
        TTS failure -> send as text + alert family. Send failure -> try text, alert family."""
        try:
            audio, mime = self.tts.synthesize(text, lang)
        except Exception as e:
            log.warning("TTS failed (%s): %s", lang, e)
            sent = self._send_text_safely(elder.phone, text, lang, request_id)
            outcome = (f"It was sent to {elder.name} as text instead." if sent else
                       f"The text fallback also failed - please call {elder.name}.")
            ref = f" (request #{request_id})" if request_id else ""
            self._alert_family(elder, f"Voice reply failed for {languages.language_name(lang)}"
                                      f"{ref}: {e}. {outcome}", request_id)
            return sent
        try:
            wa_id = self.wa.send_audio(elder.phone, audio, mime)
            self.db.log_outbound(elder.phone, "audio", text, lang, request_id, wa_id)
            return True
        except Exception as e:
            log.warning("Audio send failed: %s", e)
            sent = self._send_text_safely(elder.phone, text, lang, request_id)
            self._alert_family(elder, (
                f"Could not send a voice reply to {elder.name} ({e}). "
                f"{'Sent as text instead.' if sent else 'Text also failed - please call them.'}"),
                request_id)
            return sent

    def _send_text_safely(self, phone, text, lang=None, request_id=None):
        try:
            wa_id = self.wa.send_text(phone, text)
            self.db.log_outbound(phone, "text", text, lang, request_id, wa_id)
            return True
        except Exception as e:
            log.error("Text send to %s failed: %s", phone, e)
            return False

    def _alert_family(self, elder, text, request_id=None):
        return self._send_text_safely(elder.family_phone, text, "en", request_id)

    def _fail(self, elder, rid, lang, stage, error):
        log.error("Failure while %s: %s", stage, error)
        if rid is not None:
            try:
                self.db.update_request(rid, error=str(error)[:1000])
                self.db.set_state(rid, "failed", stage)
            except InvalidTransition:
                pass
        self.say(elder, lang, strings.get("error_family_will_help", lang), rid)
        self._alert_family(elder, (
            f"PROBLEM{' with request #' + str(rid) if rid else ''} from {elder.name} "
            f"(+{elder.phone}) while {stage}: {error}\n"
            f"{elder.name} was told (in {languages.language_name(lang)}) that the family will "
            f"help. Please contact them."), rid)
        return "failed"

    def _save_audio(self, rid, data, mime):
        os.makedirs(self.cfg.audio_dir, exist_ok=True)
        ext = {"audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
               "audio/amr": "amr", "audio/aac": "aac"}.get(mime.split(";")[0], "bin")
        path = os.path.join(self.cfg.audio_dir, f"request_{rid}.{ext}")
        with open(path, "wb") as f:
            f.write(data)
        return path
