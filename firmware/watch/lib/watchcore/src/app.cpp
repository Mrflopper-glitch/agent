#include "app.h"

#include <ArduinoJson.h>

#include <algorithm>
#include <cstdlib>

#include "protocol.h"
#include "wrap.h"

namespace watch {
namespace {

constexpr int kPad = 8;
constexpr int kRow = 32;
constexpr int kDragSlop = 8;

uint16_t eventColor(const std::string& kind) {
  if (kind == "user") return color::kAccent;
  if (kind == "tool" || kind == "status") return color::kDim;
  if (kind == "error") return color::kBad;
  if (kind == "result") return color::kOk;
  return color::kFg;
}

std::string str(JsonVariantConst v) {
  const char* s = v.as<const char*>();
  return s ? s : "";
}

}  // namespace

App::App(Link& link, Store& store, Haptics* haptics, std::string firmware)
    : link_(link), store_(store), haptics_(haptics), firmware_(std::move(firmware)) {}

bool App::busy() const {
  for (const auto& s : sessions_) {
    if (s.id == current_) return s.state == "running" || s.state == "waiting";
  }
  return false;
}

void App::setScreen(Screen s) {
  if (screen_ != s) {
    screen_ = s;
    scroll_ = 0;
    followTail_ = true;
  }
  dirty_ = true;
}

void App::onLinkUp() {
  authed_ = false;
  error_.clear();
  std::string token = store_.get("token");
  if (token.empty()) {
    error_ = "no device token";
    dirty_ = true;
    return;
  }
  link_.sendText(proto::auth(token, firmware_));
}

void App::onLinkDown() {
  authed_ = false;
  if (listening_) {
    listening_ = false;
    audioBuf_.clear();
  }
  approvals_.clear();
  if (screen_ != Screen::Game) setScreen(Screen::Offline);
  dirty_ = true;
}

void App::onText(const char* data, size_t len) {
  JsonDocument doc;
  if (deserializeJson(doc, data, len)) return;
  const char* type = doc["type"];
  if (!type) return;
  handle(type, &doc);
  dirty_ = true;
}

void App::handle(const char* type, void* raw) {
  JsonDocument& doc = *static_cast<JsonDocument*>(raw);
  std::string t = type;
  if (t == "hello") {
    authed_ = true;
    device_ = str(doc["device"]);
    workspaces_.clear();
    for (JsonVariantConst w : doc["workspaces"].as<JsonArrayConst>()) {
      workspaces_.push_back({str(w["id"]), str(w["name"]), str(w["kind"])});
    }
    if (screen_ == Screen::Offline) setScreen(Screen::Home);
  } else if (t == "sessions") {
    sessions_.clear();
    for (JsonVariantConst s : doc["items"].as<JsonArrayConst>()) {
      sessions_.push_back({str(s["id"]), str(s["title"]), str(s["state"]), str(s["workspace"])});
    }
  } else if (t == "history") {
    current_ = str(doc["session"]);
    events_.clear();
    for (JsonVariantConst e : doc["events"].as<JsonArrayConst>()) {
      events_.push_back({str(e["kind"]), str(e["text"])});
      if (events_.size() > kMaxEvents) events_.pop_front();
    }
    setScreen(Screen::Chat);
    followTail_ = true;
  } else if (t == "event") {
    if (str(doc["session"]) != current_) return;
    events_.push_back({str(doc["kind"]), str(doc["text"])});
    if (events_.size() > kMaxEvents) events_.pop_front();
  } else if (t == "state") {
    std::string id = str(doc["session"]);
    for (auto& s : sessions_) {
      if (s.id == id) s.state = str(doc["state"]);
    }
  } else if (t == "approval") {
    ApprovalCard a{str(doc["request"]), str(doc["session"]), str(doc["tool"]), str(doc["summary"]),
                   nowMs_ + static_cast<unsigned long>(doc["ttl"] | 60) * 1000UL};
    for (const auto& existing : approvals_) {
      if (existing.request == a.request) return;
    }
    approvals_.push_back(a);
    if (haptics_) haptics_->buzz(80);
  } else if (t == "approval_done") {
    std::string id = str(doc["request"]);
    approvals_.erase(std::remove_if(approvals_.begin(), approvals_.end(),
                                    [&](const ApprovalCard& a) { return a.request == id; }),
                     approvals_.end());
  } else if (t == "transcript") {
    transcript_ = str(doc["text"]);
    if (screen_ != Screen::Game) setScreen(Screen::Compose);
  } else if (t == "error") {
    error_ = str(doc["msg"]);
    std::string code = str(doc["code"]);
    if (code == "unauthorized" || code == "rate_limited") authed_ = false;
  }
}

void App::goHome() {
  current_.clear();
  events_.clear();
  transcript_.clear();
  setScreen(authed_ ? Screen::Home : Screen::Offline);
  if (authed_) link_.sendText(proto::list());
}

void App::openGame() {
  game_.reset();
  setScreen(Screen::Game);
}

void App::submit(const std::string& text) {
  if (text.empty() || !authed_) return;
  if (!current_.empty()) {
    link_.sendText(proto::prompt(current_, text));
    setScreen(Screen::Chat);
  } else {
    std::string ws = pendingWorkspace_.empty() && !workspaces_.empty() ? workspaces_[0].id : pendingWorkspace_;
    if (ws.empty()) return;
    link_.sendText(proto::newSession(ws, text));
    setScreen(Screen::Home);
  }
  transcript_.clear();
}

// --- input ----------------------------------------------------------------

void App::touchDown(int x, int y, unsigned long nowMs) {
  (void)nowMs;
  touching_ = true;
  dragging_ = false;
  touchX_ = x;
  touchY_ = y;
  lastY_ = y;
  pressed_ = hit(x, y);
  if (pressed_ == kTalk) pttDown();
}

void App::touchMove(int x, int y) {
  if (!touching_ || pressed_ == kTalk) return;
  if (!dragging_ && std::abs(y - touchY_) > kDragSlop) dragging_ = true;
  (void)x;
  if (!dragging_) return;
  int dy = y - lastY_;
  lastY_ = y;
  if (screen_ == Screen::Chat || screen_ == Screen::Compose) {
    scroll_ = std::max(0, std::min(maxScroll_, scroll_ + dy));  // drag down reveals older text
    followTail_ = scroll_ == 0;
  } else if (screen_ == Screen::Home) {
    scroll_ = std::max(0, std::min(maxScroll_, scroll_ - dy));
  }
  dirty_ = true;
}

void App::touchUp(int x, int y, unsigned long nowMs) {
  (void)nowMs;
  if (!touching_) return;
  touching_ = false;
  if (pressed_ == kTalk) {
    pttUp();
  } else if (!dragging_) {
    tap(x, y);
  }
  pressed_ = kNone;
}

void App::tap(int x, int y) {
  if (screen_ == Screen::Game && approvals_.empty()) {
    if (y < 240 - kBottomBar) {
      game_.tap(x, 240);
      dirty_ = true;
      return;
    }
  }
  int id = hit(x, y);
  if (id == kNone) return;
  if (!approvals_.empty()) {
    if (id == kAllow || id == kDeny) {
      link_.sendText(proto::approve(approvals_.front().request, id == kAllow));
      approvals_.pop_front();  // the relay confirms with approval_done; don't wait to clear the card
      dirty_ = true;
    }
    return;
  }
  switch (id) {
    case kHome: goHome(); break;
    case kStop: if (!current_.empty()) link_.sendText(proto::stop(current_)); break;
    case kSend: submit(transcript_); break;
    case kDiscard:
      transcript_.clear();
      setScreen(current_.empty() ? Screen::Home : Screen::Chat);
      break;
    case kGame: openGame(); break;
    default:
      if (id >= kSession0 && id - kSession0 < static_cast<int>(sessions_.size())) {
        link_.sendText(proto::open(sessions_[id - kSession0].id));
      } else if (id >= kNew0 && id - kNew0 < static_cast<int>(workspaces_.size())) {
        pendingWorkspace_ = workspaces_[id - kNew0].id;
        dirty_ = true;
      }
  }
}

void App::pttDown() {
  if (listening_ || !authed_ || !approvals_.empty()) return;
  if (!link_.sendText(proto::audioStart())) return;
  listening_ = true;
  audioSamples_ = 0;
  audioBuf_.clear();
  audioBuf_.reserve(kAudioChunkSamples);
  dirty_ = true;
}

void App::pttUp() {
  if (!listening_) return;
  flushAudio();
  listening_ = false;
  link_.sendText(proto::audioEnd());
  dirty_ = true;
}

void App::flushAudio() {
  if (audioBuf_.empty()) return;
  link_.sendBinary(reinterpret_cast<const uint8_t*>(audioBuf_.data()), audioBuf_.size() * sizeof(int16_t));
  audioBuf_.clear();
}

void App::audio(const int16_t* samples, size_t n) {
  if (!listening_) return;
  for (size_t i = 0; i < n; i++) {
    audioBuf_.push_back(samples[i]);
    if (audioBuf_.size() >= kAudioChunkSamples) flushAudio();
  }
  audioSamples_ += n;
  if (audioSamples_ >= kMaxAudioSamples) pttUp();
}

void App::tick(unsigned long nowMs) {
  unsigned long prev = nowMs_;
  nowMs_ = nowMs;
  size_t before = approvals_.size();
  approvals_.erase(std::remove_if(approvals_.begin(), approvals_.end(),
                                  [&](const ApprovalCard& a) { return nowMs >= a.deadlineMs; }),
                   approvals_.end());
  if (approvals_.size() != before) dirty_ = true;
  if (!approvals_.empty() && nowMs / 1000 != prev / 1000) dirty_ = true;  // countdown
  if (screen_ == Screen::Game && approvals_.empty() && nowMs - lastGameStep_ >= 33) {
    lastGameStep_ = nowMs;
    game_.step();
    dirty_ = true;
  }
}

// --- drawing ----------------------------------------------------------------

void App::addButton(int x, int y, int w, int h, int id) { buttons_.push_back({x, y, w, h, id}); }

int App::hit(int x, int y) const {
  for (auto it = buttons_.rbegin(); it != buttons_.rend(); ++it) {
    if (x >= it->x && x < it->x + it->w && y >= it->y && y < it->y + it->h) return it->id;
  }
  return kNone;
}

void App::drawButton(Canvas& c, int x, int y, int w, int h, const std::string& label, uint16_t bg, uint16_t fg) {
  c.fillRoundRect(x, y, w, h, h / 2, bg);
  std::string l = ellipsize(c, label, w - 8);
  c.text(x + (w - c.textWidth(l)) / 2, y + (h - c.lineHeight()) / 2, l, fg);
}

void App::renderTop(Canvas& c, const std::string& title) {
  c.fillRect(0, 0, c.width(), kTopBar, color::kBg);
  int dotX = c.width() - kPad - 10;
  c.text(kPad, (kTopBar - c.lineHeight(2)) / 2, ellipsize(c, title, dotX - 2 * kPad, 2), color::kFg, 2);
  uint16_t dot = !link_.connected() || !authed_ ? color::kBad : busy() ? color::kAccent : color::kOk;
  c.fillRoundRect(dotX, kTopBar / 2 - 5, 10, 10, 5, dot);
}

int App::renderScrolled(Canvas& c, const std::vector<std::pair<std::string, uint16_t>>& lines) {
  int top = kTopBar, bottom = c.height() - kBottomBar, lh = c.lineHeight() + 2;
  int total = static_cast<int>(lines.size()) * lh;
  maxScroll_ = std::max(0, total - (bottom - top));
  if (followTail_) scroll_ = 0;
  scroll_ = std::min(scroll_, maxScroll_);
  int y = bottom - total + scroll_;  // bottom-anchored like a chat
  if (total < bottom - top) y = top;
  for (const auto& l : lines) {
    if (y + lh > top && y < bottom) c.text(kPad, y, l.first, l.second);
    y += lh;
  }
  return total;
}

void App::renderHome(Canvas& c) {
  int top = kTopBar, bottom = c.height() - kBottomBar, w = c.width();
  int rows = static_cast<int>(workspaces_.size() + 1 + sessions_.size());
  maxScroll_ = std::max(0, rows * kRow - (bottom - top));
  scroll_ = std::min(scroll_, maxScroll_);
  int y = top - scroll_;
  auto row = [&](const std::string& label, const std::string& sub, uint16_t fg, int id, bool selected) {
    if (y + kRow > top && y < bottom) {
      if (selected) c.fillRoundRect(4, y + 2, w - 8, kRow - 4, 8, color::kPanel);
      std::string l = ellipsize(c, label, w - 2 * kPad - (sub.empty() ? 0 : c.textWidth(sub) + kPad));
      c.text(kPad, y + (kRow - c.lineHeight()) / 2, l, fg);
      if (!sub.empty()) c.text(w - kPad - c.textWidth(sub), y + (kRow - c.lineHeight()) / 2, sub, color::kDim);
      addButton(0, std::max(y, top), w, std::min(y + kRow, bottom) - std::max(y, top), id);
    }
    y += kRow;
  };
  std::string selectedWs = pendingWorkspace_.empty() && !workspaces_.empty() ? workspaces_[0].id : pendingWorkspace_;
  for (size_t i = 0; i < workspaces_.size(); i++) {
    row("+ " + workspaces_[i].name, workspaces_[i].id == selectedWs ? "talk" : "", color::kAccent,
        kNew0 + static_cast<int>(i), workspaces_[i].id == selectedWs);
  }
  for (size_t i = 0; i < sessions_.size(); i++) {
    const auto& s = sessions_[i];
    uint16_t fg = s.state == "waiting" ? color::kAccent : s.state == "error" ? color::kBad : color::kFg;
    row(s.title, s.state == "idle" ? "" : s.state, fg, kSession0 + static_cast<int>(i), false);
  }
  row("Game", "", color::kDim, kGame, false);
  c.fillRect(0, bottom, w, kBottomBar, color::kBg);
  drawButton(c, kPad, bottom + 4, w - 2 * kPad, kBottomBar - 8, listening_ ? "Listening..." : "Hold to talk",
             listening_ ? color::kAccent : color::kPanel, color::kFg);
  addButton(kPad, bottom, w - 2 * kPad, kBottomBar, kTalk);
}

void App::renderChat(Canvas& c) {
  std::vector<std::pair<std::string, uint16_t>> lines;
  int maxW = c.width() - 2 * kPad;
  for (const auto& e : events_) {
    std::string text = e.kind == "tool" ? "> " + e.text : e.text;
    for (auto& l : wrapText(c, text, maxW)) lines.emplace_back(l, eventColor(e.kind));
    lines.emplace_back("", color::kFg);
  }
  if (busy()) lines.emplace_back("...", color::kDim);
  renderScrolled(c, lines);
  int bottom = c.height() - kBottomBar, w = c.width();
  c.fillRect(0, bottom, w, kBottomBar, color::kBg);
  int third = (w - 4 * kPad) / 4;
  drawButton(c, kPad, bottom + 4, third, kBottomBar - 8, "Back", color::kPanel, color::kFg);
  addButton(0, bottom, third + kPad, kBottomBar, kHome);
  int talkX = 2 * kPad + third, talkW = busy() ? 2 * third : 3 * third + kPad;
  drawButton(c, talkX, bottom + 4, talkW, kBottomBar - 8, listening_ ? "Listening..." : "Hold to talk",
             listening_ ? color::kAccent : color::kPanel, color::kFg);
  addButton(talkX, bottom, talkW, kBottomBar, kTalk);
  if (busy()) {
    int stopX = talkX + talkW + kPad;
    drawButton(c, stopX, bottom + 4, w - kPad - stopX, kBottomBar - 8, "Stop", color::kBad, color::kFg);
    addButton(stopX, bottom, w - stopX, kBottomBar, kStop);
  }
}

void App::renderCompose(Canvas& c) {
  std::vector<std::pair<std::string, uint16_t>> lines;
  for (auto& l : wrapText(c, "\"" + transcript_ + "\"", c.width() - 2 * kPad)) lines.emplace_back(l, color::kAccent);
  renderScrolled(c, lines);
  int bottom = c.height() - kBottomBar, w = c.width(), half = (w - 3 * kPad) / 2;
  c.fillRect(0, bottom, w, kBottomBar, color::kBg);
  drawButton(c, kPad, bottom + 4, half, kBottomBar - 8, "Discard", color::kPanel, color::kFg);
  addButton(0, bottom, half + kPad, kBottomBar, kDiscard);
  drawButton(c, 2 * kPad + half, bottom + 4, half, kBottomBar - 8, "Send", color::kOk, color::kFg);
  addButton(kPad + half, bottom, w - kPad - half, kBottomBar, kSend);
}

void App::renderApproval(Canvas& c) {
  buttons_.clear();
  const auto& a = approvals_.front();
  int w = c.width(), h = c.height();
  c.fillRect(0, 0, w, h, color::kBg);
  std::string head = "Allow " + a.tool + "?";
  if (approvals_.size() > 1) head += " (" + std::to_string(approvals_.size()) + ")";
  c.text(kPad, kPad, ellipsize(c, head, w - 2 * kPad, 2), color::kAccent, 2);
  int y = kPad + c.lineHeight(2) + 6, lh = c.lineHeight() + 2;
  int bottomY = h - 64;
  for (auto& l : wrapText(c, a.summary, w - 2 * kPad)) {
    if (y + lh > bottomY - lh) {
      c.text(kPad, y, "...", color::kDim);
      break;
    }
    c.text(kPad, y, l, color::kFg);
    y += lh;
  }
  long left = a.deadlineMs > nowMs_ ? static_cast<long>((a.deadlineMs - nowMs_ + 999) / 1000) : 0;
  std::string t = "auto-deny in " + std::to_string(left) + "s";
  c.text((w - c.textWidth(t)) / 2, bottomY - lh, t, color::kDim);
  int half = (w - 3 * kPad) / 2;
  drawButton(c, kPad, h - 60, half, 52, "Deny", color::kPanel, color::kFg);
  addButton(0, h - 64, half + kPad, 64, kDeny);
  drawButton(c, 2 * kPad + half, h - 60, half, 52, "Allow", color::kOk, color::kFg);
  addButton(kPad + half, h - 64, w - kPad - half, 64, kAllow);
}

void App::render(Canvas& c) {
  dirty_ = false;
  buttons_.clear();
  if (!approvals_.empty()) {
    renderApproval(c);
    c.present();
    return;
  }
  c.fillRect(0, 0, c.width(), c.height(), color::kBg);
  switch (screen_) {
    case Screen::Offline: {
      renderTop(c, "claude");
      int y = kTopBar + kPad;
      std::string msg = link_.connected() ? "Signing in..." : "Connecting...";
      c.text(kPad, y, msg, color::kFg);
      y += c.lineHeight() + 6;
      std::string detail = error_.empty() ? "Phone hotspot or saved Wi-Fi. Set up over USB serial: type 'help'." : error_;
      for (auto& l : wrapText(c, detail, c.width() - 2 * kPad)) {
        c.text(kPad, y, l, error_.empty() ? color::kDim : color::kBad);
        y += c.lineHeight() + 2;
      }
      int bottom = c.height() - kBottomBar;
      drawButton(c, kPad, bottom + 4, c.width() - 2 * kPad, kBottomBar - 8, "Game", color::kPanel, color::kFg);
      addButton(0, bottom, c.width(), kBottomBar, kGame);
      break;
    }
    case Screen::Home:
      renderHome(c);
      renderTop(c, device_.empty() ? "claude" : device_);
      break;
    case Screen::Chat: {
      renderChat(c);
      std::string title = "session";
      for (const auto& s : sessions_) {
        if (s.id == current_) title = s.title;
      }
      renderTop(c, title);
      break;
    }
    case Screen::Compose:
      renderCompose(c);
      renderTop(c, current_.empty() ? "New session" : "Reply");
      break;
    case Screen::Game: {
      renderTop(c, "Dodge");
      int bottom = c.height() - kBottomBar;
      game_.render(c, kTopBar, bottom - kTopBar);
      drawButton(c, kPad, bottom + 4, c.width() - 2 * kPad, kBottomBar - 8, "Back", color::kPanel, color::kFg);
      addButton(0, bottom, c.width(), kBottomBar, kHome);
      break;
    }
  }
  c.present();
}

}  // namespace watch
