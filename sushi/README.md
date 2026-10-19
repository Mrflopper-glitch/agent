# SUSHI web app

A static site with three screens:

1. **Landing** – the SUSHI logo and an **Enter** button (clicking it or pressing the Enter key opens the portfolios).
2. **Portfolios** – a card for each portfolio.
3. **Portfolio page** – a full page for one portfolio with its totals, allocation bar and a holdings table.

No stocks are included. Every portfolio starts empty.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
cd sushi
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Edit portfolios and holdings

Portfolios are defined in `portfolios.js`. Rename them, add or remove entries, or add stocks to a portfolio's `holdings` list:

```js
holdings: [
  { ticker: "TICK", name: "Company name", shares: 10, avgCost: 100, price: 120 },
],
```

Market value, cost basis, P/L and weights are calculated from those fields.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page markup for all three screens |
| `styles.css` | Styles, with light and dark themes |
| `app.js` | Screen switching, the Enter transition, and rendering |
| `portfolios.js` | Portfolio data |
| `assets/logo.png`, `assets/logo-dark.png` | The logo on a transparent background, for light and dark themes |
