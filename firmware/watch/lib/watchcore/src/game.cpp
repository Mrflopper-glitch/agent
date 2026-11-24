#include "game.h"

#include <algorithm>
#include <string>

namespace watch {

namespace {
constexpr int kPlayerY = 900;
constexpr int kHit = 60;
}  // namespace

uint32_t DodgeGame::next() {
  rng_ ^= rng_ << 13;
  rng_ ^= rng_ >> 17;
  rng_ ^= rng_ << 5;
  return rng_;
}

void DodgeGame::reset() {
  lane_ = kLanes / 2;
  score_ = 0;
  ticks_ = 0;
  over_ = false;
  blocks_.clear();
}

void DodgeGame::tap(int x, int width) {
  if (over_) {
    reset();
    return;
  }
  lane_ += x < width / 2 ? -1 : 1;
  lane_ = std::max(0, std::min(kLanes - 1, lane_));
}

void DodgeGame::step() {
  if (over_) return;
  ticks_++;
  int spawnEvery = std::max(8, 24 - score_ / 5);
  if (ticks_ % spawnEvery == 0) blocks_.push_back({static_cast<int>(next() % kLanes), 0});
  int speed = 15 + score_ / 2;
  for (auto& b : blocks_) b.y += speed;
  size_t before = blocks_.size();
  blocks_.erase(std::remove_if(blocks_.begin(), blocks_.end(), [](const Block& b) { return b.y > 1000; }),
                blocks_.end());
  score_ += static_cast<int>(before - blocks_.size());
  for (const auto& b : blocks_) {
    if (b.lane == lane_ && b.y > kPlayerY - kHit && b.y < kPlayerY + kHit) over_ = true;
  }
}

void DodgeGame::render(Canvas& c, int top, int height) const {
  int w = c.width();
  int laneW = w / kLanes;
  c.fillRect(0, top, w, height, color::kBg);
  for (const auto& b : blocks_) {
    int y = top + b.y * height / 1000;
    c.fillRect(b.lane * laneW + 6, y - 10, laneW - 12, 20, color::kAccent);
  }
  int py = top + kPlayerY * height / 1000;
  c.fillRoundRect(lane_ * laneW + 8, py - 6, laneW - 16, 12, 4, color::kFg);
  std::string label = over_ ? "game over " + std::to_string(score_) + " - tap" : std::to_string(score_);
  c.text(6, top + 4, label, over_ ? color::kBad : color::kDim);
}

}  // namespace watch
