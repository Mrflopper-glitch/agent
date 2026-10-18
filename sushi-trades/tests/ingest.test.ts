import { describe, expect, it } from "vitest";
import { ingestMessage, type IncomingMessage } from "../lib/server/ingest";
import { EMPTY_DISCORD } from "../lib/server/discord-store";
import type { DiscordData } from "../lib/types";

const POSTED = Date.UTC(2026, 9, 16, 15, 0);

function freshData(): DiscordData {
  return structuredClone(EMPTY_DISCORD);
}

function message(id: string, content: string, overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return { id, authorUsername: "moneymike", authorDisplayName: "Money Mike", channelName: "alerts", content, timestamp: POSTED, ...overrides };
}

describe("ingestMessage", () => {
  it("creates the trader, the message and the trade for an entry", () => {
    const data = freshData();
    const result = ingestMessage(data, message("1", "BTO NVDA 140C 11/20 @ 2.50 PT 4"));

    expect(result.action).toBe("open");
    expect(data.traders).toHaveLength(1);
    expect(data.traders[0]).toMatchObject({ id: "moneymike", handle: "MoneyMike", source: "discord" });
    expect(data.trades[0]).toMatchObject({ symbol: "NVDA", entryPrice: 2.5, target: 4, openedAt: POSTED, source: "discord" });
    expect(data.messages[0]).toMatchObject({ tradeId: data.trades[0].id, channel: "alerts" });
    expect(data.lastMessageAt).not.toBeNull();
  });

  it("ignores a message it has already seen", () => {
    const data = freshData();
    ingestMessage(data, message("1", "BTO NVDA 140C 11/20 @ 2.50"));
    const again = ingestMessage(data, message("1", "BTO NVDA 140C 11/20 @ 2.50"));
    expect(again.duplicate).toBe(true);
    expect(data.trades).toHaveLength(1);
    expect(data.messages).toHaveLength(1);
  });

  it("closes the matching open trade", () => {
    const data = freshData();
    ingestMessage(data, message("1", "BTO NVDA 140C 11/20 @ 2.50"));
    ingestMessage(data, message("2", "BTO NVDA 150C 11/20 @ 1.00"));
    const result = ingestMessage(data, message("3", "STC NVDA 140C @ 3.80", { timestamp: POSTED + 60_000 }));

    expect(result.action).toBe("close");
    expect(result.trade).toMatchObject({ id: "discord-1", exitPrice: 3.8, closedAt: POSTED + 60_000 });
    expect(data.trades.find((t) => t.id === "discord-2")?.closedAt).toBeUndefined();
  });

  it("splits a trim into a closed half and an open half", () => {
    const data = freshData();
    ingestMessage(data, message("1", "Long AAPL @ 180"));
    const result = ingestMessage(data, message("2", "Trim AAPL @ 190"));

    expect(result.action).toBe("trim");
    const [open, sold] = data.trades;
    expect(open.size).toBe(0.5);
    expect(open.closedAt).toBeUndefined();
    expect(sold).toMatchObject({ size: 0.5, exitPrice: 190 });
  });

  it("closes at the market price when no price is given", () => {
    const data = freshData();
    ingestMessage(data, message("1", "Long AAPL @ 180"));
    const result = ingestMessage(data, message("2", "Stopped out of AAPL"));
    expect(result.trade?.exitPrice).toBeGreaterThan(0);
  });

  it("explains when there is nothing to close", () => {
    const data = freshData();
    const result = ingestMessage(data, message("1", "Sold AMZN @ 180"));
    expect(result.trade).toBeUndefined();
    expect(result.note).toMatch(/No open AMZN trade/);
    expect(data.messages).toHaveLength(1); // still shows in Community
  });

  it("keeps chat as a plain message", () => {
    const data = freshData();
    const result = ingestMessage(data, message("1", "gm everyone"));
    expect(result.parse.ok).toBe(false);
    expect(data.trades).toHaveLength(0);
    expect(data.messages[0].tradeId).toBeUndefined();
  });

  it("gives a demo trader's Discord account their demo profile", () => {
    const data = freshData();
    ingestMessage(data, message("1", "BUY AAPL @ 184", { authorUsername: "LilyTrades" }));
    expect(data.traders[0]).toMatchObject({ id: "lilytrades", handle: "LilyTrades", name: "Lily Chen" });
  });
});
