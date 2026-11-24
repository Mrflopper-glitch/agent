// Browser stand-in for the T-Watch S3 firmware. Same protocol, same screens:
// home (sessions + new), chat (streamed events), approval overlay, screen preview, game.
"use strict";
const $ = (id) => document.getElementById(id);
const view = $("view");
const state = {
  ws: null, hello: null, sessions: [], current: null, events: [], states: {},
  approvals: [], screen: "home", transcript: null, recording: null, game: null,
};

function log(line) {
  const el = $("log");
  el.textContent = (line + "\n" + el.textContent).slice(0, 4000);
}

function send(type, fields = {}) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  state.ws.send(JSON.stringify({ type, ...fields }));
}

function connect() {
  const token = $("token").value.trim();
  if (!token) return;
  sessionStorage.setItem("crd_token", token);
  if (state.ws) state.ws.close();
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  state.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token, fw: "emulator" }));
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = (e) => { setDot("off"); log(`closed ${e.code}`); if (state.ws === ws) state.ws = null; };
}

function onMessage(m) {
  if (m.type !== "event") log(`< ${m.type}`);
  switch (m.type) {
    case "hello": state.hello = m; setDot("on"); break;
    case "sessions": state.sessions = m.items; break;
    case "history":
      state.current = m.session; state.events = m.events; state.states[m.session] = m.state;
      state.screen = "chat"; break;
    case "event": if (m.session === state.current) state.events.push(m); break;
    case "state":
      state.states[m.session] = m.state;
      const s = state.sessions.find((x) => x.id === m.session);
      if (s) s.state = m.state;
      break;
    case "approval": state.approvals.push({ ...m, deadline: Date.now() + (m.ttl ?? 60) * 1000 }); buzz(); break;
    case "approval_done": state.approvals = state.approvals.filter((a) => a.request !== m.request); break;
    case "transcript":
      state.transcript = m.text;
      if (state.screen === "home") state.screen = "compose";
      break;
    case "screen": state.shot = m; state.screen = "screen"; break;
    case "error": log(`! ${m.code}: ${m.msg}`); toast(m.msg); break;
  }
  render();
}

function setDot(kind) { $("status").className = "dot " + (kind === "on" ? "" : kind); }
function buzz() { if (navigator.vibrate) navigator.vibrate(120); }
function toast(text) {
  const el = document.createElement("div");
  el.className = "ev error"; el.textContent = text; view.prepend(el);
}

function el(tag, cls, text, onclick) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (onclick) node.onclick = onclick;
  return node;
}

function render() {
  renderApproval();
  if (state.screen === "game") return;
  view.replaceChildren();
  const busy = state.current && ["running", "waiting"].includes(state.states[state.current]);
  setDot(!state.ws ? "off" : busy ? "busy" : "on");
  if (state.screen === "chat") return renderChat();
  if (state.screen === "screen") return renderShot();
  if (state.screen === "compose") return renderCompose();
  renderHome();
}

function renderHome() {
  $("title").textContent = state.hello ? state.hello.device : "claude";
  if (!state.hello) { view.append(el("div", "ev status", "Not connected. Enter a device token.")); return; }
  const chips = el("div", "chips");
  for (const w of state.hello.workspaces) {
    chips.append(el("button", "chip", `+ ${w.name}`, () => { state.pendingWorkspace = w.id; state.screen = "compose"; renderCompose(); }));
  }
  if (state.hello.features.screen) chips.append(el("button", "chip", "Screen", () => send("screen", { w: 240, h: 240 })));
  chips.append(el("button", "chip", "Game", startGame));
  view.append(chips);
  for (const s of state.sessions) {
    const item = el("div", "item", s.title, () => send("open", { session: s.id }));
    item.append(el("small", "", `${s.workspace} \u00b7 ${s.state}`));
    view.append(item);
  }
}

function renderCompose() {
  view.replaceChildren();
  $("title").textContent = "New session";
  view.append(el("div", "ev status", state.transcript ? "" : "Hold the side button and speak, or type in the panel."));
  renderTranscript();
  const chips = el("div", "chips");
  chips.append(el("button", "chip", "Back", goHome));
  view.append(chips);
}

function renderChat() {
  const s = state.sessions.find((x) => x.id === state.current);
  $("title").textContent = s ? s.title : "session";
  for (const e of state.events) view.append(el("div", `ev ${e.kind}`, e.kind === "tool" ? `\u2192 ${e.text}` : e.text));
  renderTranscript();
  const chips = el("div", "chips");
  chips.append(el("button", "chip", "Home", goHome));
  if (["running", "waiting"].includes(state.states[state.current])) chips.append(el("button", "chip", "Stop", () => send("stop", { session: state.current })));
  view.append(chips);
  view.scrollTop = view.scrollHeight;
}

function renderTranscript() {
  if (!state.transcript) return;
  view.append(el("div", "ev user", `\u201c${state.transcript}\u201d`));
  const chips = el("div", "chips");
  chips.append(el("button", "chip", "Send", () => submit(state.transcript)));
  chips.append(el("button", "chip", "Discard", () => { state.transcript = null; render(); }));
  view.append(chips);
}

function renderShot() {
  $("title").textContent = "Screen";
  const img = el("img", "shot");
  img.src = `data:image/jpeg;base64,${state.shot.jpeg}`;
  view.append(img);
  const chips = el("div", "chips");
  chips.append(el("button", "chip", "Refresh", () => send("screen", { w: 240, h: 240 })));
  chips.append(el("button", "chip", "Home", goHome));
  view.append(chips);
}

function renderApproval() {
  const a = state.approvals[0];
  $("approval").hidden = !a;
  if (!a) return;
  $("ap-tool").textContent = a.tool;
  $("ap-summary").textContent = a.summary;
  $("ap-timer").textContent = `expires in ${Math.max(0, Math.ceil((a.deadline - Date.now()) / 1000))}s`;
}
$("ap-allow").onclick = () => state.approvals[0] && send("approve", { request: state.approvals[0].request, allow: true });
$("ap-deny").onclick = () => state.approvals[0] && send("approve", { request: state.approvals[0].request, allow: false });
setInterval(() => state.approvals.length && renderApproval(), 1000);

function goHome() { state.screen = "home"; state.current = null; stopGame(); send("list"); render(); }

function submit(text) {
  text = (text || "").trim();
  if (!text) return;
  state.transcript = null;
  if (state.screen === "chat" && state.current) send("prompt", { session: state.current, text });
  else send("new", { workspace: state.pendingWorkspace || state.hello.workspaces[0].id, text });
  render();
}

// --- push to talk: 16 kHz mono PCM16, streamed in binary frames ---
async function startTalk() {
  if (state.recording || !state.ws) return;
  $("side").classList.add("on");
  const rec = { chunks: 0 };
  state.recording = rec;
  send("audio_start", { rate: 16000 });
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    const ctx = new AudioContext({ sampleRate: 16000 });
    const src = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => {
      const f = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(f.length);
      for (let i = 0; i < f.length; i++) pcm[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff;
      if (state.ws) state.ws.send(pcm.buffer);
      rec.chunks++;
    };
    src.connect(node); node.connect(ctx.destination);
    rec.stop = () => { node.disconnect(); src.disconnect(); stream.getTracks().forEach((t) => t.stop()); ctx.close(); };
  } catch (err) {
    log(`mic unavailable (${err.name}); sending silence`);
    rec.stop = () => { if (state.ws) state.ws.send(new Int16Array(16000).buffer); };
  }
}
function endTalk() {
  const rec = state.recording;
  if (!rec) return;
  state.recording = null;
  $("side").classList.remove("on");
  if (rec.stop) rec.stop();
  send("audio_end");
}
const side = $("side");
side.addEventListener("pointerdown", startTalk);
side.addEventListener("pointerup", endTalk);
side.addEventListener("pointerleave", endTalk);
document.addEventListener("keydown", (e) => { if (e.code === "Space" && e.target === document.body) { e.preventDefault(); startTalk(); } });
document.addEventListener("keyup", (e) => { if (e.code === "Space" && e.target === document.body) endTalk(); });

// --- optional local game: dodge the falling blocks, tap left/right half ---
function startGame() {
  state.screen = "game";
  $("title").textContent = "Dodge";
  const canvas = el("canvas");
  canvas.width = 420; canvas.height = 400;
  view.replaceChildren(canvas, el("div", "chips"));
  view.lastChild.append(el("button", "chip", "Home", goHome));
  const g = { x: 210, blocks: [], score: 0, over: false, t: 0, canvas };
  canvas.onpointerdown = (e) => {
    if (g.over) { Object.assign(g, { blocks: [], score: 0, over: false }); return; }
    const r = canvas.getBoundingClientRect();
    g.x += (e.clientX - r.left) < r.width / 2 ? -60 : 60;
    g.x = Math.max(30, Math.min(390, g.x));
  };
  state.game = g;
  g.timer = setInterval(() => stepGame(g), 33);
}
function stepGame(g) {
  const c = g.canvas.getContext("2d");
  if (!g.over) {
    g.t++;
    if (g.t % Math.max(8, 24 - Math.floor(g.score / 5)) === 0) g.blocks.push({ x: 20 + Math.random() * 380, y: -20 });
    for (const b of g.blocks) b.y += 6 + g.score / 10;
    const before = g.blocks.length;
    g.blocks = g.blocks.filter((b) => b.y < 420);
    g.score += before - g.blocks.length;
    if (g.blocks.some((b) => Math.abs(b.x - g.x) < 34 && Math.abs(b.y - 360) < 26)) { g.over = true; buzz(); }
  }
  c.fillStyle = "#0b0d10"; c.fillRect(0, 0, 420, 400);
  c.fillStyle = "#d97757"; for (const b of g.blocks) c.fillRect(b.x - 16, b.y - 16, 32, 32);
  c.fillStyle = "#e8e6e3"; c.fillRect(g.x - 20, 350, 40, 20);
  c.font = "24px system-ui"; c.fillText(g.over ? `Game over: ${g.score}  (tap)` : `${g.score}`, 12, 32);
}
function stopGame() { if (state.game) { clearInterval(state.game.timer); state.game = null; } }

$("connect").onclick = connect;
$("type").onsubmit = (e) => { e.preventDefault(); submit($("text").value); $("text").value = ""; };
$("token").value = sessionStorage.getItem("crd_token") || "";
render();
