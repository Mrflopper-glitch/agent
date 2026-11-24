// Message builders for the relay protocol (docs/claude-remote/protocol.md), version 1.
#pragma once
#include <cstdint>
#include <string>

namespace watch {
namespace proto {

constexpr int kVersion = 1;
constexpr int kAudioRate = 16000;
constexpr size_t kMaxPrompt = 4000;

std::string auth(const std::string& token, const std::string& firmware);
std::string ping(unsigned long t);
std::string list();
std::string open(const std::string& session);
std::string newSession(const std::string& workspace, const std::string& text);
std::string prompt(const std::string& session, const std::string& text);
std::string stop(const std::string& session);
std::string approve(const std::string& request, bool allow);
std::string audioStart(int rate = kAudioRate);
std::string audioEnd();

}  // namespace proto

// Relay endpoint parsed from a wss:// (or, with WATCH_ALLOW_INSECURE_WS, ws://) URL.
struct RelayUrl {
  bool tls = true;
  std::string host;
  uint16_t port = 443;
  std::string path = "/ws";
};

// Returns false for malformed URLs and for ws:// unless allowInsecure is set.
bool parseRelayUrl(const std::string& url, RelayUrl& out, bool allowInsecure = false);

}  // namespace watch
