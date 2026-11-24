// Interfaces the board layer implements. Everything in watchcore is plain C++ so it
// builds and is unit-tested on the host (`pio test -e native`) without hardware.
#pragma once
#include <cstddef>
#include <cstdint>
#include <string>

namespace watch {

// RGB565 colours.
namespace color {
constexpr uint16_t kBg = 0x0841;
constexpr uint16_t kFg = 0xE73C;
constexpr uint16_t kDim = 0x8C71;
constexpr uint16_t kAccent = 0xDBAA;
constexpr uint16_t kOk = 0x3DAA;
constexpr uint16_t kBad = 0xF28A;
constexpr uint16_t kPanel = 0x2124;
}  // namespace color

class Canvas {
 public:
  virtual ~Canvas() = default;
  virtual int width() const = 0;
  virtual int height() const = 0;
  virtual void fillRect(int x, int y, int w, int h, uint16_t color) = 0;
  virtual void fillRoundRect(int x, int y, int w, int h, int r, uint16_t color) = 0;
  // Draws one line of text with its top-left at (x, y). size: 1 = body, 2 = heading.
  virtual void text(int x, int y, const std::string& s, uint16_t color, int size = 1) = 0;
  virtual int textWidth(const std::string& s, int size = 1) const = 0;
  virtual int lineHeight(int size = 1) const = 0;
  // Called once per frame after drawing; a board double-buffers or pushes a sprite here.
  virtual void present() {}
};

// The relay connection. The board owns TLS, reconnects and heartbeats.
class Link {
 public:
  virtual ~Link() = default;
  virtual bool connected() const = 0;
  virtual bool sendText(const std::string& json) = 0;
  virtual bool sendBinary(const uint8_t* data, size_t len) = 0;
};

// Persistent key/value settings (NVS `Preferences` on the watch, a map in tests).
class Store {
 public:
  virtual ~Store() = default;
  virtual std::string get(const std::string& key, const std::string& fallback = "") const = 0;
  virtual void put(const std::string& key, const std::string& value) = 0;
};

// Optional board feedback.
class Haptics {
 public:
  virtual ~Haptics() = default;
  virtual void buzz(int ms) = 0;
};

}  // namespace watch
