#include <unity.h>

#include <map>
#include <string>
#include <vector>

#include "app.h"
#include "protocol.h"
#include "settings.h"
#include "wrap.h"

using namespace watch;

struct FakeCanvas : Canvas {
  std::vector<std::string> drawn;
  int width() const override { return 240; }
  int height() const override { return 240; }
  void fillRect(int, int, int, int, uint16_t) override {}
  void fillRoundRect(int, int, int, int, int, uint16_t) override {}
  void text(int, int, const std::string& s, uint16_t, int) override { drawn.push_back(s); }
  int textWidth(const std::string& s, int size) const override { return static_cast<int>(s.size()) * 7 * size; }
  int lineHeight(int size) const override { return 14 * size; }
  bool shows(const std::string& needle) const {
    for (const auto& d : drawn) {
      if (d.find(needle) != std::string::npos) return true;
    }
    return false;
  }
};

struct FakeLink : Link {
  bool up = true;
  std::vector<std::string> text;
  size_t binaryBytes = 0;
  int binaryFrames = 0;
  bool connected() const override { return up; }
  bool sendText(const std::string& json) override {
    text.push_back(json);
    return up;
  }
  bool sendBinary(const uint8_t*, size_t len) override {
    binaryBytes += len;
    binaryFrames++;
    return up;
  }
  bool sent(const std::string& needle) const {
    for (const auto& t : text) {
      if (t.find(needle) != std::string::npos) return true;
    }
    return false;
  }
};

struct MapStore : Store {
  std::map<std::string, std::string> kv;
  std::string get(const std::string& k, const std::string& f) const override {
    auto it = kv.find(k);
    return it == kv.end() ? f : it->second;
  }
  void put(const std::string& k, const std::string& v) override { kv[k] = v; }
};

struct Rig {
  FakeLink link;
  MapStore store;
  FakeCanvas canvas;
  App app{link, store};
  Rig() { store.kv["token"] = "crd_0123456789abcdefghij"; }
  void recv(const std::string& json) { app.onText(json.data(), json.size()); }
  void render() {
    canvas.drawn.clear();
    app.render(canvas);
  }
  void tapAt(int x, int y) {
    app.touchDown(x, y, 0);
    app.touchUp(x, y, 10);
  }
  void login() {
    app.onLinkUp();
    recv(R"({"type":"hello","device":"watch","protocol":1,"scopes":["view","prompt","approve"],)"
         R"("workspaces":[{"id":"repo","name":"Repo","kind":"code"},{"id":"pc","name":"Computer","kind":"computer"}],)"
         R"("features":{"stt":true,"screen":false}})");
    recv(R"({"type":"sessions","items":[{"id":"s1","title":"fix ci","state":"idle","workspace":"repo","updated":1}]})");
    render();
  }
};

void test_wrap_respects_width_and_newlines() {
  FakeCanvas c;
  auto lines = wrapText(c, "the quick brown fox jumps\nover", 70);
  TEST_ASSERT_EQUAL(4, lines.size());
  TEST_ASSERT_EQUAL_STRING("the quick", lines[0].c_str());
  TEST_ASSERT_EQUAL_STRING("over", lines[3].c_str());
  for (auto& l : wrapText(c, "supercalifragilisticexpialidocious", 70)) TEST_ASSERT_TRUE(c.textWidth(l, 1) <= 70);
  TEST_ASSERT_EQUAL_STRING("abcdef...", ellipsize(c, "abcdefghijkl", 63).c_str());
}

void test_wrap_never_splits_utf8() {
  FakeCanvas c;
  for (auto& l : wrapText(c, "\xC3\xA9\xC3\xA9\xC3\xA9\xC3\xA9\xC3\xA9", 14)) {
    TEST_ASSERT_TRUE((static_cast<unsigned char>(l[0]) & 0xC0) != 0x80);
  }
}

void test_relay_url_parsing() {
  RelayUrl u;
  TEST_ASSERT_TRUE(parseRelayUrl("wss://relay.example.com/ws", u));
  TEST_ASSERT_EQUAL_STRING("relay.example.com", u.host.c_str());
  TEST_ASSERT_EQUAL(443, u.port);
  TEST_ASSERT_TRUE(parseRelayUrl("wss://h:8443", u));
  TEST_ASSERT_EQUAL(8443, u.port);
  TEST_ASSERT_EQUAL_STRING("/ws", u.path.c_str());
  TEST_ASSERT_FALSE(parseRelayUrl("ws://h/ws", u));
  TEST_ASSERT_TRUE(parseRelayUrl("ws://h:8765/ws", u, true));
  TEST_ASSERT_FALSE(u.tls);
  TEST_ASSERT_FALSE(parseRelayUrl("wss://h:99999/ws", u));
  TEST_ASSERT_FALSE(parseRelayUrl("https://h/ws", u));
}

void test_provisioning_commands() {
  MapStore s;
  bool changed = false;
  TEST_ASSERT_EQUAL_STRING("saved hotspot Pixel", handleCommand(s, "hotspot Pixel hunter22pass", false, &changed).c_str());
  TEST_ASSERT_TRUE(changed);
  handleCommand(s, "wifi Home pass word 123", false, &changed);
  auto nets = savedNetworks(s);
  TEST_ASSERT_EQUAL(2, nets.size());
  TEST_ASSERT_EQUAL_STRING("Pixel", nets[0].ssid.c_str());
  TEST_ASSERT_EQUAL_STRING("pass word 123", nets[1].password.c_str());
  TEST_ASSERT_TRUE(handleCommand(s, "wifi Short 123", false, &changed).rfind("error", 0) == 0);
  TEST_ASSERT_TRUE(handleCommand(s, "relay ws://lan:8765/ws", false, &changed).rfind("error", 0) == 0);
  TEST_ASSERT_EQUAL_STRING("saved relay r.example", handleCommand(s, "relay wss://r.example/ws", false, &changed).c_str());
  TEST_ASSERT_TRUE(handleCommand(s, "token nope", false, &changed).rfind("error", 0) == 0);
  handleCommand(s, "token crd_0123456789abcdefghij", false, &changed);
  std::string status = handleCommand(s, "status", false, &changed);
  TEST_ASSERT_TRUE(status.find("token: set") != std::string::npos);
  TEST_ASSERT_TRUE(status.find("crd_") == std::string::npos);
  TEST_ASSERT_TRUE(status.find("hunter22") == std::string::npos);
  handleCommand(s, "forget", false, &changed);
  TEST_ASSERT_EQUAL(0, savedNetworks(s).size());
}

void test_login_and_home() {
  Rig r;
  TEST_ASSERT_TRUE(r.app.screen() == Screen::Offline);
  r.login();
  TEST_ASSERT_TRUE(r.link.sent("\"type\":\"auth\""));
  TEST_ASSERT_TRUE(r.app.screen() == Screen::Home);
  TEST_ASSERT_EQUAL(2, r.app.workspaces().size());
  TEST_ASSERT_TRUE(r.canvas.shows("+ Repo"));
  TEST_ASSERT_TRUE(r.canvas.shows("fix ci"));
  TEST_ASSERT_TRUE(r.canvas.shows("Hold to talk"));
}

void test_missing_token_stays_offline() {
  Rig r;
  r.store.kv.clear();
  r.app.onLinkUp();
  TEST_ASSERT_EQUAL(0, r.link.text.size());
  r.render();
  TEST_ASSERT_TRUE(r.canvas.shows("no device token"));
}

void test_push_to_talk_streams_audio_then_confirms() {
  Rig r;
  r.login();
  r.app.touchDown(120, 220, 0);  // bottom bar is the talk button
  TEST_ASSERT_TRUE(r.app.listening());
  std::vector<int16_t> pcm(10000, 0);
  r.app.audio(pcm.data(), pcm.size());
  r.app.touchUp(120, 220, 1000);
  TEST_ASSERT_FALSE(r.app.listening());
  TEST_ASSERT_TRUE(r.link.sent("audio_start"));
  TEST_ASSERT_TRUE(r.link.sent("audio_end"));
  TEST_ASSERT_EQUAL(20000, r.link.binaryBytes);
  TEST_ASSERT_EQUAL(3, r.link.binaryFrames);  // 4000 + 4000 + 2000 samples
  r.recv(R"({"type":"transcript","text":"run the tests"})");
  TEST_ASSERT_TRUE(r.app.screen() == Screen::Compose);
  r.render();
  r.tapAt(200, 220);  // Send
  TEST_ASSERT_TRUE(r.link.sent(R"("type":"new","workspace":"repo","text":"run the tests")"));
}

void test_selecting_workspace_targets_new_session() {
  Rig r;
  r.login();
  r.tapAt(100, 26 + 32 + 10);  // second row: "+ Computer"
  r.render();
  r.recv(R"({"type":"transcript","text":"open the browser"})");
  r.render();
  r.tapAt(200, 220);
  TEST_ASSERT_TRUE(r.link.sent(R"("workspace":"pc")"));
}

void test_chat_streams_and_approval_flow() {
  Rig r;
  r.login();
  r.tapAt(100, 26 + 2 * 32 + 10);  // session row
  TEST_ASSERT_TRUE(r.link.sent(R"({"type":"open","session":"s1"})"));
  r.recv(R"({"type":"history","session":"s1","state":"running","events":[{"kind":"user","text":"why is ci red"}]})");
  r.recv(R"({"type":"state","session":"s1","state":"running"})");
  r.recv(R"({"type":"event","session":"s1","seq":2,"kind":"text","text":"Checking the workflow logs."})");
  r.recv(R"({"type":"event","session":"other","seq":1,"kind":"text","text":"not mine"})");
  TEST_ASSERT_TRUE(r.app.screen() == Screen::Chat);
  TEST_ASSERT_EQUAL(2, r.app.events().size());
  r.render();
  TEST_ASSERT_TRUE(r.canvas.shows("Checking the"));
  TEST_ASSERT_TRUE(r.canvas.shows("Stop"));

  r.app.tick(1000);
  r.recv(R"({"type":"approval","request":"a1","session":"s1","tool":"Bash","summary":"npm test","expires":0,"ttl":30})");
  r.render();
  TEST_ASSERT_TRUE(r.canvas.shows("Allow Bash?"));
  TEST_ASSERT_TRUE(r.canvas.shows("npm test"));
  TEST_ASSERT_TRUE(r.canvas.shows("auto-deny in 30s"));
  r.app.touchDown(120, 220, 0);  // push to talk is blocked while an approval is up
  TEST_ASSERT_FALSE(r.app.listening());
  r.app.touchUp(120, 220, 0);
  r.render();
  r.tapAt(200, 210);
  TEST_ASSERT_TRUE(r.link.sent(R"({"type":"approve","request":"a1","allow":true})"));
  TEST_ASSERT_EQUAL(0, r.app.approvals().size());

  r.recv(R"({"type":"approval","request":"a2","session":"s1","tool":"Write","summary":"x","ttl":5})");
  r.app.tick(7000);
  TEST_ASSERT_EQUAL(0, r.app.approvals().size());
}

void test_stop_and_back() {
  Rig r;
  r.login();
  r.recv(R"({"type":"history","session":"s1","state":"running","events":[]})");
  r.recv(R"({"type":"state","session":"s1","state":"running"})");
  r.render();
  r.tapAt(230, 220);
  TEST_ASSERT_TRUE(r.link.sent(R"({"type":"stop","session":"s1"})"));
  r.tapAt(10, 220);
  TEST_ASSERT_TRUE(r.app.screen() == Screen::Home);
  TEST_ASSERT_TRUE(r.link.sent(R"({"type":"list"})"));
}

void test_disconnect_drops_to_offline_and_clears_approvals() {
  Rig r;
  r.login();
  r.recv(R"({"type":"approval","request":"a1","session":"s1","tool":"Bash","summary":"ls","ttl":30})");
  r.link.up = false;
  r.app.onLinkDown();
  TEST_ASSERT_TRUE(r.app.screen() == Screen::Offline);
  TEST_ASSERT_EQUAL(0, r.app.approvals().size());
}

void test_game_runs_offline() {
  Rig r;
  r.render();
  r.tapAt(120, 220);  // Game button on the offline screen
  TEST_ASSERT_TRUE(r.app.screen() == Screen::Game);
  int lane = r.app.game().lane();
  r.tapAt(10, 100);
  TEST_ASSERT_EQUAL(lane - 1, r.app.game().lane());
  for (unsigned long t = 0; t < 60000 && !r.app.game().over(); t += 33) r.app.tick(t);
  TEST_ASSERT_TRUE(r.app.game().over());
  r.render();
  TEST_ASSERT_TRUE(r.canvas.shows("game over"));
}

void test_scrolling_chat() {
  Rig r;
  r.login();
  r.recv(R"({"type":"history","session":"s1","state":"idle","events":[]})");
  for (int i = 0; i < 30; i++) {
    r.recv(R"({"type":"event","session":"s1","seq":1,"kind":"text","text":"line of streamed output"})");
  }
  r.render();
  TEST_ASSERT_EQUAL(0, r.app.scroll());
  r.app.touchDown(120, 60, 0);
  r.app.touchMove(120, 90);
  r.app.touchMove(120, 150);
  r.app.touchUp(120, 150, 100);
  TEST_ASSERT_TRUE(r.app.scroll() > 0);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_wrap_respects_width_and_newlines);
  RUN_TEST(test_wrap_never_splits_utf8);
  RUN_TEST(test_relay_url_parsing);
  RUN_TEST(test_provisioning_commands);
  RUN_TEST(test_login_and_home);
  RUN_TEST(test_missing_token_stays_offline);
  RUN_TEST(test_push_to_talk_streams_audio_then_confirms);
  RUN_TEST(test_selecting_workspace_targets_new_session);
  RUN_TEST(test_chat_streams_and_approval_flow);
  RUN_TEST(test_stop_and_back);
  RUN_TEST(test_disconnect_drops_to_offline_and_clears_approvals);
  RUN_TEST(test_game_runs_offline);
  RUN_TEST(test_scrolling_chat);
  return UNITY_END();
}
