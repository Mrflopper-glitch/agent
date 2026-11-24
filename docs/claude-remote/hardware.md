# Hardware: LilyGO T-Watch S3 reference

The first target is a stock **LilyGO T-Watch S3** (not the "Plus" GPS variant). It is the size of a
small smartwatch, already has every part this client needs, and needs no soldering. All pin numbers
below come from LilyGO's `TTGO_TWatch_Library` (`src/utilities.h`, `USING_TWATCH_S3`) and its
`Setup212_LilyGo_T_Watch_S3.h` TFT_eSPI setup.

| Part | Chip | Connection |
| --- | --- | --- |
| MCU | ESP32-S3, 240 MHz dual core, Wi-Fi 4 + BLE 5 | 16 MB QIO flash, 8 MB OPI PSRAM |
| Display | 1.54" 240x240 IPS, ST7789, SPI | MOSI 13, SCLK 18, CS 12, DC 38, no RST/MISO, backlight 45 (PWM), inversion on, rotation 2 |
| Touch | FT6336 (FT6X36 driver), I2C `Wire1` addr 0x38 | SDA 39, SCL 40, INT 16; at rotation 2 touch maps 1:1 to pixels |
| PMU | AXP2101, I2C `Wire` | SDA 10, SCL 11, IRQ 21; ALDO2 = backlight VDD, ALDO3 = touch VDD, BLDO2 = haptics |
| Crown | AXP2101 power key | short press = push-to-talk toggle, 4 s = power off |
| Microphone | PDM MEMS | DATA 47, CLK 44, I2S port 0 only, 16 kHz 16-bit mono |
| Speaker | MAX98357A I2S amp | BCK 48, WS 15, DOUT 46 (unused in v1) |
| Haptics | DRV2605 + ERM motor, I2C `Wire` | one tap per approval |
| Also on board, unused | BMA423 IMU (INT 14), PCF8563 RTC (INT 17), SX1262 LoRa (ALDO4 off), IR TX (2) | |
| Battery | 502530 LiPo, ~5 x 25 x 30 mm, ~400-470 mAh | charge current must stay at 125 mA (LilyGO) |

The firmware turns the LoRa rail (ALDO4) and GPS rail (BLDO1) off, charges to 4.2 V at 125 mA,
and keeps the frame buffer as a 240x240x16-bit sprite (115 KB) in PSRAM.

### UI assumptions

- 240x240 with a 26 px title bar and a 44 px bottom bar, leaving about 170 px for content: ~10 lines
  of 16 px text, ~26 characters per line in TFT_eSPI font 2.
- Every control is at least 44 px tall. Scrolling is a vertical drag; there is no keyboard on the
  watch. The browser emulator has an optional text box for typed prompts, and the protocol accepts
  text from any future keyboard accessory.
- Push-to-talk: hold the bottom bar, or press the crown to start and again to stop. Audio is sent
  as 250 ms frames and transcribed on the host; the watch shows the transcript for confirmation.

## Connectivity

- **v1: phone hotspot first.** Slot 0 (`hotspot <ssid> <password>`) is tried on every boot and after
  every drop, then up to three saved networks in order. Wi-Fi modem sleep is on while connected.
- Captive-portal networks (hotels, airports) are not supported directly; use the phone hotspot.
- **Later: onboard LTE-M/NB-IoT or eSIM.** A modem (for example SIM7080G) adds roughly 8-15 mm of
  thickness with its antenna and a bigger cell, and draws 100-500 mA peaks while attached, which
  would cut the always-connected runtime below the 3-5 h row in the table. It belongs in a v2
  enclosure, not on the stock T-Watch S3.

## Battery budget (estimates)

**These are estimates, pending the chosen battery and measured current draw.** They assume the
stock ~400-470 mAh cell and typical ESP32-S3 figures (Wi-Fi associated with modem sleep ~20-40 mA
average, active TX/RX bursts 100-300 mA, backlight 20-40 mA, PDM mic streaming ~100+ mA total with
Wi-Fi). Measure with a USB power meter on the battery rail before relying on them.

| Usage pattern | Estimated runtime |
| --- | --- |
| Regular use over a phone hotspot (screen on when glancing, a few prompts and approvals an hour) | 6-10 hours |
| Aggressive display sleep and intermittent sync (Wi-Fi drops between check-ins) | 1-2 days |
| Always-on Wi-Fi, frequent voice prompts, or a future cellular modem | 3-5 hours |

The firmware's levers: backlight off after 20 s idle (it stays on during approvals, recording and
the game), the first touch only wakes the screen, Wi-Fi modem sleep, and heartbeats every 15 s.
Intermittent sync (disconnect Wi-Fi between check-ins, wake on the RTC or the crown) is the next
power step and is what the 1-2 day row assumes.

## Alternatives considered

| Board | Why not first |
| --- | --- |
| M5Stack Cardputer | Has a keyboard, but handheld-sized rather than watch-sized. |
| Waveshare ESP32-S3 Touch AMOLED 1.43"/1.8" | Nicer screen, but no PMU-integrated watch case or haptics out of the box. |
| LilyGO T-Watch S3 Plus | Adds GPS and a thicker case; nothing this client needs. |
