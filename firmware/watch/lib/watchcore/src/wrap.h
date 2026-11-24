#pragma once
#include <string>
#include <vector>

#include "hal.h"

namespace watch {

// Greedy word wrap measured with the canvas font; breaks long words and keeps explicit newlines.
std::vector<std::string> wrapText(const Canvas& canvas, const std::string& text, int maxWidth, int size = 1);

// Truncates to fit maxWidth, ending in "..." when cut.
std::string ellipsize(const Canvas& canvas, const std::string& text, int maxWidth, int size = 1);

}  // namespace watch
