# Northvane Promo — Design System

One file of rules for how every frame looks, moves and fills the screen.
Every scene in `index.html` reads its tokens from `brand.js`. Change the brand
there (name, colours, copy) and the whole video re-skins. **Do not hard-code
colours, fonts or copy inside scenes.**

> `Northvane` is a placeholder name. Swap `brand.js → name / domain / logo`
> for the real company. If you have a website, copy its colours into
> `brand.js → color` first, then re-render the stills before the video.

---

## 1. Canvas

| Rule | Value |
|---|---|
| Size | 1920 × 1080 (16:9), 30 fps |
| Length | 35.2 s = 22 bars at 150 BPM (1 beat = 0.4 s = 12 frames) |
| Safe area | 96 px on every side. Nothing important outside it. |
| Grid | 12 columns, 120 px each, 24 px gutters inside the safe area |

## 2. Fill the frame

A promo frame is a poster, not a slide.

1. **The subject fills ≥ 60 % of the frame** (height *or* width). A phone is
   ≥ 900 px tall. A slam word is ≥ 60 % of the frame width.
2. **Never a small thing centred in empty black.** If a scene has one element,
   scale it up, crop it, or add the data-texture background (§5).
3. **Split layouts are 7 / 5**: headline in 7 columns, device in the other 5.
   Alternate sides between consecutive split scenes to keep energy.
   Proof chips ("Verified $1M+", "Mirrored · NVDA") sit *under the headline*,
   never on top of the phone UI.
4. **Cropping is allowed and encouraged** for UI close-ups: let the phone bleed
   off the bottom or side edge when zoomed in.

## 3. Colour

All colours live in `brand.js → color`.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#05060A` | Frame background (never pure `#000`) |
| `bg2` | `#0B0E14` | Secondary panels, glow base |
| `surface` | `#131720` | Cards inside the app |
| `surface2` | `#1B202B` | Raised cards, inputs |
| `line` | `rgba(255,255,255,.10)` | Hairlines, card borders |
| `text` | `#F4F6FA` | Primary text — 18.9 : 1 on `bg` |
| `text2` | `#A9B2C1` | Secondary text — 9.4 : 1 on `bg` |
| `gain` | `#33F59A` | **Brand accent** + positive numbers |
| `loss` | `#FF5470` | Negative numbers only |
| `gold` | `#FFC94D` | Only for the words "seven-figure" / "top 1 %" |
| `onGain` | `#03170D` | Text placed on a `gain` fill |

Rules:
- **One accent per frame.** `gain` is the default. `gold` appears only where
  wealth tier is the message. `loss` appears only inside charts and P&L.
- **Contrast floor 4.5 : 1** for anything that carries meaning (text, logos,
  badges, icons). Check against the colour *directly behind it*, not the page.
- **No dark-gray on dark.** Any mark — a ticker badge, a partner/press logo, an
  icon — sits on its own chip whose fill gives ≥ 4.5 : 1 against the mark:
  - ticker badges: saturated fill from `brand.js → tickerFill` + white bold
    text + `1px rgba(255,255,255,.28)` rim so the chip separates from the card;
  - third-party logos (if you add any): use the logo's **white / light**
    version, or place the full-colour logo on a `text`-coloured (`#F4F6FA`)
    chip. Never a gray logo straight on `bg`.

## 4. Type

| Role | Font | Weight | Size | Tracking | Case |
|---|---|---|---|---|---|
| Slam | Inter Tight | 900 | 220–360 px | −0.05 em | UPPER |
| Headline | Inter Tight | 800 | 96–132 px | −0.04 em | Sentence |
| Kicker | JetBrains Mono | 600 | 26–30 px | +0.14 em | UPPER |
| Numbers | JetBrains Mono | 700 | any | −0.03 em | tabular |
| UI text | Inter Tight | 500–700 | 15–30 px (in-phone) | −0.01 em | Sentence |

- **≤ 4 words per slam, ≤ 7 words per headline.** If it doesn't fit, cut words.
- One highlighted word per headline, coloured `gain` (or `gold`, §3).
- Line-height 0.88 for slams, 0.96 for headlines.
- Every number that changes uses mono + tabular figures so it never jitters.

## 5. Backgrounds & texture

- Base: `bg` + one radial glow (`gain` at 14 % → transparent) behind the subject.
- **Data texture**: an 80 px grid of `rgba(255,255,255,.035)` lines drifting
  slowly, plus optional faint candlesticks. Used whenever a scene would
  otherwise be one element on black.
- Film grain at 4.5 % over everything, re-seeded every 2 frames (15 fps grain keeps
  the file small and survives Instagram / X re-encoding); vignette 42 % at the corners.
- Devices always get a **rim light** (1.5 px `rgba(255,255,255,.22)` border) and
  a `gain` glow behind them — a black phone on a black frame must never vanish.

## 6. Logo

**The logo appears exactly once: the end card.**

- Not in the app header (the in-app header shows the screen title instead).
- Not as a corner watermark, not on the phone splash, not in the intro.
- Never two logos on screen at the same time, and never mark + wordmark twice.
- The brand *name* is also held back until the end card — the reveal is the payoff.
- End card size: mark 232 px, wordmark 212 px font (≈ 155 px cap-height); the
  lockup spans ≈ 65 % of the frame width.

## 7. Motion

Fast, but readable.

- **Every cut lands on a beat** (multiples of 12 frames). Big changes land on
  the downbeat of a bar (multiples of 48).
- **Nothing is ever static.** Every scene has a camera push (scale 1.00 → 1.05
  across the scene). UI elements idle with a subtle float.
- Entrances: `expo-out`, 8–12 frames. UI cards: spring (`damping 14`), staggered
  by 3 frames (a 16th note).
- Exits: hard cut, or a 4-frame **whip** (translate 240 px + blur 24 px) when the
  next scene moves in the same direction.
- Slams: 2-frame scale punch (1.18 → 1.0), 4-frame camera shake (±14 px), 3 frames
  of chromatic split (red/cyan ±6 px). Use only on slam words and the drop.
- Flash: white overlay 0.9 → 0 over 6 frames, **max 3 per video** (drop, climax, logo).
- Camera shake never reveals the frame edge: the world scales up by just enough to
  cover the offset while it shakes.
- Readability floor: a word must be fully on screen ≥ 9 frames; a headline ≥ 30 frames.
  One exception: the pre-climax **number strobe** (4 numbers × 6 frames, once).

## 8. Scene kinds

Each kind gets a still that is reviewed before the video is rendered
(`npm run stills` → `stills/`).

| Kind | Scenes | Composition |
|---|---|---|
| **Slam** | 1, 5, 13 | One to three words, full-width, centred, punch + shake (13 ends in the number strobe) |
| **Type over data** | 2, 4 | Headline on the data-texture background, chart lines behind |
| **Stat** | 3, 11 | One giant mono number (≥ 300 px) + one-line caption |
| **Device split** | 6, 7, 9, 10 | 5/7 split, headline + phone (≥ 900 px tall), sides alternate |
| **UI close-up** | 8 | Phone scaled ≥ 1.5×, cropped by the frame edge, callouts float beside it |
| **Device trio** | 12 | Three phones in a fan, centre phone forward, fills width |
| **End card** | 14 | The one and only logo, tagline, CTA pill |

## 9. Review checklist (run on every still)

- [ ] Subject fills ≥ 60 % of the frame; no tiny centred island.
- [ ] Logo count on this frame is 0 (or exactly 1 on the end card).
- [ ] Every logo/badge/icon passes 4.5 : 1 against its *own* background.
- [ ] One accent colour; `gold` only on wealth-tier words.
- [ ] Headline ≤ 7 words, slam ≤ 4 words, nothing outside the 96 px safe area.
- [ ] Phone has rim light + glow and is clearly separated from the background.
- [ ] Numbers are mono/tabular.

## 10. Timeline (150 BPM, 12 frames per beat)

| Beats | Frames | Scene | Kind |
|---|---|---|---|
| 0–3 | 0–47 | 1 · MARKETS / MOVE / FAST. | Slam |
| 4–7 | 48–95 | 2 · Still reading charts at 2 AM? | Type over data |
| 8–11 | 96–143 | 3 · 10+ hrs a week lost to research | Stat |
| 12–15 | 144–191 | 4 · Meanwhile, seven-figure investors already moved. | Type over data |
| 16–19 | 192–239 | 5 · **Drop** — SEE THEIR PORTFOLIOS. / LIVE. | Slam |
| 20–23 | 240–287 | 6 · Introducing: the top 1%, trading in the open | Device split |
| 24–31 | 288–383 | 7 · Discover → tap *Follow* on the beat | Device split |
| 32–39 | 384–479 | 8 · Portfolio chart draws, pan to holdings | UI close-up |
| 40–47 | 480–575 | 9 · Trade alert lifts out of the phone, feed cascades | Device split |
| 48–55 | 576–671 | 10 · Mirror sheet, swipe on beat 52, success burst | Device split |
| 56–63 | 672–767 | 11 · 10 hrs → 10 min | Stat |
| 64–67 | 768–815 | 12 · One app. The whole picture. (breakdown) | Device trio |
| 68–75 | 816–911 | 13 · **Climax** — SEE IT. / FOLLOW IT. / MIRROR IT. / strobe | Slam |
| 76–87 | 912–1055 | 14 · Logo, tagline, CTA | End card |

The soundtrack (`soundtrack.py`) places every hit by the same frame numbers.
