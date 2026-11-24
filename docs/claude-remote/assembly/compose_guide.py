"""Draws the watch screen texture and composes the rendered build guide sheet.

    python compose_guide.py screen out/screen.png
    python compose_guide.py sheet out/        # after Blender wrote out/*.png and out/labels.json
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SPEC = (46, 160, 67)
ILLUS = (217, 119, 87)
INK = (30, 32, 36)


def font(size, bold=False):
    try:
        return ImageFont.truetype(BOLD if bold else FONT, size)
    except OSError:
        return ImageFont.load_default()


def screen(out: Path) -> None:
    """A 240x240 chat screen like the firmware's, upscaled for a crisp texture."""
    s = 4
    im = Image.new("RGB", (240 * s, 240 * s), (11, 13, 16))
    d = ImageDraw.Draw(im)
    d.ellipse((14 * s, 12 * s, 22 * s, 20 * s), fill=(46, 160, 67))
    d.text((28 * s, 9 * s), "agent  ·  idle", font=font(11 * s), fill=(150, 150, 150))
    bubbles = [
        ((60, 34, 228, 66), (217, 119, 87), "run the tests"),
        ((12, 76, 200, 132), (32, 36, 42), "23 passed. one\nwarning, nothing\nto fix."),
        ((12, 142, 180, 174), (60, 44, 20), "Bash: git status"),
    ]
    for (x0, y0, x1, y1), fill, text in bubbles:
        d.rounded_rectangle((x0 * s, y0 * s, x1 * s, y1 * s), radius=10 * s, fill=fill)
        d.multiline_text(((x0 + 9) * s, (y0 + 7) * s), text, font=font(13 * s), fill=(235, 233, 230), spacing=3 * s)
    d.ellipse((96 * s, 186 * s, 144 * s, 234 * s), fill=(217, 119, 87))
    d.text((106 * s, 201 * s), "talk", font=font(12 * s, True), fill=(255, 255, 255))
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)


def arrow(d, a, b, color, width=6):
    import math

    d.line([a, b], fill=color, width=width)
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    for da in (2.6, -2.6):
        d.line([b, (b[0] + 26 * math.cos(ang + da), b[1] + 26 * math.sin(ang + da))], fill=color, width=width)


def annotate(img: Image.Image, view: dict) -> Image.Image:
    """Leader-line labels in a margin on each side of the render."""
    margin = 520
    w, h = img.size
    out = Image.new("RGB", (w + 2 * margin, h), (250, 250, 248))
    out.paste(img, (margin, 0))
    d = ImageDraw.Draw(out)
    f = font(25)
    gap, top, bottom = 78, 190, h - 70
    for side in ("left", "right"):
        labels = sorted((l for l in view["labels"] if (l["x"] < 0.5) == (side == "left")), key=lambda l: -l["y"])
        ys = [(1 - l["y"]) * h for l in labels]
        for i in range(len(ys)):  # keep anchor order, push apart, then fit inside the panel
            ys[i] = max(ys[i], top if i == 0 else ys[i - 1] + gap)
        for i in reversed(range(len(ys))):
            ys[i] = min(ys[i], bottom if i == len(ys) - 1 else ys[i + 1] - gap)
        for l, ty in zip(labels, ys):
            ax, ay = margin + l["x"] * w, (1 - l["y"]) * h
            color = SPEC if l["kind"] == "spec" else ILLUS
            tag = "[S]" if l["kind"] == "spec" else "[≈]"
            lines = [l["title"] + "  " + tag, l["detail"]]
            tx = 18 if side == "left" else w + margin + 22
            edge = margin - 10 if side == "left" else w + margin + 10
            d.line([(ax, ay), (edge, ty + 14), ((tx + 480) if side == "left" else tx, ty + 14)], fill=color, width=3)
            d.ellipse((ax - 7, ay - 7, ax + 7, ay + 7), fill=color)
            d.text((tx, ty - 18), lines[0], font=font(25, True), fill=INK)
            d.text((tx, ty + 18), lines[1], font=f, fill=(90, 92, 96))
    for a in view.get("arrows", []):
        arrow(d, (margin + a[0][0] * w, (1 - a[0][1]) * h), (margin + a[1][0] * w, (1 - a[1][1]) * h), (40, 110, 220))
    return out


PARTS = [
    ("spec", "LilyGO T-Watch S3 (stock, not Plus)", "ESP32-S3, 16 MB flash, 8 MB OPI PSRAM"),
    ("spec", "1.54\" 240 x 240 IPS, ST7789 + FT6336 touch", "active area ~27.7 mm square, from the diagonal"),
    ("spec", "LiPo 502530", "5 x 25 x 30 mm by cell code, ~400-470 mAh, charge at 125 mA"),
    ("spec", "AXP2101 PMU, DRV2605 haptics", "on the stock board"),
    ("spec", "PDM mic + MAX98357A speaker amp", "mic GPIO 47/44, I2S 48/15/46"),
    ("illustrative", "Case envelope", "~44 x 40 x 13 mm stand-in; measure before printing"),
    ("illustrative", "Board layout, bezel, glass", "positions only, not the real PCB"),
    ("illustrative", "Pocket bow pin, ring and chain", "default carry; any 22 mm spring bar fits the lugs"),
    ("illustrative", "Wrist strap", "OPTIONAL, not needed for pocket carry"),
]


def parts_list(d, x, y):
    d.text((x, y), "Parts and where the sizes come from", font=font(40, True), fill=INK)
    y += 80
    for kind, name, note in PARTS:
        color = SPEC if kind == "spec" else ILLUS
        d.rectangle((x, y + 6, x + 26, y + 32), fill=color)
        d.text((x + 44, y), name + ("  [S]" if kind == "spec" else "  [≈]"), font=font(30, True), fill=INK)
        d.text((x + 44, y + 40), note, font=font(26), fill=(90, 92, 96))
        y += 96


def sheet(out_dir: Path) -> None:
    meta = json.loads((out_dir / "labels.json").read_text())
    panels = []
    for view in meta["views"]:
        render = Image.open(out_dir / f"{view['name']}.png").convert("RGBA")
        flat = Image.new("RGBA", render.size, (250, 250, 248, 255))
        flat.alpha_composite(render)
        img = annotate(flat.convert("RGB"), view)
        d = ImageDraw.Draw(img)
        d.text((24, 20), view["title"], font=font(40, True), fill=INK)
        d.multiline_text((24, 74), view["caption"], font=font(26), fill=(70, 72, 76), spacing=6)
        img.save(out_dir / f"{view['name']}_annotated.png")
        panels.append(img)
    pw, ph = panels[0].size
    header = 260
    footer = 200
    W = pw * 2
    H = header + ph * ((len(panels) + 1) // 2) + footer
    sheet = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    d.text((40, 36), "Claude remote: T-Watch S3 pocket-watch build guide", font=font(64, True), fill=INK)
    d.text((40, 120), "Exploded reference of the stock LilyGO T-Watch S3 carried as a pocket watch. "
                      "The wrist strap is optional.", font=font(32), fill=(70, 72, 76))
    d.rectangle((40, 182, 70, 212), fill=SPEC)
    d.text((82, 180), "[S] spec-derived: LilyGO listing, chip datasheets, 502530 cell code", font=font(28), fill=INK)
    d.rectangle((1500, 182, 1530, 212), fill=ILLUS)
    d.text((1542, 180), "[≈] illustrative fit, not measured", font=font(28), fill=INK)
    for i, p in enumerate(panels):
        sheet.paste(p, ((i % 2) * pw, header + (i // 2) * ph))
    if len(panels) % 2:
        parts_list(d, pw + 60, header + (len(panels) // 2) * ph + 40)
    d.text((40, H - footer + 40),
           "No dimension here was measured on a physical unit. Case, board and chain geometry are stand-ins sized to "
           "the published parts; measure the real watch\nbefore printing any enclosure. LiPo charge current must stay "
           "at 125 mA (LilyGO). Source: build_guide.py (Blender 4.2) and watch_build_guide.blend.",
           font=font(28), fill=(90, 92, 96), spacing=8)
    sheet.save(out_dir / "build_guide.png")
    sheet.resize((W // 2, H // 2), Image.LANCZOS).save(out_dir / "build_guide_preview.png")


if __name__ == "__main__":
    {"screen": lambda p: screen(Path(p)), "sheet": lambda p: sheet(Path(p))}[sys.argv[1]](sys.argv[2])
