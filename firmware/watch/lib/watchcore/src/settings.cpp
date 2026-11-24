#include "settings.h"

#include <sstream>

#include "protocol.h"

namespace watch {
namespace {

std::string slotKey(int i, const char* field) { return "net" + std::to_string(i) + field; }

void putNetwork(Store& store, int slot, const std::string& ssid, const std::string& pass) {
  store.put(slotKey(slot, "s"), ssid);
  store.put(slotKey(slot, "p"), pass);
}

std::string rest(std::istringstream& in) {
  std::string r;
  std::getline(in, r);
  size_t start = r.find_first_not_of(' ');
  return start == std::string::npos ? "" : r.substr(start);
}

}  // namespace

std::vector<Network> savedNetworks(const Store& store) {
  std::vector<Network> out;
  for (int i = 0; i < kMaxNetworks; i++) {
    std::string ssid = store.get(slotKey(i, "s"));
    if (!ssid.empty()) out.push_back({ssid, store.get(slotKey(i, "p"))});
  }
  return out;
}

std::string handleCommand(Store& store, const std::string& line, bool allowInsecure, bool* changed) {
  std::istringstream in(line);
  std::string cmd;
  in >> cmd;
  if (changed) *changed = false;
  if (cmd.empty()) return "";
  if (cmd == "help") {
    return "commands: hotspot <ssid> <pass> | wifi <ssid> <pass> | relay <wss://...> | token <crd_...> | forget | status";
  }
  if (cmd == "hotspot" || cmd == "wifi") {
    std::string ssid;
    in >> ssid;
    std::string pass = rest(in);
    if (ssid.empty()) return "error: ssid required";
    if (!pass.empty() && pass.size() < 8) return "error: WPA2 passwords are at least 8 characters";
    int slot = 0;
    if (cmd == "wifi") {
      slot = -1;
      for (int i = 1; i < kMaxNetworks; i++) {
        std::string existing = store.get(slotKey(i, "s"));
        if (existing == ssid || (existing.empty() && slot < 0)) slot = i;
        if (existing == ssid) break;
      }
      if (slot < 0) return "error: all wifi slots used, run forget";
    }
    putNetwork(store, slot, ssid, pass);
    if (changed) *changed = true;
    return "saved " + std::string(slot == 0 ? "hotspot" : "wifi") + " " + ssid;
  }
  if (cmd == "relay") {
    std::string url;
    in >> url;
    RelayUrl parsed;
    if (!parseRelayUrl(url, parsed, allowInsecure)) {
      return allowInsecure ? "error: expected ws:// or wss://host[:port]/path" : "error: expected wss://host[:port]/path";
    }
    store.put("relay", url);
    if (changed) *changed = true;
    return "saved relay " + parsed.host;
  }
  if (cmd == "token") {
    std::string token;
    in >> token;
    if (token.rfind("crd_", 0) != 0 || token.size() < 20) return "error: token must start with crd_";
    store.put("token", token);
    if (changed) *changed = true;
    return "saved token";
  }
  if (cmd == "forget") {
    for (int i = 0; i < kMaxNetworks; i++) putNetwork(store, i, "", "");
    store.put("relay", "");
    store.put("token", "");
    if (changed) *changed = true;
    return "forgot all settings";
  }
  if (cmd == "status") {
    std::string s = "networks:";
    for (const auto& n : savedNetworks(store)) s += " " + n.ssid;
    s += " | relay: " + (store.get("relay").empty() ? std::string("-") : store.get("relay"));
    s += " | token: " + std::string(store.get("token").empty() ? "missing" : "set");
    return s;
  }
  return "error: unknown command, try help";
}

}  // namespace watch
