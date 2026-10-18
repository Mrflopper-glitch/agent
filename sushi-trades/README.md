# 🍣 Sushi Trades

**Track your Discord traders' calls live, and simulate a 7-figure portfolio by copying them.**

Sushi Trades (soon at sushitrades.com) listens to the trade alerts your traders post in Discord
(`BTO NVDA 140C 11/20 @ 2.50`, `STC NVDA @ 3.80`, `Long BTC 67,425`…), turns them into trades,
tracks how each trader is doing, and runs a **7-Figure Simulator**: _"If I had copied these traders
with $100K, putting 3% into every call, what would I have now, and when would I hit $1,000,000?"_

Until your Discord is connected, nine demo traders with a realistic trading history keep the app
alive, so everything works out of the box.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Run the app locally with hot reload             |
| `npm run build`     | Production build                                |
| `npm start`         | Serve the production build                      |
| `npm run bot`       | Start the Discord bot (see below)               |
| `npm test`          | Unit tests (parser, simulator, Discord ingest)  |
| `npm run lint`      | Lint                                            |
| `npm run typecheck` | TypeScript check                                |

## What's in the app

| Page                      | What it shows                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| **Home** `/`              | The dashboard: markets, your simulated portfolio, top traders, watchlist, ideas, community   |
| **Trades** `/trades`      | Every call from every trader, live. Click a call to see the original Discord message         |
| **Traders** `/traders`    | Leaderboard: how a $100K account copying each trader would have done                         |
| **Trader** `/traders/:id` | Stats, account curve, open positions, trade history, recent messages, "Copy in simulator"    |
| **Portfolio** `/portfolio`| The **7-Figure Simulator**: budget, position size, start date, who to copy, the road to $1M  |
| **Markets** `/markets`    | Indices, crypto and stocks with live prices; each symbol shows who's trading it              |
| **Watchlist**             | Your symbols, and which of your traders hold them                                            |
| **Community**             | The Discord feed: For You, Following, Discussions                                            |
| **Tools** `/tools`        | Discord connection status + a **message tester** to check how alerts are read                |

Everything moves: prices tick every 1.5s, numbers glide to new values, new Discord calls pop up as
toasts, and lists animate as items arrive. Animations respect the device's "reduce motion" setting.

## How the code is organized

The code is split so each folder has one job. Plain logic never touches React, and React never
does the math itself.

```
app/            Pages and API routes (one folder per URL)
  api/discord/          GET the Discord data, DELETE to clear it
  api/discord/ingest/   POST: the bot sends every new message here
components/     Everything you see, grouped by page (home/, traders/, portfolio/…) plus ui/ and charts/
state/          The live app state: clock, ticking prices, merged data, your saved settings
lib/            Plain TypeScript, no React, all unit-tested:
  types.ts              Trader, Trade, Message: the vocabulary of the app
  discord/parse.ts      Reads a Discord message → trade alert (or "just chat")
  sim/portfolio.ts      The 7-figure simulator
  sim/traders.ts        Trader scorecards (win rate, returns…)
  market/               The simulated market (prices, tickers, time)
  demo/                 The demo traders and their generated history
  server/               Server-only: saving Discord data, handling incoming messages
bot/            The Discord bot (a separate small program)
tests/          Unit tests
```

**Where to change things**

- Colors and fonts → `app/globals.css` (tokens like `--brand`) and `app/layout.tsx`
- Menu items → `components/layout/nav.ts`
- Message formats the parser understands → `lib/discord/parse.ts` (add a test in `tests/parse.test.ts`)
- Simulator rules (sizing, skipping when out of cash) → `lib/sim/portfolio.ts`
- Option pricing model → `lib/trades.ts` (`OPTION_LEVERAGE`, `OPTION_DECAY_PER_DAY`)
- Demo traders → `lib/demo/traders.ts`

## Connecting Discord

```
Discord channel ──▶ bot/index.ts ──POST──▶ /api/discord/ingest ──▶ .data/discord.json ──▶ browser (polls every 5s)
```

1. **Create a bot**: go to [discord.com/developers/applications](https://discord.com/developers/applications) → _New Application_ → _Bot_.
   Turn on **Message Content Intent**, then _Reset Token_ and copy it.
2. **Invite it** (OAuth2 → URL Generator → scope `bot`, permissions _View Channels_ + _Read Message History_) to your server.
3. **Configure**: `cp .env.example .env.local` and fill in:
   - `DISCORD_BOT_TOKEN`: the token from step 1
   - `DISCORD_CHANNEL_IDS`: the channels to watch (Developer Mode → right-click channel → _Copy Channel ID_), comma-separated
   - `DISCORD_INGEST_SECRET`: any long random string (the app rejects messages without it in production)
   - `SUSHI_URL`: where the app runs, e.g. `http://localhost:3000`
4. **Run** `npm run dev` in one terminal and `npm run bot` in another. Post an alert in Discord. It shows up in Trades within seconds.

Each Discord user who posts gets a trader profile automatically. Once real traders are flowing in,
set `NEXT_PUBLIC_DEMO_DATA=false` to hide the demo traders.

You can try all of this without a bot: **Tools → Message tester** sends a message through exactly the
same path.

### Messages it understands

| Message                                      | Read as                                   |
| -------------------------------------------- | ----------------------------------------- |
| `BTO NVDA 140C 11/20 @ 2.50 PT 4 SL 1.40`    | Buy a call, with target and stop          |
| `$AAPL 190 calls 11/27 @ 1.85 (half size)`   | Buy a call at half size                   |
| `BTO SPY 590C 0DTE @ .35 lotto`              | Buy a same-day call, quarter size         |
| `STO SPY 560P 11/20 @ 2.00`                  | Sell (short) a put                        |
| `BUY NVDA @ 135.42` / `Long BTC 67,425`      | Buy shares / crypto                       |
| `Short TSLA at 252.16`                       | Short shares                              |
| `STC NVDA 140C @ 3.80` / `Sold AMZN @ 182`   | Close the matching open trade             |
| `BTC SPY 560P @ 1.00` / `Cover TSLA @ 240`   | Close a short (BTC = buy to close)        |
| `Trim NVDA @ 3.20` / `Sold half AMZN @ 182`  | Close half the position                   |
| `Stopped out of NVDA`                        | Close at the current price                |
| `Added more NVDA here. Still early IMO.`     | Just chat: shows in Community             |

## How the simulator works

1. When a copied trader opens a trade, the simulator puts **your position size** (e.g. 3%) of your current
   account value into it. Half-size calls get half that, lottos a quarter.
2. When they close it, the simulator sells at their exit price.
3. If there isn't enough cash left, the trade is skipped (no borrowing).
4. Every day it records the account's value. Today's value updates live with prices.
5. "Road to 7 figures" projects your average growth rate forward to estimate when you'd reach $1M.

## Going to production

- **Hosting**: deploy to Vercel (or any Node host) and point sushitrades.com at it. Set the same env vars there.
- **Saving Discord data**: `lib/server/discord-store.ts` saves to a JSON file. That's fine on a server with a disk;
  on Vercel, swap its two functions for a database (Supabase, Neon, Upstash…). Nothing else changes.
- **The bot** is a long-running program, so run it somewhere that stays on (Railway, Fly.io, a small VPS) with
  `SUSHI_URL=https://sushitrades.com`.
- **Real prices**: prices currently come from a simulated market (`lib/market/prices.ts`), so the app works without
  any paid data. To use real quotes, replace the functions in that file with a data provider (Polygon, Alpaca,
  Finnhub…). Trades are marked relative to the price when they were opened, so the rest of the app doesn't change.

> Simulated results only. Options are valued with a simplified model, and past performance doesn't guarantee future results.
