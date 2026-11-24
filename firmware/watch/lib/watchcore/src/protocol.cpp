#include "protocol.h"

#include <ArduinoJson.h>

#include <cstdlib>

namespace watch {
namespace proto {
namespace {

std::string dump(JsonDocument& doc) {
  std::string out;
  serializeJson(doc, out);
  return out;
}

std::string clipPrompt(const std::string& text) {
  return text.size() > kMaxPrompt ? text.substr(0, kMaxPrompt) : text;
}

}  // namespace

std::string auth(const std::string& token, const std::string& firmware) {
  JsonDocument d;
  d["type"] = "auth";
  d["token"] = token;
  d["fw"] = firmware;
  d["protocol"] = kVersion;
  return dump(d);
}

std::string ping(unsigned long t) {
  JsonDocument d;
  d["type"] = "ping";
  d["t"] = t;
  return dump(d);
}

std::string list() {
  JsonDocument d;
  d["type"] = "list";
  return dump(d);
}

std::string open(const std::string& session) {
  JsonDocument d;
  d["type"] = "open";
  d["session"] = session;
  return dump(d);
}

std::string newSession(const std::string& workspace, const std::string& text) {
  JsonDocument d;
  d["type"] = "new";
  d["workspace"] = workspace;
  d["text"] = clipPrompt(text);
  return dump(d);
}

std::string prompt(const std::string& session, const std::string& text) {
  JsonDocument d;
  d["type"] = "prompt";
  d["session"] = session;
  d["text"] = clipPrompt(text);
  return dump(d);
}

std::string stop(const std::string& session) {
  JsonDocument d;
  d["type"] = "stop";
  d["session"] = session;
  return dump(d);
}

std::string approve(const std::string& request, bool allow) {
  JsonDocument d;
  d["type"] = "approve";
  d["request"] = request;
  d["allow"] = allow;
  return dump(d);
}

std::string audioStart(int rate) {
  JsonDocument d;
  d["type"] = "audio_start";
  d["rate"] = rate;
  return dump(d);
}

std::string audioEnd() {
  JsonDocument d;
  d["type"] = "audio_end";
  return dump(d);
}

}  // namespace proto

bool parseRelayUrl(const std::string& url, RelayUrl& out, bool allowInsecure) {
  std::string rest;
  if (url.rfind("wss://", 0) == 0) {
    out.tls = true;
    out.port = 443;
    rest = url.substr(6);
  } else if (url.rfind("ws://", 0) == 0 && allowInsecure) {
    out.tls = false;
    out.port = 80;
    rest = url.substr(5);
  } else {
    return false;
  }
  size_t slash = rest.find('/');
  std::string hostport = rest.substr(0, slash);
  out.path = slash == std::string::npos ? "/ws" : rest.substr(slash);
  size_t colon = hostport.rfind(':');
  if (colon != std::string::npos) {
    std::string port = hostport.substr(colon + 1);
    char* end = nullptr;
    long p = std::strtol(port.c_str(), &end, 10);
    if (port.empty() || *end != '\0' || p <= 0 || p > 65535) return false;
    out.port = static_cast<uint16_t>(p);
    hostport = hostport.substr(0, colon);
  }
  if (hostport.empty() || hostport.find_first_of(" @") != std::string::npos) return false;
  out.host = hostport;
  return true;
}

}  // namespace watch
