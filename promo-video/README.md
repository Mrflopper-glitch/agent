# Northvane — 35-second promo

A fast-cut 1080p30 launch promo for a trading app where seven-figure investors
share their portfolios live. It is built in three steps:

1. **`DESIGN.md`**: the design system. One file of rules for colour, type, layout,
   motion and logo use, with a checklist for every frame.
2. **`stills/`**: one still for each kind of scene, reviewed before any video is rendered
   (`stills/contact-sheet.jpg` shows them all).
3. **`out/promo.mp4`**: the video, rendered frame by frame from the same code as
   the stills. The soundtrack is synthesised and locked to the cuts.

## Files

| File | What it is |
|---|---|
| `brand.js` | **Edit this first.** Name, URL, colours, every line of copy, demo investors |
| `DESIGN.md` | The rules, plus the beat-by-beat timeline |
| `index.html` | The 14 scenes. Open it in a browser to preview (click for sound) |
| `render.mjs` | Headless-Chromium renderer: stills, or the full video |
| `soundtrack.py` | Original 150 BPM track and SFX, placed by frame number |

## Make it yours

1. In `brand.js`, set `name`, `domain`, `tagline`, `cta` and the `color` tokens
   (copy the colours from your website).
2. Replace the two **placeholder stats** (`copy.s3` and `copy.s11`: "10+ hrs a week",
   "10 hrs → 10 min") with numbers you can back up before you run ads.
3. Swap the logo SVG in `index.html` (`LOGO`, scene 14). It appears only there.
4. Re-render and check the stills, then the video:

```bash
npm install
npm run stills          # -> stills/*.jpg + contact sheet; look at every one
npm run video           # -> out/promo.mp4 (1080p) + out/promo-720p.mp4
```

The renderer needs Node 18+, Python 3 with `numpy` and `scipy`, `ffmpeg`, and the
Playwright Chromium browser. The 1080p master (`out/promo.mp4`, about 64 MB) is
git-ignored. Rebuild it with `npm run video`.

## Fixes from the first draft

- **Logo appeared twice**: there is now one rule (DESIGN.md §6). The logo and the
  brand name appear only on the end card, never in the app header, a watermark or
  the notification icon.
- **Company logos were dark gray on dark**: every mark now sits on its own chip that
  passes 4.5 : 1 contrast (DESIGN.md §3). Ticker badges use saturated fills with white
  text and a light rim. Any real partner or press logo must use its white version or
  sit on a light chip.
