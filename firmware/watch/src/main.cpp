// LilyGO T-Watch S3 board layer: display, touch, PMU, microphone, haptics, Wi-Fi and the relay
// WebSocket. All UI and protocol logic lives in lib/watchcore and is tested on the host.
#include <Arduino.h>
#include <Preferences.h>
#include <TFT_eSPI.h>
#include <TouchDrvFT6X36.hpp>
#include <SensorDRV2605.hpp>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <Wire.h>
#include <driver/i2s.h>
#include <esp_wifi.h>

#define XPOWERS_CHIP_AXP2101
#include <XPowersLib.h>

#include "app.h"
#include "protocol.h"
#include "root_cas.h"
#include "settings.h"

// Pins from LilyGO's utilities.h (USING_TWATCH_S3).
constexpr int kPinBacklight = 45;
constexpr int kPinTouchSda = 39, kPinTouchScl = 40, kPinTouchInt = 16;
constexpr int kPinI2cSda = 10, kPinI2cScl = 11, kPinPmuInt = 21;
constexpr int kPinMicData = 47, kPinMicClock = 44;

constexpr unsigned long kScreenOffMs = 20000;    // backlight off after 20 s without touch
constexpr unsigned long kWifiTryMs = 8000;       // per saved network
constexpr uint8_t kBacklightLevel = 160;         // of 255; the panel is readable well below full

#ifdef WATCH_ALLOW_INSECURE_WS
constexpr bool kAllowInsecure = true;
#else
constexpr bool kAllowInsecure = false;
#endif

namespace {

class SpriteCanvas : public watch::Canvas {
 public:
  explicit SpriteCanvas(TFT_eSPI& tft) : tft_(tft), sprite_(&tft) {}
  bool begin() {
    sprite_.setColorDepth(16);
    return sprite_.createSprite(240, 240) != nullptr;  // 115 KB, lands in PSRAM
  }
  int width() const override { return 240; }
  int height() const override { return 240; }
  void fillRect(int x, int y, int w, int h, uint16_t c) override { sprite_.fillRect(x, y, w, h, c); }
  void fillRoundRect(int x, int y, int w, int h, int r, uint16_t c) override { sprite_.fillRoundRect(x, y, w, h, r, c); }
  void text(int x, int y, const std::string& s, uint16_t c, int size) override {
    sprite_.setTextColor(c);
    sprite_.drawString(s.c_str(), x, y, font(size));
  }
  int textWidth(const std::string& s, int size) const override {
    return const_cast<TFT_eSprite&>(sprite_).textWidth(s.c_str(), font(size));
  }
  int lineHeight(int size) const override { return size >= 2 ? 26 : 16; }
  void present() override { sprite_.pushSprite(0, 0); }

 private:
  static int font(int size) { return size >= 2 ? 4 : 2; }
  TFT_eSPI& tft_;
  TFT_eSprite sprite_;
};

class WsLink : public watch::Link {
 public:
  WebSocketsClient ws;
  bool up = false;
  bool connected() const override { return up; }
  bool sendText(const std::string& json) override { return up && ws.sendTXT(json.c_str(), json.size()); }
  bool sendBinary(const uint8_t* data, size_t len) override { return up && ws.sendBIN(data, len); }
};

class NvsStore : public watch::Store {
 public:
  void begin() { prefs_.begin("watch", false); }
  std::string get(const std::string& key, const std::string& fallback) const override {
    String v = const_cast<Preferences&>(prefs_).getString(key.c_str(), fallback.c_str());
    return v.c_str();
  }
  void put(const std::string& key, const std::string& value) override { prefs_.putString(key.c_str(), value.c_str()); }

 private:
  Preferences prefs_;
};

class Drv2605Haptics : public watch::Haptics {
 public:
  SensorDRV2605 drv;
  bool ok = false;
  void buzz(int) override {
    if (!ok) return;
    drv.setWaveform(0, 15);
    drv.setWaveform(1, 0);
    drv.run();
  }
};

TFT_eSPI tft;
SpriteCanvas canvas(tft);
TouchDrvFT6X36 touch;
XPowersAXP2101 pmu;
WsLink relayLink;
NvsStore store;
Drv2605Haptics haptics;
watch::App* app = nullptr;

volatile bool pmuIrq = false;
bool touchWasDown = false;
bool screenOn = true;
unsigned long lastActivity = 0;
String serialLine;

enum class NetState { Idle, Joining, Online };
NetState net = NetState::Idle;
size_t netIndex = 0;
unsigned long netStarted = 0;
bool relayStarted = false;

void setBacklight(bool on) {
  screenOn = on;
  ledcWrite(0, on ? kBacklightLevel : 0);
  if (!on) touch.sleep();  // stays wakeable via its INT line
}

void wake() {
  lastActivity = millis();
  if (!screenOn) {
    touch.wakeup();
    setBacklight(true);
    app->markDirty();
  }
}

void initPmu() {
  if (!pmu.init(Wire, kPinI2cSda, kPinI2cScl, AXP2101_SLAVE_ADDRESS)) {
    Serial.println("pmu: AXP2101 not found");
    return;
  }
  pmu.setVbusVoltageLimit(XPOWERS_AXP2101_VBUS_VOL_LIM_4V36);
  pmu.setVbusCurrentLimit(XPOWERS_AXP2101_VBUS_CUR_LIM_900MA);
  pmu.setSysPowerDownVoltage(2600);
  pmu.setALDO1Voltage(3300);  // RTC
  pmu.setALDO2Voltage(3300);  // display backlight VDD
  pmu.setALDO3Voltage(3300);  // touch VDD
  pmu.setBLDO2Voltage(3300);  // DRV2605 enable
  pmu.enableALDO1();
  pmu.enableALDO2();
  pmu.enableALDO3();
  pmu.enableBLDO2();
  pmu.disableALDO4();  // SX1262 LoRa radio, unused
  pmu.disableBLDO1();  // GPS on some revisions, unused
  // LilyGO: do not raise the charge current above 125 mA for the stock 502530 cell.
  pmu.setChargerConstantCurr(XPOWERS_AXP2101_CHG_CUR_125MA);
  pmu.setChargeTargetVoltage(XPOWERS_AXP2101_CHG_VOL_4V2);
  pmu.enableBattVoltageMeasure();
  pmu.setPowerKeyPressOffTime(XPOWERS_POWEROFF_4S);
  pmu.disableIRQ(XPOWERS_AXP2101_ALL_IRQ);
  pmu.clearIrqStatus();
  pmu.enableIRQ(XPOWERS_AXP2101_PKEY_SHORT_IRQ);
  pinMode(kPinPmuInt, INPUT_PULLUP);
  attachInterrupt(kPinPmuInt, [] { pmuIrq = true; }, FALLING);
}

bool initMic() {
  i2s_config_t cfg = {};
  cfg.mode = static_cast<i2s_mode_t>(I2S_MODE_MASTER | I2S_MODE_RX | I2S_MODE_PDM);
  cfg.sample_rate = watch::proto::kAudioRate;
  cfg.bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT;
  cfg.channel_format = I2S_CHANNEL_FMT_ONLY_RIGHT;
  cfg.communication_format = I2S_COMM_FORMAT_STAND_PCM_SHORT;
  cfg.intr_alloc_flags = ESP_INTR_FLAG_LEVEL1;
  cfg.dma_buf_count = 6;
  cfg.dma_buf_len = 512;
  cfg.use_apll = true;
  i2s_pin_config_t pins = {};
  pins.mck_io_num = I2S_PIN_NO_CHANGE;
  pins.bck_io_num = I2S_PIN_NO_CHANGE;
  pins.ws_io_num = kPinMicClock;
  pins.data_out_num = I2S_PIN_NO_CHANGE;
  pins.data_in_num = kPinMicData;
  // The PDM microphone only works on I2S port 0.
  return i2s_driver_install(I2S_NUM_0, &cfg, 0, nullptr) == ESP_OK && i2s_set_pin(I2S_NUM_0, &pins) == ESP_OK;
}

void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      relayLink.up = true;
      app->onLinkUp();
      break;
    case WStype_DISCONNECTED:
      if (relayLink.up) app->onLinkDown();
      relayLink.up = false;
      break;
    case WStype_TEXT:
      app->onText(reinterpret_cast<const char*>(payload), length);
      if (app->approvals().size()) wake();
      break;
    default:
      break;
  }
}

void startRelay() {
  watch::RelayUrl url;
  if (!watch::parseRelayUrl(store.get("relay", ""), url, kAllowInsecure)) {
    Serial.println("relay: not configured, use `relay wss://...`");
    return;
  }
  if (url.tls) {
    relayLink.ws.beginSslWithCA(url.host.c_str(), url.port, url.path.c_str(), kRelayRootCAs);
  } else {
    relayLink.ws.begin(url.host.c_str(), url.port, url.path.c_str());
  }
  relayLink.ws.onEvent(onWsEvent);
  relayLink.ws.setReconnectInterval(3000);
  relayLink.ws.enableHeartbeat(15000, 5000, 2);
  relayStarted = true;
}

void restartNetwork() {
  if (relayStarted) relayLink.ws.disconnect();
  relayStarted = false;
  WiFi.disconnect(true);
  net = NetState::Idle;
  netIndex = 0;
}

// Joins saved networks in priority order (phone hotspot first) instead of strongest-RSSI,
// so a watch that just walked out of the house lands on the phone without a scan.
void pumpNetwork() {
  auto nets = watch::savedNetworks(store);
  if (nets.empty()) return;
  if (net == NetState::Online) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("wifi: lost");
      net = NetState::Idle;
      netIndex = 0;
    }
    return;
  }
  if (net == NetState::Joining) {
    if (WiFi.status() == WL_CONNECTED) {
      net = NetState::Online;
      WiFi.setSleep(true);  // modem sleep between DTIM beacons
      Serial.printf("wifi: joined %s\n", WiFi.SSID().c_str());
      if (!relayStarted) startRelay();
      return;
    }
    if (millis() - netStarted < kWifiTryMs) return;
    netIndex = (netIndex + 1) % nets.size();
  }
  const auto& n = nets[netIndex % nets.size()];
  WiFi.mode(WIFI_STA);
  WiFi.begin(n.ssid.c_str(), n.password.empty() ? nullptr : n.password.c_str());
  net = NetState::Joining;
  netStarted = millis();
}

void pumpSerial() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\r') continue;
    if (ch != '\n') {
      if (serialLine.length() < 512) serialLine += ch;
      continue;
    }
    bool changed = false;
    std::string reply = watch::handleCommand(store, serialLine.c_str(), kAllowInsecure, &changed);
    serialLine = "";
    if (!reply.empty()) Serial.println(reply.c_str());
    if (changed) restartNetwork();
  }
}

void pumpTouch() {
  int16_t x = 0, y = 0;
  bool down = digitalRead(kPinTouchInt) == LOW && touch.getPoint(&x, &y, 1);
  unsigned long now = millis();
  if (down) {
    bool wasOff = !screenOn;
    wake();
    if (wasOff) return;  // the first touch only wakes the screen
    if (!touchWasDown) app->touchDown(x, y, now);
    else app->touchMove(x, y);
  } else if (touchWasDown) {
    app->touchUp(x, y, now);
  }
  touchWasDown = down;
}

void pumpPowerKey() {
  if (!pmuIrq) return;
  pmuIrq = false;
  pmu.getIrqStatus();
  if (pmu.isPekeyShortPressIrq()) {
    wake();
    // The crown toggles push-to-talk: press to start, press again to send.
    if (app->listening()) app->pttUp();
    else app->pttDown();
  }
  pmu.clearIrqStatus();
}

void pumpMic() {
  static int16_t buf[512];
  if (!app->listening()) return;
  size_t got = 0;
  if (i2s_read(I2S_NUM_0, buf, sizeof(buf), &got, 0) == ESP_OK && got) app->audio(buf, got / sizeof(int16_t));
}

}  // namespace

void setup() {
  Serial.begin(115200);
  store.begin();
  Wire.begin(kPinI2cSda, kPinI2cScl);
  initPmu();

  tft.init();
  tft.setRotation(2);  // matches LilyGO's default orientation; touch maps 1:1 at rotation 2
  tft.fillScreen(TFT_BLACK);
  ledcSetup(0, 2000, 8);
  ledcAttachPin(kPinBacklight, 0);
  if (!canvas.begin()) Serial.println("display: sprite allocation failed (PSRAM?)");

  Wire1.begin(kPinTouchSda, kPinTouchScl);
  pinMode(kPinTouchInt, INPUT);
  if (!touch.begin(Wire1, FT6X36_SLAVE_ADDRESS, kPinTouchSda, kPinTouchScl)) Serial.println("touch: FT6336 not found");
  touch.interruptTrigger();

  haptics.ok = haptics.drv.init(Wire);
  if (haptics.ok) {
    haptics.drv.selectLibrary(1);
    haptics.drv.setMode(DRV2605_MODE_INTTRIG);
    haptics.drv.useERM();
  }
  if (!initMic()) Serial.println("mic: PDM init failed");

  static watch::App watchApp(relayLink, store, &haptics, "twatch-s3/0.1.0");
  app = &watchApp;
  setBacklight(true);
  lastActivity = millis();
  Serial.println("claude-remote watch ready; type `help` to provision");
}

void loop() {
  unsigned long now = millis();
  pumpSerial();
  pumpNetwork();
  if (relayStarted) relayLink.ws.loop();
  pumpTouch();
  pumpPowerKey();
  pumpMic();
  app->tick(now);
  bool keepAwake = app->listening() || !app->approvals().empty() || app->screen() == watch::Screen::Game;
  if (screenOn && !keepAwake && now - lastActivity > kScreenOffMs) setBacklight(false);
  if (screenOn && app->dirty()) app->render(canvas);
  delay(screenOn ? 10 : 50);  // FreeRTOS idle + Wi-Fi modem sleep do the rest
}
