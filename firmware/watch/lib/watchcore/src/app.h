// Watch UI and session state machine, independent of the board.
//
// The board feeds it relay frames, touch, the push-to-talk button and microphone samples,
// and calls render() when dirty(). The App never blocks and never allocates large buffers.
#pragma once
#include <cstdint>
#include <deque>
#include <string>
#include <vector>

#include "game.h"
#include "hal.h"

namespace watch {

enum class Screen { Offline, Home, Chat, Compose, Game };

struct SessionInfo {
  std::string id, title, state, workspace;
};

struct WorkspaceInfo {
  std::string id, name, kind;
};

struct ChatEvent {
  std::string kind, text;
};

struct ApprovalCard {
  std::string request, session, tool, summary;
  unsigned long deadlineMs = 0;  // local millis() when the relay will auto-deny
};

class App {
 public:
  static constexpr int kTopBar = 26;
  static constexpr int kBottomBar = 44;
  static constexpr size_t kMaxEvents = 60;
  static constexpr size_t kAudioChunkSamples = 4000;  // 250 ms at 16 kHz per binary frame
  static constexpr size_t kMaxAudioSamples = 16000 * 25;  // relay caps clips at 30 s

  App(Link& link, Store& store, Haptics* haptics = nullptr, std::string firmware = "watch/0.1.0");

  // Connection lifecycle, called by the board's WebSocket handler.
  void onLinkUp();
  void onLinkDown();
  void onText(const char* data, size_t len);

  // Touch in screen pixels: one down, any number of moves, one up.
  void touchDown(int x, int y, unsigned long nowMs);
  void touchMove(int x, int y);
  void touchUp(int x, int y, unsigned long nowMs);

  // Push to talk. The board starts the microphone while listening() and passes PCM16 mono.
  void pttDown();
  void pttUp();
  void audio(const int16_t* samples, size_t n);
  bool listening() const { return listening_; }

  void tick(unsigned long nowMs);
  void render(Canvas& c);
  bool dirty() const { return dirty_; }
  void markDirty() { dirty_ = true; }

  // Read-only state, used by tests and by the board for power decisions.
  Screen screen() const { return screen_; }
  const std::vector<SessionInfo>& sessions() const { return sessions_; }
  const std::vector<WorkspaceInfo>& workspaces() const { return workspaces_; }
  const std::deque<ChatEvent>& events() const { return events_; }
  const std::deque<ApprovalCard>& approvals() const { return approvals_; }
  const std::string& current() const { return current_; }
  const std::string& transcript() const { return transcript_; }
  const std::string& lastError() const { return error_; }
  const std::string& device() const { return device_; }
  bool busy() const;
  int scroll() const { return scroll_; }
  DodgeGame& game() { return game_; }

  void openGame();
  void goHome();

 private:
  struct Button {
    int x, y, w, h;
    int id;
  };
  enum ButtonId { kNone, kHome, kStop, kTalk, kSend, kDiscard, kAllow, kDeny, kGame, kNew0 = 100, kSession0 = 200 };

  void handle(const char* type, void* doc);
  void setScreen(Screen s);
  void tap(int x, int y);
  void submit(const std::string& text);
  void addButton(int x, int y, int w, int h, int id);
  int hit(int x, int y) const;
  void drawButton(Canvas& c, int x, int y, int w, int h, const std::string& label, uint16_t bg, uint16_t fg);
  void renderTop(Canvas& c, const std::string& title);
  void renderHome(Canvas& c);
  void renderChat(Canvas& c);
  void renderCompose(Canvas& c);
  void renderApproval(Canvas& c);
  int renderScrolled(Canvas& c, const std::vector<std::pair<std::string, uint16_t>>& lines);
  void flushAudio();

  Link& link_;
  Store& store_;
  Haptics* haptics_;
  std::string firmware_;

  Screen screen_ = Screen::Offline;
  bool authed_ = false;
  bool dirty_ = true;
  std::string device_;
  std::vector<SessionInfo> sessions_;
  std::vector<WorkspaceInfo> workspaces_;
  std::deque<ChatEvent> events_;
  std::deque<ApprovalCard> approvals_;
  std::string current_;
  std::string pendingWorkspace_;
  std::string transcript_;
  std::string error_;
  unsigned long nowMs_ = 0;
  size_t audioSamples_ = 0;

  bool listening_ = false;
  std::vector<int16_t> audioBuf_;

  std::vector<Button> buttons_;
  bool touching_ = false;
  bool dragging_ = false;
  int touchX_ = 0, touchY_ = 0, lastY_ = 0;
  int pressed_ = 0;
  int scroll_ = 0;      // pixels scrolled up from the bottom of the content
  int maxScroll_ = 0;
  bool followTail_ = true;

  DodgeGame game_;
  unsigned long lastGameStep_ = 0;
};

}  // namespace watch
