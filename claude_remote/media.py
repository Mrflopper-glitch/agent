"""Optional speech-to-text and screen capture providers, all running on the host."""

from __future__ import annotations

import asyncio
import base64
import io
import shlex
import tempfile
import time
import wave
from pathlib import Path


class MediaError(Exception):
    pass


async def _run_template(template: str, **paths: Path) -> str:
    args = [part.format(**{k: str(v) for k, v in paths.items()}) for part in shlex.split(template)]
    proc = await asyncio.create_subprocess_exec(
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), 60)
    except asyncio.TimeoutError:
        proc.kill()
        raise MediaError("command timed out")
    if proc.returncode != 0:
        raise MediaError(f"command failed: {err.decode(errors='replace').strip()[-200:]}")
    return out.decode(errors="replace")


async def transcribe(cfg, pcm16: bytes, rate: int) -> str:
    if cfg.stt == "fake":
        return f"fake transcript of {len(pcm16) / (2 * rate):.1f}s audio"
    if cfg.stt == "command" and cfg.stt_command:
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "clip.wav"
            with wave.open(str(wav), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(rate)
                w.writeframes(pcm16)
            return " ".join((await _run_template(cfg.stt_command, wav=wav)).split())
    raise MediaError("speech-to-text is not configured on the host")


def _to_jpeg(img, width: int, height: int) -> dict:
    from PIL import Image

    img = img.convert("RGB")
    img.thumbnail((width, height), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=60, optimize=True)
    return {"w": img.width, "h": img.height, "jpeg": base64.b64encode(buf.getvalue()).decode()}


async def capture_screen(cfg, width: int, height: int) -> dict:
    try:
        from PIL import Image, ImageDraw
    except ImportError as exc:
        raise MediaError("Pillow is required for screen previews") from exc
    width, height = max(32, min(width, 480)), max(32, min(height, 480))
    if cfg.screen == "fake":
        img = Image.new("RGB", (1280, 800), (30, 34, 44))
        draw = ImageDraw.Draw(img)
        draw.rectangle((0, 0, 1280, 40), fill=(60, 64, 80))
        draw.rectangle((120, 120, 900, 640), fill=(240, 240, 240))
        draw.text((140, 140), time.strftime("fake desktop %H:%M:%S"), fill=(20, 20, 20))
        return _to_jpeg(img, width, height)
    if cfg.screen == "command" and cfg.screen_command:
        with tempfile.TemporaryDirectory() as tmp:
            png = Path(tmp) / "screen.png"
            await _run_template(cfg.screen_command, png=png)
            return _to_jpeg(Image.open(png), width, height)
    raise MediaError("screen preview is not configured on the host")
