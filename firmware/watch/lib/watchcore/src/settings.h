// USB-serial provisioning, so no secret is compiled into the firmware image.
//
//   hotspot <ssid> <password>   phone hotspot, tried first on every boot
//   wifi <ssid> <password>      up to three more saved networks
//   relay wss://host[:port]/ws  relay URL (ws:// only with WATCH_ALLOW_INSECURE_WS)
//   token crd_...               device token from `python -m claude_remote add-device`
//   forget                      wipe all of the above
//   status | help
#pragma once
#include <string>
#include <vector>

#include "hal.h"

namespace watch {

constexpr int kMaxNetworks = 4;  // slot 0 is the phone hotspot

struct Network {
  std::string ssid, password;
};

// Saved networks in connection priority order (hotspot first). Empty slots are skipped.
std::vector<Network> savedNetworks(const Store& store);

// Applies one serial command and returns the reply line. Never echoes secrets back.
// Sets *changed when the board should reconnect with the new settings.
std::string handleCommand(Store& store, const std::string& line, bool allowInsecure, bool* changed);

}  // namespace watch
