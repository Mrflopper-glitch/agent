"""Configuration from environment variables (.env) and contacts.json."""

import json
import os
import re
from dataclasses import dataclass, field

from . import languages


def normalize_phone(number):
    """WhatsApp sends numbers as digits only ("919876543210")."""
    return re.sub(r"\D", "", str(number or ""))


@dataclass
class Elder:
    name: str
    phone: str
    preferred_language: str
    family_name: str
    family_phone: str
    home_address: str = ""


@dataclass
class Config:
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_verify_token: str = ""
    whatsapp_api_version: str = "v23.0"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    db_path: str = "data/assistant.db"
    audio_dir: str = "data/audio"
    timezone: str = "Asia/Kolkata"
    confidence_threshold: float = 0.6
    max_unclear_replies: int = 2
    tts_default_provider: str = "gtts"
    tts_overrides: dict = field(default_factory=dict)  # {"ta": "edge"}
    convert_to_ogg: bool = True
    process_in_background: bool = True
    elders: list = field(default_factory=list)

    # --- lookups -----------------------------------------------------------
    def elder_by_phone(self, phone):
        phone = normalize_phone(phone)
        return next((e for e in self.elders if e.phone == phone), None)

    def elders_for_family(self, phone):
        phone = normalize_phone(phone)
        return [e for e in self.elders if e.family_phone == phone]

    def allowed_recipients(self):
        """The only numbers the bot will ever message."""
        numbers = set()
        for e in self.elders:
            numbers.add(e.phone)
            numbers.add(e.family_phone)
        return numbers


def load_contacts(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    elders = []
    for item in data.get("elders", []):
        lang = item.get("preferred_language", "en")
        if not languages.is_supported(lang):
            raise ValueError(
                f"Elder {item.get('name')!r}: preferred_language {lang!r} is not one of "
                f"{', '.join(languages.SUPPORTED)}")
        phone = normalize_phone(item.get("phone"))
        family = normalize_phone(item.get("family_phone"))
        if not phone or not family:
            raise ValueError(f"Elder {item.get('name')!r} needs both phone and family_phone")
        elders.append(Elder(
            name=item.get("name", "Elder"),
            phone=phone,
            preferred_language=lang,
            family_name=item.get("family_name", "Family"),
            family_phone=family,
            home_address=item.get("home_address", ""),
        ))
    phones = [e.phone for e in elders]
    if len(phones) != len(set(phones)):
        raise ValueError("The same elder phone number is listed twice in contacts")
    if set(phones) & {e.family_phone for e in elders}:
        raise ValueError("A number cannot be both an elder and a family member")
    return elders


def _bool(value, default):
    if value is None or value == "":
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def from_env(env=None):
    env = os.environ if env is None else env
    overrides = {}
    for code in languages.SUPPORTED:
        value = env.get(f"TTS_PROVIDER_{code.upper()}")
        if value:
            overrides[code] = value.strip().lower()
    contacts = env.get("CONTACTS_FILE", "contacts.json")
    return Config(
        whatsapp_token=env.get("WHATSAPP_TOKEN", ""),
        whatsapp_phone_number_id=env.get("WHATSAPP_PHONE_NUMBER_ID", ""),
        whatsapp_app_secret=env.get("WHATSAPP_APP_SECRET", ""),
        whatsapp_verify_token=env.get("WHATSAPP_VERIFY_TOKEN", ""),
        whatsapp_api_version=env.get("WHATSAPP_API_VERSION", "v23.0"),
        gemini_api_key=env.get("GEMINI_API_KEY", ""),
        gemini_model=env.get("GEMINI_MODEL", "gemini-2.5-flash"),
        db_path=env.get("DB_PATH", "data/assistant.db"),
        audio_dir=env.get("AUDIO_DIR", "data/audio"),
        timezone=env.get("TIMEZONE", "Asia/Kolkata"),
        confidence_threshold=float(env.get("CONFIDENCE_THRESHOLD", "0.6")),
        max_unclear_replies=int(env.get("MAX_UNCLEAR_REPLIES", "2")),
        tts_default_provider=env.get("TTS_PROVIDER", "gtts").strip().lower(),
        tts_overrides=overrides,
        convert_to_ogg=_bool(env.get("CONVERT_TO_OGG"), True),
        process_in_background=True,
        elders=load_contacts(contacts) if os.path.exists(contacts) else [],
    )


def check_required(cfg):
    """Return a list of missing settings (empty list = ready to run)."""
    missing = [name for name, value in [
        ("WHATSAPP_TOKEN", cfg.whatsapp_token),
        ("WHATSAPP_PHONE_NUMBER_ID", cfg.whatsapp_phone_number_id),
        ("WHATSAPP_APP_SECRET", cfg.whatsapp_app_secret),
        ("WHATSAPP_VERIFY_TOKEN", cfg.whatsapp_verify_token),
        ("GEMINI_API_KEY", cfg.gemini_api_key),
    ] if not value]
    if not cfg.elders:
        missing.append("CONTACTS_FILE (no elders configured)")
    return missing
