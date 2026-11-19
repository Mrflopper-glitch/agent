# Elder Ride Assistant (WhatsApp voice, v1)

An elderly person sends a WhatsApp **voice note** in Tamil, English, Hindi or Telugu
(code-mixed speech like "hospital ku taxi venum" is fine). The bot replies with a short
**voice note in the same language**, repeating the ride request as a yes/no question.
When they say yes, their **family member** (any country, English) gets a summary plus the
original audio, books an Ola/Uber cab themselves, and replies `BOOKED`. The elder then
hears a confirmation in their language. **Nothing is ever booked automatically.**

## Choices I made (briefly)

| Topic | Choice | Why |
|---|---|---|
| Location | Everything lives in `elder_voice_assistant/`. The repo's existing Mac/WhatsApp-Web agent files were left untouched. | That code is a different project; no shared logic. |
| AI | One Gemini REST call (`requests`, no SDK) with the audio inline, `temperature 0`, JSON output. Output is validated strictly; anything malformed is treated as an error. | One call, simple to mock, easy to swap models. |
| Yes/no | Pure keyword check (`assistant/languages.py`), all four languages' word lists always checked (elders say "ok"/"yes" in any language). Yes + no in the same answer = unclear, ask again. | Deterministic, as required. |
| Reply language | Detected language of the request; preferred language if Gemini returns nothing usable. Follow-up messages for a request (yes/no answer, booked, declined) stay in that request's language, because one-word answers ("ok") are too short to detect reliably. | Consistency for the elder. |
| Confirmation text | Gemini's question is used only if it is ≤300 chars and actually in the target script; otherwise a fixed template from `strings.py`. Always prefixed with "This is your digital assistant" (in their language). | Bot never presents as a person; limits what AI text the elder hears. |
| Non-ride (medical/legal/financial/other) | Elder hears a fixed phrase ("I can only help with cars; I told your family"); family gets an English alert + audio. Medical/legal/financial always go to family, even at low confidence. | The bot never speaks AI-generated advice. |
| Unclear yes/no | Ask again up to `MAX_UNCLEAR_REPLIES` (2) times, then hand to the family. | Avoid infinite loops. |
| TTS | **gTTS** (default) and **edge-tts** (optional), chosen per language via env vars. MP3 is converted to OGG/Opus with ffmpeg when available so it plays like a voice note. | Both free, no key, all four languages. |
| Family commands | `BOOKED`, `NO`, optionally with the request number (`BOOKED 12`). Required only when more than one request is waiting. | One family member may look after several elders. |
| Webhook | Replies 200 immediately, processes in a background thread, deduplicates by WhatsApp message id; one message processed at a time. | Meta retries slow webhooks. |
| People | `contacts.json` (elder, preferred language, home address used as default pickup, family member). | Easy to edit. |

## Folder structure

```
app.py                  Flask webhook (GET verify, POST messages, /health)
eval.py                 Accuracy report over a folder of labelled voice notes
assistant/
  config.py             .env + contacts.json
  languages.py          per-language yes/no keywords, script range, TTS voices
  strings.py            every elder-facing phrase in all four languages
  pipeline.py           Gemini call + strict output validation
  tts.py                swappable TTS providers (gtts, edge) + ffmpeg OGG conversion
  messaging.py          WhatsApp Cloud API client, signature check, allow-list
  flow.py               state machine
  db.py                 SQLite (messages, requests, state history)
tests/                  pytest, every external API mocked (279 tests)
eval_samples/           where your labelled voice notes go
contacts.example.json   .env.example   requirements.txt
```

State machine (`assistant/db.py` enforces allowed transitions):

```
received -> understood -> awaiting_elder_confirmation -> awaiting_family -> booked
                 |                    |                         |
                 |                    +-> cancelled (elder no)  +-> declined (family NO)
                 |                    +-> handed_to_family (yes/no unclear too often)
                 +-> needs_repeat (low confidence / no destination / unclear)
                 +-> handed_to_family (not a ride)
any step -> failed (elder told "family will help", family alerted with the error)
```

## Setup

You need: Python 3.11+, a laptop that stays on, a Facebook account, a Google account,
and ideally `ffmpeg` (`brew install ffmpeg` / `sudo apt install ffmpeg` / `winget install ffmpeg`).

### 1. Install

```bash
cd elder_voice_assistant
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
cp contacts.example.json contacts.json
```

### 2. Meta WhatsApp test number

Meta's dashboard changes often; the names below are what I know, so look for the
nearest equivalent if a label differs.

1. Go to <https://developers.facebook.com/apps>, **Create app**, choose the **Business**
   type (or "Other" then "Business"), and add the **WhatsApp** product.
2. Open **WhatsApp > API Setup**. Meta gives you a free **test phone number**. Copy:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary access token** → `WHATSAPP_TOKEN` (expires in about 24 hours).
3. **Add recipients**: on the same page, in the "To" field choose **Manage phone number
   list** and add **every elder and every family member** (the test number can message
   only verified numbers, up to 5 as far as I know). Each person gets a code by WhatsApp/SMS.
4. **App secret**: **App settings > Basic > App secret > Show** → `WHATSAPP_APP_SECRET`.
5. Make up a random string for `WHATSAPP_VERIFY_TOKEN`.
6. **Permanent token** (so it doesn't stop after a day): business.facebook.com >
   **Settings > Users > System users** > add an admin system user > **Assign assets**
   (your app) > **Generate token** with `whatsapp_business_messaging` and
   `whatsapp_business_management` permissions. Put it in `WHATSAPP_TOKEN`.
7. **Important – 24-hour rule:** WhatsApp only lets a business send free-form
   messages to someone who messaged it in the last 24 hours. **Ask the family member
   to send "hi" to the test number** (and re-send it if they haven't written for a day),
   otherwise the family summary will fail. When that happens the elder is told the family
   will help, but the family can't actually be reached; see Known limits.

### 3. Gemini API key

1. Go to <https://aistudio.google.com/apikey> and **Create API key** → `GEMINI_API_KEY`.
2. Keep `GEMINI_MODEL=gemini-2.5-flash` unless that model is retired or not free for you;
   check the current list at <https://ai.google.dev/gemini-api/docs/models> and pick a
   model that accepts audio input.

### 4. Text-to-speech per language

Defaults need no setup: `TTS_PROVIDER=gtts` uses gTTS for all four languages
(voices `ta`, `hi`, `te`, and `en` with an Indian accent).

To try Microsoft Edge's neural voices (often more natural) for one language, e.g. Tamil:

```
TTS_PROVIDER_TA=edge
```

Voices are set in `assistant/languages.py` (`ta-IN-PallaviNeural`, `hi-IN-SwaraNeural`,
`te-IN-ShrutiNeural`, `en-IN-NeerjaNeural`). Male alternatives listed by edge-tts:
`ta-IN-ValluvarNeural`, `hi-IN-MadhurNeural`, `te-IN-MohanNeural`, `en-IN-PrabhatNeural`.

Listen to each language before going live:

```bash
python -c "from assistant.tts import TTS; from assistant import strings
for l in ['ta','hi','te','en']:
    d,m=TTS('gtts').synthesize(strings.get('booked',l),l); open(f'sample_{l}.'+('ogg' if 'ogg' in m else 'mp3'),'wb').write(d)"
```

### 5. Contacts and preferred languages

Edit `contacts.json`. Numbers in international format (spaces/`+` are fine).
`preferred_language` is one of `ta`, `en`, `hi`, `te`. `home_address` is the default
pickup shown to the family. A number can't be both an elder and a family member.
**Every number here must also be added as a recipient in Meta (step 2.3).**
Restart the app after editing.

### 6. Run with a tunnel

```bash
python app.py                     # listens on http://127.0.0.1:5000
```

In a second terminal, either:

```bash
cloudflared tunnel --url http://localhost:5000      # free, no account; URL changes each run
# or
ngrok http 5000                                     # free account; check if your plan gives a fixed domain
```

Then in Meta: **WhatsApp > Configuration > Webhook > Edit**:
- Callback URL: `https://<your-tunnel-host>/webhook`
- Verify token: your `WHATSAPP_VERIFY_TOKEN`
- Click **Verify and save**, then under **Webhook fields** subscribe to **messages**.

With a Cloudflare quick tunnel the URL changes every restart, so you must update it in
Meta each time.

Test: from an elder's phone, send a voice note to the test number, e.g.
"I need a car to the hospital tomorrow at 10". From the family phone reply `BOOKED`.

### 7. Run the tests

```bash
pytest -q
```

All WhatsApp, Gemini and TTS calls are mocked; no keys or network needed.

### 8. Measure understanding with eval.py

Record ~10 real voice notes per language and label each (see `eval_samples/README.md`):

```bash
python eval.py eval_samples                 # uses GEMINI_API_KEY from .env
python eval.py eval_samples --json out.json --delay 6
```

It prints per-language and overall percentages for language detection, intent,
destination and time, the share of notes that were fully right (target ≥ 80%, i.e.
8 of 10 per language), and every failure with what was expected, what was heard, and
the English translation, so someone who can't read the language can still judge it.
`--delay` waits between calls to stay inside free-tier rate limits.

## Known limits (read before relying on it)

- **Not an emergency service.** A health message is forwarded to the family as text; if
  the family doesn't read WhatsApp, nobody acts. Elders should still call 112/108 directly.
- **The laptop must be on**, awake, online, with `app.py` and the tunnel running. If it's
  off, voice notes get no reply at all. Meta will retry the webhook for a while, but I
  don't know exactly how long.
- **24-hour messaging window** (see setup 2.7). Production use needs approved message
  templates to reach the family outside the window. v1 doesn't use templates.
- **Test number limits**: only verified recipients (a handful), and the test number can't
  be used for a real business. Moving to a real number requires Meta business verification.
- **Free-tier limits to check yourself** (they change and I can't verify them from here):
  - Gemini: requests per minute/day for your chosen model at
    <https://ai.google.dev/gemini-api/docs/rate-limits>. A 429 makes the elder hear
    "family will help" and the family gets the error.
  - **Privacy**: on the Gemini free tier Google's terms allow using your prompts (here,
    the elder's voice recordings) to improve their products. Check the current terms;
    the paid tier doesn't do this.
  - WhatsApp Cloud API pricing/free conversations and Graph API version support
    (`WHATSAPP_API_VERSION`).
- **TTS quality is uncertain for Tamil and Telugu.** gTTS is an unofficial use of Google
  Translate's voice: robotic, sometimes rate-limited, and could break without notice.
  The four languages produced valid audio in my test run, but nobody has listened to them
  for quality. Hindi and Indian English are usually acceptable. edge-tts is also unofficial
  and **I could not test it live** (my sandbox blocked its connection); only its error
  handling is tested. English words in the fallback template (e.g. "hospital",
  "tomorrow 10:00" inside a Tamil sentence) may be read oddly by the Tamil/Telugu/Hindi voices.
- **Non-English strings need native-speaker review.** Every Tamil, Hindi and Telugu
  line in `assistant/strings.py` is marked `# needs native-speaker review`. The Hindi
  lines use masculine verb forms ("पाया", "दूँगा") while the gTTS Hindi voice sounds female;
  a reviewer should pick one. The romanized yes/no keyword lists also need checking
  against how your family actually speaks; add words in `assistant/languages.py`.
- **Yes/no is keyword-only, on Gemini's transcript.** If Gemini mis-transcribes "aama",
  the answer is "unclear" and the elder is asked again (safe, but annoying). Negations like
  "not okay" contain both a yes- and no-word, so they count as unclear, not as no.
- **Times are relative words** ("tomorrow 10:00") as the AI understood them. The family
  summary also shows when the request was received, so check it before booking.
- **Untested against the real services.** The WhatsApp and Gemini request/response shapes
  come from their public docs as I know them; all tests mock them. Expect to fix small
  details on the first real run (the logs show the API's error text).
- **Python version**: written for 3.11; the test run here used Python 3.13 (3.11 wasn't
  available). Nothing 3.12+-specific is used.
- One process, one message at a time, SQLite: fine for a family, not for many users.

## Adding a fifth language

1. `assistant/languages.py`: add an entry (name, yes/no words in native script and
   romanized, Unicode script range, gTTS code / edge voice).
2. `assistant/strings.py`: add the language to every phrase (a test fails if one is missing).
3. Done. `tests/test_misc.py::test_adding_a_language_needs_no_logic_changes` does this
   for Kannada without touching any logic.
