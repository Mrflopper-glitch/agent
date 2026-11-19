"""Flask webhook for the WhatsApp ride assistant.

Run:  python app.py      (reads .env and contacts.json)
"""

import logging
import os
import sys
import threading

from flask import Flask, abort, request

from assistant import config as config_mod
from assistant.db import Database
from assistant.flow import Assistant
from assistant.messaging import WhatsAppClient, parse_webhook, verify_signature
from assistant.pipeline import GeminiPipeline
from assistant.tts import TTS

log = logging.getLogger("app")


def build_assistant(cfg):
    os.makedirs(os.path.dirname(cfg.db_path) or ".", exist_ok=True)
    db = Database(cfg.db_path)
    wa = WhatsAppClient(cfg.whatsapp_token, cfg.whatsapp_phone_number_id,
                        cfg.allowed_recipients(), cfg.whatsapp_api_version)
    pipeline = GeminiPipeline(cfg.gemini_api_key, cfg.gemini_model, cfg.timezone)
    tts = TTS(cfg.tts_default_provider, cfg.tts_overrides, cfg.convert_to_ogg)
    return Assistant(cfg, db, wa, pipeline, tts)


def create_app(cfg, assistant):
    app = Flask(__name__)

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.get("/webhook")
    def verify():
        # Meta calls this once when you register the webhook URL.
        if (request.args.get("hub.mode") == "subscribe"
                and cfg.whatsapp_verify_token
                and request.args.get("hub.verify_token") == cfg.whatsapp_verify_token):
            return request.args.get("hub.challenge", ""), 200
        abort(403)

    @app.post("/webhook")
    def receive():
        raw = request.get_data()
        if not verify_signature(cfg.whatsapp_app_secret, raw,
                                request.headers.get("X-Hub-Signature-256", "")):
            log.warning("Rejected webhook with bad signature")
            abort(403)
        payload = request.get_json(silent=True) or {}
        for msg in parse_webhook(payload):
            if cfg.process_in_background:
                # Reply 200 fast; Meta retries slow webhooks (duplicates are ignored by id).
                threading.Thread(target=assistant.handle, args=(msg,), daemon=True).start()
            else:
                assistant.handle(msg)
        return "ok", 200

    return app


def main():
    from dotenv import load_dotenv
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cfg = config_mod.from_env()
    missing = config_mod.check_required(cfg)
    if missing:
        print("Missing settings: " + ", ".join(missing) + "\nSee .env.example and README.md.")
        sys.exit(1)
    app = create_app(cfg, build_assistant(cfg))
    port = int(os.environ.get("PORT", "5000"))
    log.info("Listening on port %s for %d elder(s)", port, len(cfg.elders))
    app.run(host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
