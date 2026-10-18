import { closeOn } from "../market/prices";
import { dayIndex, dayStart } from "../market/time";
import { CONTRACT_MULTIPLIER, markPrice, tradeReturn } from "../trades";
import type { Trade } from "../types";

/**
 * The 7-figure portfolio simulator.
 *
 * "What if I had copied these traders with $X, putting Y% of my account into
 * every trade they called?" We answer that by replaying their trades in order:
 *
 *   1. When a trader opens a trade, we buy Y% of our current account value.
 *   2. When they close it, we sell at their exit price.
 *   3. At the end of every day we write down what the account is worth.
 *
 * replayPortfolio() does the history (it only changes when trades change) and
 * liveSnapshot() adds today's live prices on top (it runs on every price tick).
 */

export interface SimSettings {
  /** The cash the simulation starts with. */
  startingCash: number;
  /** Share of the account put into each trade (0.05 = 5%). */
  positionPct: number;
  /** Which traders to copy. */
  traderIds: string[];
  /** The simulated day the copying starts. */
  startDay: number;
}

export interface Position {
  trade: Trade;
  /** Shares, coins or option contracts held. */
  quantity: number;
  /** Cash we paid (or set aside, for shorts) to open it. */
  cost: number;
}

export interface ClosedPosition extends Position {
  proceeds: number;
  pnl: number;
  /** Return on the cash we put in, e.g. 0.25 = +25%. */
  returnPct: number;
}

export interface EquityPoint {
  day: number;
  equity: number;
}

export interface Replay {
  settings: SimSettings;
  /** Account value at the close of each day, up to and including `today`. */
  history: EquityPoint[];
  cash: number;
  open: Position[];
  closed: ClosedPosition[];
  /** Trades we couldn't afford to copy (not enough cash left). */
  skipped: number;
  today: number;
}

/** What a position is worth if one unit (share/coin/contract) is priced at `unitPrice`. */
export function positionValue(position: Position, unitPrice: number): number {
  const { trade, quantity, cost } = position;
  const multiplier = trade.option ? CONTRACT_MULTIPLIER : 1;
  const change = quantity * multiplier * (unitPrice - trade.entryPrice);
  return Math.max(0, cost + (trade.direction === "long" ? change : -change));
}

/** Value of a position at the close of a given day. */
function valueAtClose(position: Position, day: number): number {
  const underlying = closeOn(position.trade.symbol, day);
  return positionValue(position, markPrice(position.trade, underlying, dayStart(day + 1)));
}

/** Replays the copied trades from `settings.startDay` through simulated day `today`. */
export function replayPortfolio(trades: Trade[], settings: SimSettings, today: number): Replay {
  const copied = new Set(settings.traderIds);

  // Every open and close becomes an event; we walk through them in time order.
  type Event = { at: number; kind: "open" | "close"; trade: Trade };
  const events: Event[] = [];
  for (const trade of trades) {
    if (!copied.has(trade.traderId) || dayIndex(trade.openedAt) < settings.startDay) continue;
    events.push({ at: trade.openedAt, kind: "open", trade });
    if (trade.closedAt !== undefined) events.push({ at: trade.closedAt, kind: "close", trade });
  }
  events.sort((a, b) => a.at - b.at || (a.kind === "close" ? -1 : 1));

  let cash = settings.startingCash;
  const open = new Map<string, Position>();
  const closed: ClosedPosition[] = [];
  const history: EquityPoint[] = [];
  let skipped = 0;
  let next = 0;

  for (let day = settings.startDay; day <= today; day++) {
    while (next < events.length && dayIndex(events[next].at) === day) {
      const { kind, trade } = events[next++];

      if (kind === "open") {
        let equity = cash;
        for (const position of open.values()) equity += valueAtClose(position, day);
        const position = buyPosition(trade, Math.min(cash, equity * settings.positionPct * trade.size));
        if (!position) {
          skipped++;
          continue;
        }
        cash -= position.cost;
        open.set(trade.id, position);
      } else {
        const position = open.get(trade.id);
        if (!position) continue; // we never copied this one
        const proceeds = positionValue(position, trade.exitPrice ?? trade.entryPrice);
        cash += proceeds;
        open.delete(trade.id);
        closed.push({
          ...position,
          proceeds,
          pnl: proceeds - position.cost,
          returnPct: proceeds / position.cost - 1,
        });
      }
    }

    let equity = cash;
    for (const position of open.values()) equity += valueAtClose(position, day);
    history.push({ day, equity });
  }

  return { settings, history, cash, open: [...open.values()], closed, skipped, today };
}

/** Turns a cash budget into a position, or null if the budget can't buy even one unit. */
function buyPosition(trade: Trade, budget: number): Position | null {
  const unitCost = trade.entryPrice * (trade.option ? CONTRACT_MULTIPLIER : 1);
  // Crypto can be bought in fractions; shares and contracts come in whole units.
  const quantity = trade.assetClass === "crypto" ? budget / unitCost : Math.floor(budget / unitCost);
  if (quantity <= 0 || budget < 1) return null;
  return { trade, quantity, cost: quantity * unitCost };
}

// ── Live view ────────────────────────────────────────────────────────────────

export interface LivePosition extends Position {
  mark: number;
  value: number;
  pnl: number;
  returnPct: number;
}

export interface Snapshot {
  equity: number;
  cash: number;
  invested: number;
  startingCash: number;
  totalReturn: number;
  totalPnl: number;
  dayChange: number;
  dayChangePct: number;
  realizedPnl: number;
  unrealizedPnl: number;
  positions: LivePosition[];
  closed: ClosedPosition[];
  /** Daily history with today's point replaced by the live value. */
  points: EquityPoint[];
  winRate: number;
  wins: number;
  losses: number;
  bestTrade: ClosedPosition | null;
  maxDrawdown: number;
  skipped: number;
}

/** Combines the replayed history with live prices to get "right now" numbers. */
export function liveSnapshot(replay: Replay, livePrice: (symbol: string) => number, now: number): Snapshot {
  const positions: LivePosition[] = replay.open.map((position) => {
    const mark = markPrice(position.trade, livePrice(position.trade.symbol), now);
    const value = positionValue(position, mark);
    return { ...position, mark, value, pnl: value - position.cost, returnPct: tradeReturn(position.trade, mark) };
  });

  const invested = positions.reduce((sum, p) => sum + p.value, 0);
  const equity = replay.cash + invested;
  const { startingCash } = replay.settings;

  const points = replay.history.slice(0, -1).concat({ day: replay.today, equity });
  const yesterday = points.length > 1 ? points[points.length - 2].equity : startingCash;

  const wins = replay.closed.filter((c) => c.pnl > 0).length;
  const losses = replay.closed.length - wins;
  const bestTrade = replay.closed.reduce<ClosedPosition | null>((best, c) => (!best || c.returnPct > best.returnPct ? c : best), null);

  return {
    equity,
    cash: replay.cash,
    invested,
    startingCash,
    totalReturn: equity / startingCash - 1,
    totalPnl: equity - startingCash,
    dayChange: equity - yesterday,
    dayChangePct: equity / yesterday - 1,
    realizedPnl: replay.closed.reduce((sum, c) => sum + c.pnl, 0),
    unrealizedPnl: positions.reduce((sum, p) => sum + p.pnl, 0),
    positions,
    closed: replay.closed,
    points,
    winRate: replay.closed.length ? wins / replay.closed.length : 0,
    wins,
    losses,
    bestTrade,
    maxDrawdown: maxDrawdown(points),
    skipped: replay.skipped,
  };
}

/** The biggest peak-to-trough drop, e.g. 0.18 = the account fell 18% from a high at worst. */
export function maxDrawdown(points: EquityPoint[]): number {
  let peak = 0;
  let worst = 0;
  for (const { equity } of points) {
    peak = Math.max(peak, equity);
    if (peak > 0) worst = Math.max(worst, (peak - equity) / peak);
  }
  return worst;
}

/** Return over the last `days` days, e.g. periodReturn(points, 7) for "this week". */
export function periodReturn(points: EquityPoint[], days: number): number {
  if (points.length < 2) return 0;
  const last = points[points.length - 1];
  const from = points[Math.max(0, points.length - 1 - days)];
  return last.equity / from.equity - 1;
}

export interface GoalProjection {
  reached: boolean;
  /** Estimated days until the goal at the current growth rate, or null if not growing. */
  daysToGoal: number | null;
  /** Average growth per year so far, e.g. 0.6 = +60%/yr. */
  yearlyGrowth: number;
}

/** "At this pace, when do I hit $1,000,000?" */
export function projectGoal(points: EquityPoint[], goal: number): GoalProjection {
  const first = points[0];
  const last = points[points.length - 1];
  const elapsed = Math.max(1, (last?.day ?? 0) - (first?.day ?? 0));
  const dailyGrowth = first && last ? Math.log(last.equity / first.equity) / elapsed : 0;
  const yearlyGrowth = Math.exp(dailyGrowth * 365) - 1;

  if (last && last.equity >= goal) return { reached: true, daysToGoal: 0, yearlyGrowth };
  if (!last || dailyGrowth <= 0) return { reached: false, daysToGoal: null, yearlyGrowth };
  return { reached: false, daysToGoal: Math.log(goal / last.equity) / dailyGrowth, yearlyGrowth };
}
