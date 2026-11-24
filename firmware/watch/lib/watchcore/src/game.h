// Optional on-device demo: dodge the falling blocks. Runs entirely locally, no network.
#pragma once
#include <cstdint>
#include <vector>

#include "hal.h"

namespace watch {

class DodgeGame {
 public:
  explicit DodgeGame(uint32_t seed = 1) : rng_(seed ? seed : 1) {}
  void reset();
  // Tap on the left or right half moves the player one lane.
  void tap(int x, int width);
  void step();  // call at ~30 Hz
  void render(Canvas& c, int top, int height) const;
  int score() const { return score_; }
  bool over() const { return over_; }
  int lane() const { return lane_; }

  static constexpr int kLanes = 5;

  struct Block {
    int lane;
    int y;  // 0..1000 in game units, top to bottom
  };
  std::vector<Block>& blocks() { return blocks_; }

 private:
  uint32_t next();
  uint32_t rng_;
  int lane_ = kLanes / 2;
  int score_ = 0;
  int ticks_ = 0;
  bool over_ = false;
  std::vector<Block> blocks_;
};

}  // namespace watch
