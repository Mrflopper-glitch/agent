"""Text-to-speech behind a small swappable interface.

Each provider implements synthesize(text, lang) -> (audio_bytes, mime_type).
The provider is chosen per language: TTS_PROVIDER sets the default and
TTS_PROVIDER_TA / _HI / _TE / _EN override it for one language.
Voice names per language live in languages.py ("tts" entry).

Providers:
  gtts  - Google Translate's speech endpoint via the gTTS library. Free, no key,
          unofficial (can be rate-limited or change without notice).
  edge  - Microsoft Edge's online neural voices via the edge-tts library. Free,
          no key, unofficial. Usually sounds more natural. Optional install.
"""

import asyncio
import io
import shutil
import subprocess

from . import languages


class TTSError(Exception):
    pass


class GTTSProvider:
    name = "gtts"

    def synthesize(self, text, lang):
        try:
            from gtts import gTTS
        except ImportError as e:
            raise TTSError("gTTS is not installed (pip install gTTS)") from e
        voice = languages.LANGUAGES[lang]["tts"]
        buf = io.BytesIO()
        try:
            gTTS(text, lang=voice["gtts"], tld=voice.get("gtts_tld", "com"), slow=False) \
                .write_to_fp(buf)
        except Exception as e:  # gTTS raises several error types
            raise TTSError(f"gTTS failed for {lang}: {e}") from e
        data = buf.getvalue()
        if not data:
            raise TTSError(f"gTTS returned no audio for {lang}")
        return data, "audio/mpeg"


class EdgeTTSProvider:
    name = "edge"

    def synthesize(self, text, lang):
        try:
            import edge_tts
        except ImportError as e:
            raise TTSError("edge-tts is not installed (pip install edge-tts)") from e
        voice = languages.LANGUAGES[lang]["tts"].get("edge")
        if not voice:
            raise TTSError(f"No edge-tts voice configured for {lang}")

        async def run():
            out = bytearray()
            # Slightly slower speech is easier for elderly listeners.
            async for chunk in edge_tts.Communicate(text, voice, rate="-10%").stream():
                if chunk.get("type") == "audio":
                    out.extend(chunk["data"])
            return bytes(out)

        try:
            data = asyncio.run(run())
        except Exception as e:
            raise TTSError(f"edge-tts failed for {lang}: {e}") from e
        if not data:
            raise TTSError(f"edge-tts returned no audio for {lang}")
        return data, "audio/mpeg"


PROVIDERS = {"gtts": GTTSProvider, "edge": EdgeTTSProvider}


def mp3_to_ogg_opus(data):
    """Convert MP3 to OGG/Opus with ffmpeg so WhatsApp shows a voice-note style
    audio. Returns None if ffmpeg is missing or fails (caller sends the MP3)."""
    if not shutil.which("ffmpeg"):
        return None
    try:
        result = subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-i", "pipe:0", "-c:a", "libopus", "-b:a", "32k",
             "-ac", "1", "-ar", "16000", "-f", "ogg", "pipe:1"],
            input=data, capture_output=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0 or not result.stdout:
        return None
    return result.stdout


class TTS:
    """Picks a provider per language and optionally converts to OGG/Opus."""

    def __init__(self, default_provider="gtts", overrides=None, convert_to_ogg=True,
                 providers=None):
        self.providers = providers or {k: cls() for k, cls in PROVIDERS.items()}
        self.default = default_provider
        self.overrides = overrides or {}
        self.convert_to_ogg = convert_to_ogg
        for name in [default_provider, *self.overrides.values()]:
            if name not in self.providers:
                raise ValueError(f"Unknown TTS provider {name!r}; choose from "
                                 f"{', '.join(self.providers)}")

    def provider_for(self, lang):
        return self.providers[self.overrides.get(lang, self.default)]

    def synthesize(self, text, lang):
        if not languages.is_supported(lang):
            raise TTSError(f"Unsupported language {lang!r}")
        data, mime = self.provider_for(lang).synthesize(text, lang)
        if self.convert_to_ogg and mime == "audio/mpeg":
            ogg = mp3_to_ogg_opus(data)
            if ogg:
                return ogg, "audio/ogg"
        return data, mime
