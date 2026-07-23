/*!
 * Pet Widget — a 2D virtual pet for any website.
 *
 * Drop-in usage (put before </body> on any page):
 *
 *   <script>
 *     window.PetConfig = { name: "Mango", size: 110, controls: true };
 *   </script>
 *   <script src="pet-widget.js"></script>
 *
 * The pet walks along the bottom of the screen, hops, jumps, flies all
 * around the viewport, dances, sleeps, and reacts when clicked/tapped.
 * It never blocks your page: only the pet itself and the little control
 * panel receive pointer events.
 *
 * JavaScript API (available after load):
 *   Pet.feed()  Pet.jump()  Pet.fly()  Pet.dance()  Pet.sleep()
 *   Pet.say("hello!")  Pet.setName("Pip")  Pet.command("dance")
 *
 * Config options (all optional):
 *   name      : string  — pet's name                     (default "Mango")
 *   size      : number  — pet size in px                 (default 110)
 *   controls  : boolean — show the 🐾 control panel      (default true)
 *   zIndex    : number  — stacking order of the overlay  (default 999999)
 *   bottom    : number  — px above viewport bottom where the pet walks (default 0)
 *   storageKey: string  — localStorage key for stats     (default "pet-widget")
 */
(function () {
  "use strict";
  if (window.__petWidgetLoaded) return;
  window.__petWidgetLoaded = true;

  var cfg = Object.assign(
    { name: "Mango", size: 110, controls: true, zIndex: 999999, bottom: 0, storageKey: "pet-widget" },
    window.PetConfig || {}
  );

  /* ============================ styles ============================ */
  var css = `
  .cpet-layer{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:${cfg.zIndex};
    font-family:"Baloo 2","Comic Sans MS",cursive,sans-serif;}
  .cpet-layer *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}

  .cpet{position:absolute;left:0;top:0;width:${cfg.size}px;height:${cfg.size}px;
    will-change:transform;pointer-events:auto;cursor:pointer;}
  .cpet-flip,.cpet-squash{width:100%;height:100%;}
  .cpet-squash{transform-origin:50% 100%;}
  .cpet svg{width:100%;height:100%;overflow:visible;display:block;}

  .cpet-shadow{position:absolute;width:${Math.round(cfg.size * 0.62)}px;height:12px;border-radius:50%;
    background:rgba(40,30,20,.22);will-change:transform,opacity;}

  .cpet-eyes{transform-origin:60px 58px;animation:cpet-blink 4.2s infinite;}
  @keyframes cpet-blink{0%,94%,100%{transform:scaleY(1)}96%,98%{transform:scaleY(.08)}}
  .cpet-eyes-closed,.cpet-mouth-open,.cpet-mouth-sleep{display:none;}
  .cpet-wing{transform-origin:60px 66px;transform:scale(0);transition:transform .25s cubic-bezier(.34,1.56,.64,1);}

  .cpet.st-walk .cpet-squash{animation:cpet-waddle .34s ease-in-out infinite;}
  @keyframes cpet-waddle{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg) translateY(-5px)}}

  .cpet.st-fly .cpet-wing{transform:scale(1);}
  .cpet.st-fly .cpet-wing-l{animation:cpet-flapL .18s ease-in-out infinite;}
  .cpet.st-fly .cpet-wing-r{animation:cpet-flapR .18s ease-in-out infinite;}
  @keyframes cpet-flapL{50%{transform:scale(1) rotate(38deg)}}
  @keyframes cpet-flapR{50%{transform:scale(1) rotate(-38deg)}}

  .cpet.st-sleep .cpet-eyes{display:none}.cpet.st-sleep .cpet-eyes-closed{display:block}
  .cpet.st-sleep .cpet-mouth{display:none}.cpet.st-sleep .cpet-mouth-sleep{display:block}
  .cpet.st-sleep .cpet-squash{animation:cpet-snooze 2.6s ease-in-out infinite;}
  @keyframes cpet-snooze{50%{transform:scale(1.04,.96)}}

  .cpet.st-eat .cpet-mouth{display:none}.cpet.st-eat .cpet-mouth-open{display:block}
  .cpet.st-eat .cpet-squash{animation:cpet-chomp .3s ease-in-out infinite;}
  @keyframes cpet-chomp{50%{transform:scale(1.05,.94)}}

  .cpet.st-dance .cpet-squash{animation:cpet-boogie .5s ease-in-out infinite;}
  @keyframes cpet-boogie{0%,100%{transform:rotate(-10deg)}25%{transform:rotate(0) scale(.94,1.08)}
    50%{transform:rotate(10deg)}75%{transform:rotate(0) scale(1.08,.92)}}

  .cpet.st-happy .cpet-mouth{display:none}.cpet.st-happy .cpet-mouth-open{display:block}
  .cpet.st-happy .cpet-squash{animation:cpet-joy .32s ease-in-out infinite;}
  @keyframes cpet-joy{50%{transform:translateY(-8px) scale(.96,1.06)}}

  .cpet.st-idle .cpet-squash{animation:cpet-breathe 3.2s ease-in-out infinite;}
  @keyframes cpet-breathe{50%{transform:scale(1.025,.975)}}

  .cpet.cpet-landed .cpet-squash{animation:cpet-land .32s cubic-bezier(.34,1.56,.64,1) 1;}
  @keyframes cpet-land{0%{transform:scale(1.28,.72)}100%{transform:scale(1,1)}}

  .cpet-bubble{position:absolute;background:#fff8ee;border:3px solid #4a3728;border-radius:16px;
    padding:5px 12px;font-weight:700;font-size:15px;color:#4a3728;white-space:nowrap;
    transform:translate(-50%,-100%);opacity:0;transition:opacity .2s;
    box-shadow:0 4px 0 rgba(74,55,40,.25);}
  .cpet-bubble.show{opacity:1;}
  .cpet-bubble::after{content:"";position:absolute;left:50%;bottom:-9px;width:12px;height:12px;
    background:#fff8ee;border-right:3px solid #4a3728;border-bottom:3px solid #4a3728;
    transform:translateX(-50%) rotate(45deg);}

  .cpet-particle{position:absolute;font-size:22px;animation:cpet-float 1.1s ease-out forwards;}
  @keyframes cpet-float{0%{transform:translate(-50%,0) scale(.4);opacity:0}
    18%{opacity:1;transform:translate(-50%,-14px) scale(1.1)}
    100%{transform:translate(-50%,-72px) scale(1);opacity:0}}

  .cpet-toggle{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));
    width:52px;height:52px;border-radius:50%;border:3px solid #4a3728;background:#ff7a59;color:#fff;
    font-size:24px;cursor:pointer;pointer-events:auto;box-shadow:0 4px 0 rgba(74,55,40,.3);
    transition:transform .1s;z-index:${cfg.zIndex + 1};line-height:1;}
  .cpet-toggle:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(74,55,40,.3);}

  .cpet-panel{position:fixed;right:14px;bottom:calc(76px + env(safe-area-inset-bottom));
    width:min(240px,calc(100vw - 28px));background:#fff8ee;border:3px solid #4a3728;border-radius:18px;
    padding:12px;pointer-events:auto;box-shadow:0 5px 0 rgba(74,55,40,.25);
    z-index:${cfg.zIndex + 1};display:none;color:#4a3728;}
  .cpet-panel.open{display:block;}
  .cpet-panel-name{font-size:17px;font-weight:800;margin-bottom:6px;display:flex;gap:6px;align-items:center;}
  .cpet-panel-name button{border:none;background:none;font-size:12px;cursor:pointer;opacity:.55;}
  .cpet-stat{display:grid;grid-template-columns:18px 1fr;gap:6px;align-items:center;margin-top:4px;}
  .cpet-stat span{font-size:13px;line-height:1;}
  .cpet-bar{height:10px;border-radius:99px;background:rgba(74,55,40,.12);border:2px solid #4a3728;overflow:hidden;}
  .cpet-bar i{display:block;height:100%;border-radius:99px;transition:width .5s ease;}
  .cpet-btns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;}
  .cpet-btn{font-family:inherit;font-weight:800;font-size:13px;color:#4a3728;background:#fff;
    border:3px solid #4a3728;border-radius:12px;padding:7px 4px;cursor:pointer;
    box-shadow:0 3px 0 rgba(74,55,40,.3);transition:transform .08s,box-shadow .08s;}
  .cpet-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(74,55,40,.3);}
  .cpet-btn.cpet-primary{background:#ff7a59;color:#fff;grid-column:span 2;}
  .cpet-cmd{display:flex;gap:6px;margin-top:8px;}
  .cpet-cmd input{flex:1;min-width:0;font-family:inherit;font-weight:700;font-size:14px;color:#4a3728;
    background:#fff;border:3px solid #4a3728;border-radius:12px;padding:7px 10px;outline:none;}
  .cpet-cmd input::placeholder{color:rgba(74,55,40,.4);font-weight:500;}
  `;
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // load the widget font if the host page doesn't already have it
  if (!document.querySelector('link[href*="Baloo"]')) {
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&display=swap";
    document.head.appendChild(font);
  }

  /* ============================ DOM ============================ */
  var layer = document.createElement("div");
  layer.className = "cpet-layer";
  layer.innerHTML = `
    <div class="cpet-shadow"></div>
    <div class="cpet st-idle" aria-label="virtual pet">
      <div class="cpet-flip"><div class="cpet-squash">
        <svg viewBox="0 0 120 120">
          <defs>
            <radialGradient id="cpetBody" cx="38%" cy="32%" r="80%">
              <stop offset="0%" stop-color="#ffb36b"/>
              <stop offset="55%" stop-color="#ff9d4f"/>
              <stop offset="100%" stop-color="#f5813a"/>
            </radialGradient>
          </defs>
          <g class="cpet-wing cpet-wing-l">
            <path d="M28,62 Q4,44 10,70 Q13,84 30,78 Z" fill="#ffe3c2" stroke="#4a3728" stroke-width="3" stroke-linejoin="round"/>
          </g>
          <g class="cpet-wing cpet-wing-r">
            <path d="M92,62 Q116,44 110,70 Q107,84 90,78 Z" fill="#ffe3c2" stroke="#4a3728" stroke-width="3" stroke-linejoin="round"/>
          </g>
          <g class="cpet-feet">
            <ellipse cx="46" cy="104" rx="10" ry="6" fill="#f5813a" stroke="#4a3728" stroke-width="3"/>
            <ellipse cx="74" cy="104" rx="10" ry="6" fill="#f5813a" stroke="#4a3728" stroke-width="3"/>
          </g>
          <ellipse cx="60" cy="68" rx="40" ry="37" fill="url(#cpetBody)" stroke="#4a3728" stroke-width="3.5"/>
          <g>
            <path d="M60,31 Q59,20 60,14" fill="none" stroke="#4a3728" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M60,16 Q46,4 44,16 Q44,26 60,16 Z" fill="#7ed6a5" stroke="#4a3728" stroke-width="3" stroke-linejoin="round"/>
            <path d="M60,16 Q74,4 76,16 Q76,26 60,16 Z" fill="#96e0b4" stroke="#4a3728" stroke-width="3" stroke-linejoin="round"/>
          </g>
          <ellipse cx="60" cy="80" rx="21" ry="15" fill="#ffe3c2" opacity=".85"/>
          <ellipse cx="34" cy="70" rx="6.5" ry="4.5" fill="#ff8f8f" opacity=".8"/>
          <ellipse cx="86" cy="70" rx="6.5" ry="4.5" fill="#ff8f8f" opacity=".8"/>
          <g class="cpet-eyes">
            <circle cx="45" cy="58" r="8.5" fill="#fff" stroke="#4a3728" stroke-width="3"/>
            <circle cx="75" cy="58" r="8.5" fill="#fff" stroke="#4a3728" stroke-width="3"/>
            <circle cx="47" cy="59" r="3.6" fill="#4a3728"/>
            <circle cx="77" cy="59" r="3.6" fill="#4a3728"/>
            <circle cx="48.4" cy="57.4" r="1.3" fill="#fff"/>
            <circle cx="78.4" cy="57.4" r="1.3" fill="#fff"/>
          </g>
          <g class="cpet-eyes-closed">
            <path d="M38,58 Q45,64 52,58" fill="none" stroke="#4a3728" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M68,58 Q75,64 82,58" fill="none" stroke="#4a3728" stroke-width="3.5" stroke-linecap="round"/>
          </g>
          <path class="cpet-mouth" d="M53,74 Q60,80 67,74" fill="none" stroke="#4a3728" stroke-width="3.5" stroke-linecap="round"/>
          <path class="cpet-mouth-open" d="M51,72 Q60,86 69,72 Q60,76 51,72 Z" fill="#4a3728"/>
          <ellipse class="cpet-mouth-sleep" cx="60" cy="76" rx="4" ry="5" fill="#4a3728"/>
        </svg>
      </div></div>
    </div>
    <div class="cpet-bubble"></div>
  `;

  function boot() {
    document.body.appendChild(layer);

    var petEl  = layer.querySelector(".cpet");
    var flipEl = layer.querySelector(".cpet-flip");
    var shadow = layer.querySelector(".cpet-shadow");
    var bubble = layer.querySelector(".cpet-bubble");

    /* ---------- controls panel (optional) ---------- */
    var barsEls = null, nameSpan = null;
    if (cfg.controls) {
      var toggle = document.createElement("button");
      toggle.className = "cpet-toggle";
      toggle.textContent = "🐾";
      toggle.setAttribute("aria-label", "pet controls");

      var panel = document.createElement("div");
      panel.className = "cpet-panel";
      panel.innerHTML = `
        <div class="cpet-panel-name"><span class="cpet-name-text"></span><button class="cpet-rename" title="rename">✏️</button></div>
        <div class="cpet-stat"><span>🍎</span><div class="cpet-bar"><i data-bar="food" style="background:#ff9d5c"></i></div></div>
        <div class="cpet-stat"><span>💖</span><div class="cpet-bar"><i data-bar="fun" style="background:#ff7ab8"></i></div></div>
        <div class="cpet-stat"><span>⚡</span><div class="cpet-bar"><i data-bar="energy" style="background:#6cc9ff"></i></div></div>
        <div class="cpet-btns">
          <button class="cpet-btn cpet-primary" data-act="feed">🍎 Feed</button>
          <button class="cpet-btn" data-act="jump">🦘 Jump</button>
          <button class="cpet-btn" data-act="fly">🪽 Fly</button>
          <button class="cpet-btn" data-act="dance">🎶 Dance</button>
          <button class="cpet-btn" data-act="sleep">💤 Sleep</button>
        </div>
        <div class="cpet-cmd">
          <input type="text" autocomplete="off" placeholder='Try: "jump", "fly", "name Pip"'>
          <button class="cpet-btn">Go!</button>
        </div>
      `;
      document.body.appendChild(toggle);
      document.body.appendChild(panel);

      toggle.addEventListener("click", function () { panel.classList.toggle("open"); });

      barsEls = {
        food:   panel.querySelector('[data-bar="food"]'),
        fun:    panel.querySelector('[data-bar="fun"]'),
        energy: panel.querySelector('[data-bar="energy"]'),
      };
      nameSpan = panel.querySelector(".cpet-name-text");

      panel.querySelector(".cpet-btns").addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]");
        if (!b) return;
        ({ feed: doFeed, jump: doJump, fly: doFly, dance: doDance, sleep: doSleep })[b.dataset.act]();
      });
      panel.querySelector(".cpet-rename").addEventListener("click", function () {
        var n = prompt("Name your pet:", petName);
        if (n && n.trim()) setName(n.trim());
      });
      var cmdInput = panel.querySelector(".cpet-cmd input");
      var cmdGo    = panel.querySelector(".cpet-cmd .cpet-btn");
      cmdGo.addEventListener("click", function () { runCommand(cmdInput.value); cmdInput.value = ""; });
      cmdInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { runCommand(cmdInput.value); cmdInput.value = ""; }
      });
    }

    /* ---------- persisted stats ---------- */
    var save = {};
    try { save = JSON.parse(localStorage.getItem(cfg.storageKey) || "{}"); } catch (e) {}
    var stats = {
      food:   save.food   != null ? save.food   : 70,
      fun:    save.fun    != null ? save.fun    : 70,
      energy: save.energy != null ? save.energy : 80,
    };
    var petName = save.name || cfg.name;
    if (nameSpan) nameSpan.textContent = petName;

    function persist() {
      try {
        localStorage.setItem(cfg.storageKey, JSON.stringify({
          food: stats.food, fun: stats.fun, energy: stats.energy, name: petName,
        }));
      } catch (e) {}
    }
    setInterval(persist, 4000);

    /* ---------- geometry & physics ---------- */
    var W = innerWidth, H = innerHeight;
    var PET = cfg.size;
    var groundY = function () { return H - cfg.bottom; };   // where feet rest
    var topSafe = 40;
    addEventListener("resize", function () {
      W = innerWidth; H = innerHeight;
      p.x = clamp(p.x, PET / 2, W - PET / 2);
    });

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    var p = {
      x: W / 2, alt: 0, vx: 0, vy: 0, dir: 1,
      state: "idle", timer: rand(1.5, 3),
      tx: W / 2, ty: 0, flyTime: 0, hopPhase: false,
    };
    var WALK_SPEED = 130, FLY_SPEED = 3.0, GRAVITY = 2600;

    function setState(s) {
      if (p.state === s) return;
      petEl.classList.remove("st-" + p.state);
      p.state = s;
      petEl.classList.add("st-" + s);
    }

    /* ---------- bubble & particles ---------- */
    var bubbleTimer = null;
    function say(text, ms) {
      bubble.textContent = text;
      bubble.classList.add("show");
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, ms || 1600);
    }
    function particle(emoji, x, y) {
      var el = document.createElement("div");
      el.className = "cpet-particle";
      el.textContent = emoji;
      el.style.left = x + "px";
      el.style.top = y + "px";
      layer.appendChild(el);
      el.addEventListener("animationend", function () { el.remove(); });
    }
    function burst(emoji, n) {
      for (var i = 0; i < (n || 4); i++) {
        (function (i) {
          setTimeout(function () {
            particle(emoji, p.x + rand(-30, 30), screenTop() + rand(-10, 20));
          }, i * 120);
        })(i);
      }
    }
    function screenTop() { return groundY() - p.alt - PET * 0.9; }

    /* ---------- actions ---------- */
    function doFeed() {
      if (p.state === "sleep") wakeUp();
      setState("eat"); p.timer = 1.6;
      stats.food = clamp(stats.food + 26, 0, 100);
      stats.fun = clamp(stats.fun + 5, 0, 100);
      burst("🍎", 3);
      say(pick(["Yum!!", "Nom nom nom", "So tasty!", "More please!"]));
    }
    function doJump() {
      if (p.state === "sleep") wakeUp();
      if (p.alt > 2) return;
      setState("jump");
      p.vy = 950; p.vx = rand(-60, 60);
      stats.energy = clamp(stats.energy - 2, 0, 100);
      say(pick(["Wheee!", "Boing!", "So high!"]), 1000);
    }
    function doFly() {
      if (p.state === "sleep") wakeUp();
      setState("fly");
      p.flyTime = rand(5, 8);
      newFlyTarget();
      stats.energy = clamp(stats.energy - 4, 0, 100);
      stats.fun = clamp(stats.fun + 8, 0, 100);
      say(pick(["To the sky!", "I can fly!!", "Zoom zoom!"]));
    }
    function doDance() {
      if (p.state === "sleep") wakeUp();
      setState("dance"); p.timer = 2.6;
      stats.fun = clamp(stats.fun + 14, 0, 100);
      stats.energy = clamp(stats.energy - 5, 0, 100);
      burst("🎵", 4);
      say(pick(["Party time!", "Dance dance!", "Feel the beat!"]));
    }
    function doSleep() {
      if (p.state === "sleep") { wakeUp(); return; }
      p.alt = 0; p.vy = 0;
      setState("sleep"); p.timer = 9999;
      say("Zzz…", 1400);
    }
    function wakeUp() {
      setState("idle"); p.timer = rand(1, 2);
      say(pick(["*yawn* Good morning!", "I'm awake!", "Hi again!"]));
    }
    function doPet() {
      if (p.state === "sleep") { wakeUp(); return; }
      setState("happy"); p.timer = 1.4;
      stats.fun = clamp(stats.fun + 10, 0, 100);
      burst("💛", 4);
      say(pick(["Hehe, that tickles!", "I love you!", "Best friend ever!", "More pets!"]));
    }
    function setName(n) {
      petName = String(n).slice(0, 16);
      if (nameSpan) nameSpan.textContent = petName;
      persist();
      say("I'm " + petName + "!");
    }
    function newFlyTarget() {
      p.tx = rand(PET / 2 + 10, W - PET / 2 - 10);
      p.ty = rand(topSafe + PET, groundY() - PET - 40);
    }

    /* ---------- autonomous brain ---------- */
    function chooseNext() {
      if (stats.energy < 12) { doSleep(); p.timer = rand(6, 9); return; }
      var next = pick(["walk", "walk", "walk", "idle", "hop", "jump", "fly", "dance", "idle"]);
      if (next === "walk" || next === "hop") {
        p.tx = rand(PET / 2 + 10, W - PET / 2 - 10);
        p.hopPhase = next === "hop";
        setState("walk"); p.timer = 9999;
      } else if (next === "jump") doJump();
      else if (next === "fly") doFly();
      else if (next === "dance") doDance();
      else {
        setState("idle"); p.timer = rand(1.5, 3.5);
        if (Math.random() < 0.2) {
          say(pick(["La la la ♪", "What a nice day!", "Hi! 👋", "*happy wiggle*"]), 1500);
        }
      }
    }

    /* ---------- main loop ---------- */
    var last = performance.now();
    function loop(now) {
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      stats.food = clamp(stats.food - dt * (p.state === "sleep" ? 0.10 : 0.28), 0, 100);
      stats.fun = clamp(stats.fun - dt * 0.22, 0, 100);
      stats.energy = clamp(stats.energy + dt * (p.state === "sleep" ? 3.2 : -0.20), 0, 100);

      switch (p.state) {
        case "idle": case "eat": case "dance": case "happy": case "sleep":
          p.timer -= dt;
          if (p.state === "sleep" && stats.energy > 96) wakeUp();
          else if (p.timer <= 0) chooseNext();
          break;
        case "walk": {
          var d = p.tx - p.x;
          p.dir = d < 0 ? -1 : 1;
          p.x += p.dir * WALK_SPEED * dt;
          if (p.hopPhase && p.alt <= 0) p.vy = 330;
          if (p.hopPhase) { p.vy -= GRAVITY * dt; p.alt = Math.max(0, p.alt + p.vy * dt); }
          if (Math.abs(d) < 12) {
            p.x = p.tx; p.hopPhase = false; p.alt = 0; p.vy = 0;
            setState("idle"); p.timer = rand(1, 2.5);
          }
          break;
        }
        case "jump":
          p.vy -= GRAVITY * dt;
          p.alt += p.vy * dt;
          p.x = clamp(p.x + p.vx * dt, PET / 2, W - PET / 2);
          if (p.alt <= 0) { land(); }
          break;
        case "fly": {
          p.flyTime -= dt;
          var sy = groundY() - p.alt;
          var dx = p.tx - p.x, dy = p.ty - sy;
          p.dir = dx < -6 ? -1 : dx > 6 ? 1 : p.dir;
          p.x += dx * Math.min(1, FLY_SPEED * dt);
          p.alt -= dy * Math.min(1, FLY_SPEED * dt);
          if (Math.hypot(dx, dy) < 40) newFlyTarget();
          if (p.flyTime <= 0) {
            p.ty = groundY();
            if (p.alt < 14) land();
          }
          break;
        }
      }

      render(now);
      requestAnimationFrame(loop);
    }
    function land() {
      p.alt = 0; p.vy = 0;
      petEl.classList.remove("cpet-landed"); void petEl.offsetWidth;
      petEl.classList.add("cpet-landed");
      setState("idle"); p.timer = rand(1, 2.5);
    }

    function render(now) {
      var sx = p.x - PET / 2;
      var sy = groundY() - p.alt - PET + 10;
      petEl.style.transform = "translate3d(" + sx + "px," + sy + "px,0)";
      flipEl.style.transform = "scaleX(" + p.dir + ")";

      var k = clamp(1 - p.alt / 420, 0.25, 1);
      shadow.style.transform = "translate3d(" + (p.x - (PET * 0.62) / 2) + "px," + (groundY() - 8) + "px,0) scaleX(" + k + ")";
      shadow.style.opacity = 0.22 * k + 0.05;

      bubble.style.left = clamp(p.x, 90, W - 90) + "px";
      bubble.style.top = (sy - 6) + "px";

      if (barsEls) {
        barsEls.food.style.width = stats.food + "%";
        barsEls.fun.style.width = stats.fun + "%";
        barsEls.energy.style.width = stats.energy + "%";
      }
      if (p.state === "sleep" && Math.random() < 0.012) {
        particle("💤", p.x + 34, screenTop());
      }
      if (stats.food < 18 && Math.random() < 0.004) {
        say(pick(["I'm hungry…", "Feed me? 🥺", "My tummy is rumbling!"]));
      }
    }

    /* ---------- interaction ---------- */
    petEl.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      doPet();
    });

    /* ---------- commands & public API ---------- */
    function runCommand(raw) {
      var t = String(raw || "").trim().toLowerCase();
      if (!t) return;
      if (t.indexOf("name ") === 0) { setName(String(raw).trim().slice(5)); return; }
      var table = {
        feed: doFeed, eat: doFeed, food: doFeed, apple: doFeed,
        jump: doJump, hop: doJump, boing: doJump,
        fly: doFly, soar: doFly, wings: doFly,
        dance: doDance, party: doDance, boogie: doDance,
        sleep: doSleep, nap: doSleep, rest: doSleep,
        wake: wakeUp, up: wakeUp,
        pet: doPet, love: doPet, hug: doPet,
        come: function () { p.tx = W / 2; p.alt = 0; setState("walk"); p.timer = 9999; say("Coming!"); },
        hi: function () { say("Hi, I'm " + petName + "! 👋"); },
        hello: function () { say("Hi, I'm " + petName + "! 👋"); },
      };
      var fn = table[t];
      if (fn) fn();
      else say(pick(["Hmm? Try “jump” or “fly”!", "I don't know that trick yet!", "Try “dance”!"]), 2200);
    }

    window.Pet = {
      feed: doFeed, jump: doJump, fly: doFly, dance: doDance, sleep: doSleep,
      pet: doPet, wake: wakeUp,
      say: function (t, ms) { say(String(t), ms); },
      setName: setName,
      command: runCommand,
      stats: function () { return { food: stats.food, fun: stats.fun, energy: stats.energy, name: petName }; },
    };

    say("Hi! I'm " + petName + "! 🧡", 2400);
    requestAnimationFrame(loop);
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
