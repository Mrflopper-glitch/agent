// Brand tokens + copy. Everything a scene shows comes from here (see DESIGN.md).
// Swap these for the real company and re-run `npm run stills`, then `npm run video`.
window.BRAND = {
  name: 'Northvane',            // placeholder company name
  domain: 'northvane.app',      // placeholder URL for the end card
  tagline: ['Trade alongside', 'the top 1%.'],
  cta: 'Get early access',

  color: {
    bg: '#05060A',
    bg2: '#0B0E14',
    surface: '#131720',
    surface2: '#1B202B',
    line: 'rgba(255,255,255,.10)',
    text: '#F4F6FA',
    text2: '#A9B2C1',
    gain: '#33F59A',
    loss: '#FF5470',
    gold: '#FFC94D',
    onGain: '#03170D',
  },

  // Ticker chip fills: all pass >= 4.5:1 with white text.
  tickerFill: {
    NVDA: '#15803D', AAPL: '#2563EB', MSFT: '#7C3AED', BTC: '#C2410C',
    TSLA: '#DC2626', AMZN: '#B45309', META: '#1D4ED8', PLTR: '#0F766E',
  },

  // Headline copy by scene. Keep slams <= 4 words, headlines <= 7 words.
  copy: {
    s1: ['MARKETS', 'MOVE', 'FAST.'],
    s2: { kicker: '02:47 AM · STILL RESEARCHING', line1: 'Still reading', line2: 'charts at 2 AM?' },
    // Placeholder stat: replace with your own research before running ads.
    s3: { value: 10, suffix: '+ hrs', caption: 'a week lost to research.' },
    s4: { line1: 'Meanwhile,', hl: 'seven-figure', line2: 'investors', line3: 'already moved.' },
    s5: ['SEE THEIR', 'PORTFOLIOS.', 'LIVE.'],
    s6: { kicker: 'INTRODUCING', line1: 'The', hl: 'top 1%,', line2: 'trading in', line3: 'the open.' },
    s7: { kicker: '01 · DISCOVER', line1: 'Follow verified', hl: 'seven-figure', line2: 'portfolios.' },
    s8: { kicker: '02 · TRACK', line1: 'Every position.', line2: 'Every', hl: 'move.' },
    s9: { kicker: '03 · ALERTS', line1: 'Know the', hl: 'second', line2: 'they trade.' },
    s10: { kicker: '04 · MIRROR', line1: 'Mirror it in', hl: 'one tap.' },
    // Placeholder stat: replace with your own numbers before running ads.
    s11: { from: '10 hrs', to: '10 min', caption: 'of research, every week.' },
    s12: { line1: 'One app.', hl: 'The whole picture.' },
    s13: ['SEE IT.', 'FOLLOW IT.', 'MIRROR IT.'],
  },

  // Demo data shown inside the app UI (fictional people, illustrative numbers).
  investors: [
    { name: 'Marcus Reid',     tag: 'Tech growth',  value: 7412880,  ytd: 28.9, hue: '#2563EB' },
    { name: 'Priya Kapoor',    tag: 'Macro · ETFs', value: 4820115,  ytd: 41.2, hue: '#7C3AED' },
    { name: 'Daniel Okafor',   tag: 'Crypto + AI',  value: 2361904,  ytd: 63.5, hue: '#C2410C' },
    { name: 'Sofia Lindqvist', tag: 'Dividends',    value: 12904330, ytd: 19.7, hue: '#0F766E' },
    { name: 'James Whitfield', tag: 'Momentum',     value: 3052770,  ytd: 34.1, hue: '#B45309' },
  ],
  holdings: [
    { t: 'NVDA', n: 'NVIDIA',    w: 24.1, ch: 3.84 },
    { t: 'MSFT', n: 'Microsoft', w: 17.6, ch: 1.12 },
    { t: 'BTC',  n: 'Bitcoin',   w: 14.3, ch: 5.27 },
    { t: 'AAPL', n: 'Apple',     w: 12.8, ch: -0.46 },
    { t: 'PLTR', n: 'Palantir',  w: 9.2,  ch: 6.91 },
  ],
  alerts: [
    { who: 'Marcus Reid',     act: 'bought',  t: 'NVDA', amt: '$240,000' },
    { who: 'Priya Kapoor',    act: 'added',   t: 'MSFT', amt: '$118,500' },
    { who: 'Daniel Okafor',   act: 'bought',  t: 'BTC',  amt: '$402,000' },
    { who: 'Sofia Lindqvist', act: 'trimmed', t: 'TSLA', amt: '$86,200' },
    { who: 'James Whitfield', act: 'bought',  t: 'PLTR', amt: '$64,000' },
    { who: 'Priya Kapoor',    act: 'bought',  t: 'AMZN', amt: '$150,000' },
    { who: 'Marcus Reid',     act: 'added',   t: 'META', amt: '$97,300' },
  ],
};
