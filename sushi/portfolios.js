// Portfolio list for the SUSHI app.
// Each portfolio starts with no holdings. To add a stock, push an entry like
//   { ticker: "TICK", name: "Company name", shares: 10, avgCost: 100, price: 120 }
// into its `holdings` array; totals and weights are calculated automatically.
window.SUSHI_PORTFOLIOS = [
  {
    id: "growth",
    name: "Growth",
    description: "Companies growing revenue faster than the market.",
    holdings: [],
  },
  {
    id: "value",
    name: "Value",
    description: "Businesses trading below what they're worth.",
    holdings: [],
  },
  {
    id: "dividend",
    name: "Dividend",
    description: "Steady payers for regular income.",
    holdings: [],
  },
  {
    id: "tech",
    name: "Tech",
    description: "Software, chips and the platforms built on them.",
    holdings: [],
  },
  {
    id: "core",
    name: "Core",
    description: "Broad, long-term positions that anchor everything else.",
    holdings: [],
  },
  {
    id: "global",
    name: "Global",
    description: "Holdings listed outside the US.",
    holdings: [],
  },
];
