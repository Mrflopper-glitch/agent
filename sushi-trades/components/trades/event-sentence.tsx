import type { TradeEvent } from "@/lib/feed";
import { price } from "@/lib/format";
import { closeVerb, describeInstrument, openVerb, tradeReturn } from "@/lib/trades";
import type { Trader } from "@/lib/types";
import { Change } from "../ui/numbers";

/** "@NoahQuant BTO NVDA 140C 11/15 @ 2.50" or "@NoahQuant STC NVDA 140C 11/15 @ 3.80 +52%". */
export function EventSentence({ event, trader, showReturn = true }: { event: TradeEvent; trader: Trader | undefined; showReturn?: boolean }) {
  const { trade } = event;
  const opening = event.kind === "open";
  const fill = opening ? trade.entryPrice : (trade.exitPrice ?? trade.entryPrice);

  return (
    <p>
      <span className="font-semibold">@{trader?.handle ?? trade.traderId}</span>{" "}
      <span className="text-muted">{opening ? openVerb(trade) : closeVerb(trade)}</span>{" "}
      <span className="font-semibold">{describeInstrument(trade)}</span>{" "}
      <span className="tabular text-muted">@ {price(fill)}</span>
      {!opening && showReturn && (
        <>
          {" "}
          <Change value={tradeReturn(trade, fill)} digits={1} />
        </>
      )}
    </p>
  );
}
