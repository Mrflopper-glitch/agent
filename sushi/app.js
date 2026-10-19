(function () {
  "use strict";

  var portfolios = window.SUSHI_PORTFOLIOS || [];

  var $ = function (id) { return document.getElementById(id); };
  var views = {
    landing: $("view-landing"),
    portfolios: $("view-portfolios"),
    detail: $("view-detail"),
  };
  var topbar = $("topbar");
  var wipe = $("wipe");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  var moneyShort = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
  var qty = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
  var pct = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

  var current = null;
  var busy = false;

  // ---------- Data ----------

  function findPortfolio(id) {
    for (var i = 0; i < portfolios.length; i++) {
      if (portfolios[i].id === id) return portfolios[i];
    }
    return null;
  }

  function summarize(p) {
    var rows = (p.holdings || []).map(function (h) {
      var shares = Number(h.shares) || 0;
      var price = Number(h.price) || 0;
      var avgCost = Number(h.avgCost) || 0;
      return {
        ticker: h.ticker || "",
        name: h.name || "",
        shares: shares,
        price: price,
        avgCost: avgCost,
        value: shares * price,
        cost: shares * avgCost,
      };
    });
    var value = 0;
    var cost = 0;
    rows.forEach(function (r) { value += r.value; cost += r.cost; });
    rows.forEach(function (r) { r.weight = value > 0 ? r.value / value : 0; });
    rows.sort(function (a, b) { return b.value - a.value; });
    return { rows: rows, value: value, cost: cost, pl: value - cost };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function signed(n, fmt) {
    if (n === 0) return fmt.format(0);
    return (n > 0 ? "+" : "−") + fmt.format(Math.abs(n));
  }

  function allocMarkup(rows) {
    return rows
      .filter(function (r) { return r.weight > 0; })
      .map(function (r, i) {
        return '<span class="tone-' + (i % 6) + '" style="flex:' + r.weight + '" title="' +
          esc(r.ticker) + " " + pct.format(r.weight) + '"></span>';
      })
      .join("");
  }

  // ---------- Portfolio list ----------

  function renderGrid() {
    var totalHoldings = 0;
    $("portfolio-grid").innerHTML = portfolios.map(function (p) {
      var s = summarize(p);
      totalHoldings += s.rows.length;
      return (
        '<li><a class="card" href="#p-' + esc(p.id) + '" data-route="detail" data-id="' + esc(p.id) + '">' +
          '<div class="card-top">' +
            '<span class="glyph" aria-hidden="true"><span class="glyph-body"></span></span>' +
            '<span class="card-count">' + plural(s.rows.length, "holding") + "</span>" +
          "</div>" +
          '<h3 class="card-name">' + esc(p.name) + "</h3>" +
          '<p class="card-desc">' + esc(p.description || "") + "</p>" +
          '<div class="alloc' + (s.rows.length ? "" : " is-empty") + '" aria-hidden="true">' + allocMarkup(s.rows) + "</div>" +
          '<div class="card-foot">' +
            '<div><span class="label">Market value</span><span class="value">' +
              (s.rows.length ? moneyShort.format(s.value) : "—") + "</span></div>" +
            '<span class="open">Open <span class="arrow" aria-hidden="true">→</span></span>' +
          "</div>" +
        "</a></li>"
      );
    }).join("");

    $("portfolios-summary").textContent =
      plural(portfolios.length, "portfolio") + " · " + plural(totalHoldings, "holding");
  }

  // ---------- Portfolio detail ----------

  function renderDetail(p) {
    var s = summarize(p);
    var has = s.rows.length > 0;

    $("detail-name").textContent = p.name;
    $("detail-desc").textContent = p.description || "";
    $("crumb-current").textContent = p.name;

    $("stat-count").textContent = String(s.rows.length);
    $("stat-value").textContent = has ? money.format(s.value) : "—";
    $("stat-cost").textContent = has ? money.format(s.cost) : "—";
    var pl = $("stat-pl");
    pl.className = has && s.pl !== 0 ? (s.pl > 0 ? "up" : "down") : "";
    pl.textContent = has
      ? signed(s.pl, money) + (s.cost > 0 ? "  " + signed(s.pl / s.cost, pct) : "")
      : "—";

    var alloc = $("alloc");
    alloc.className = "alloc alloc-lg" + (has ? "" : " is-empty");
    alloc.innerHTML = allocMarkup(s.rows);
    $("alloc-note").textContent = has ? "By market value" : "Nothing allocated yet";
    $("legend").innerHTML = s.rows.map(function (r, i) {
      return '<li><span class="swatch tone-' + (i % 6) + '"></span>' + esc(r.ticker) + " " + pct.format(r.weight) + "</li>";
    }).join("");

    $("holdings-note").textContent = plural(s.rows.length, "stock");
    $("holdings-body").innerHTML = s.rows.map(function (r) {
      var rowPl = r.value - r.cost;
      var cls = rowPl > 0 ? "up" : rowPl < 0 ? "down" : "";
      return (
        "<tr>" +
          '<td class="ticker">' + esc(r.ticker) + "</td>" +
          '<td class="company">' + esc(r.name) + "</td>" +
          '<td class="num">' + qty.format(r.shares) + "</td>" +
          '<td class="num">' + money.format(r.avgCost) + "</td>" +
          '<td class="num">' + money.format(r.price) + "</td>" +
          '<td class="num">' + money.format(r.value) + "</td>" +
          '<td class="num ' + cls + '">' + signed(rowPl, money) + "</td>" +
          '<td class="num">' + pct.format(r.weight) + "</td>" +
        "</tr>"
      );
    }).join("");
    $("holdings-empty").hidden = has;

    // Previous / next wrap around the list
    var i = portfolios.indexOf(p);
    var prev = portfolios[(i - 1 + portfolios.length) % portfolios.length];
    var next = portfolios[(i + 1) % portfolios.length];
    setPager($("pager-prev"), prev);
    setPager($("pager-next"), next);
    $("pager-prev").parentNode.hidden = portfolios.length < 2;
  }

  function setPager(link, p) {
    link.href = "#p-" + p.id;
    link.setAttribute("data-route", "detail");
    link.setAttribute("data-id", p.id);
    link.querySelector(".pager-name").textContent = p.name;
  }

  // ---------- Routing ----------

  function parseHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (h === "portfolios") return { view: "portfolios" };
    if (h.indexOf("p-") === 0 && findPortfolio(h.slice(2))) return { view: "detail", id: h.slice(2) };
    return { view: "landing" };
  }

  function hashFor(r) {
    if (r.view === "portfolios") return "portfolios";
    if (r.view === "detail") return "p-" + r.id;
    return "";
  }

  function same(a, b) { return !!a && !!b && a.view === b.view && a.id === b.id; }

  function render(r, animate) {
    current = r;
    Object.keys(views).forEach(function (k) {
      views[k].hidden = k !== r.view;
      views[k].classList.remove("is-entering");
    });
    topbar.hidden = r.view === "landing";

    var onDetail = r.view === "detail";
    $("crumb-sep").hidden = !onDetail;
    $("crumb-current").hidden = !onDetail;
    if (onDetail) {
      $("crumb-portfolios").removeAttribute("aria-current");
      renderDetail(findPortfolio(r.id));
    } else {
      $("crumb-portfolios").setAttribute("aria-current", "page");
    }

    var view = views[r.view];
    if (animate && r.view !== "landing" && !reduceMotion.matches) {
      void view.offsetWidth;
      view.classList.add("is-entering");
    }

    window.scrollTo(0, 0);
    var heading = r.view === "detail" ? $("detail-name") : r.view === "portfolios" ? $("portfolios-title") : null;
    if (heading && animate) heading.focus({ preventScroll: true });
    if (r.view === "landing") drawTape();

    try {
      if ((location.hash || "").replace(/^#/, "") !== hashFor(r)) location.hash = hashFor(r);
    } catch (e) { /* hash updates are a convenience only */ }
  }

  function go(r) {
    if (busy || same(r, current)) return;
    var fromLanding = current && current.view === "landing";
    if (fromLanding && r.view === "portfolios" && !reduceMotion.matches) {
      runWipe(function () { render(r, false); });
    } else {
      render(r, true);
    }
  }

  // Green panel rises over the landing, the grid swaps in underneath, then it lifts away.
  function runWipe(swap) {
    busy = true;
    wipe.className = "wipe";
    void wipe.offsetWidth;
    wipe.classList.add("is-covering");
    setTimeout(function () {
      swap();
      wipe.className = "wipe is-covered";
      void wipe.offsetWidth;
      wipe.classList.add("is-leaving");
      setTimeout(function () {
        wipe.className = "wipe";
        busy = false;
        $("portfolios-title").focus({ preventScroll: true });
      }, 480);
    }, 440);
  }

  // ---------- Landing decoration ----------

  // A fixed, made-up price walk; purely decorative, not market data.
  function drawTape() {
    var svg = $("tape");
    if (svg.childNodes.length) return;
    var W = 1440, H = 200, n = 48, step = W / n, body = step * 0.46;
    var seed = 7;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var price = 0.2, out = [];
    for (var i = 0; i < n; i++) {
      var open = price;
      var drift = (i / n) * 0.02;
      var close = Math.min(0.9, Math.max(0.1, open + (rand() - 0.45) * 0.16 + drift));
      var hi = Math.max(open, close) + rand() * 0.07;
      var lo = Math.min(open, close) - rand() * 0.07;
      var cls = close >= open ? "up" : "down";
      var x = i * step + step / 2;
      var y = function (v) { return (H - v * H).toFixed(1); };
      var top = Math.max(open, close), bot = Math.min(open, close);
      out.push(
        '<g class="' + cls + '">' +
          '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + y(hi) + '" y2="' + y(lo) + '"></line>' +
          '<rect x="' + (x - body / 2).toFixed(1) + '" y="' + y(top) + '" width="' + body.toFixed(1) +
            '" height="' + Math.max(3, (top - bot) * H).toFixed(1) + '" rx="3"></rect>' +
        "</g>"
      );
      price = close;
    }
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
    svg.innerHTML = out.join("");
  }

  // ---------- Events ----------

  $("enter").addEventListener("click", function () { go({ view: "portfolios" }); });

  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-route]");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    var route = link.getAttribute("data-route");
    go(route === "detail" ? { view: "detail", id: link.getAttribute("data-id") } : { view: route });
  });

  document.addEventListener("keydown", function (e) {
    if (!current) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (current.view === "landing" && e.key === "Enter" && tag !== "button" && tag !== "a") {
      e.preventDefault();
      go({ view: "portfolios" });
    } else if (current.view === "detail" && e.key === "Escape") {
      go({ view: "portfolios" });
    }
  });

  window.addEventListener("hashchange", function () {
    var r = parseHash();
    if (!same(r, current) && !busy) render(r, true);
  });

  renderGrid();
  render(parseHash(), false);
})();
