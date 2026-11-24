#include "wrap.h"

namespace watch {
namespace {

// Length of the UTF-8 sequence starting at byte c, so wrapping never splits a code point.
size_t utf8Len(unsigned char c) {
  if (c < 0x80) return 1;
  if ((c >> 5) == 0x6) return 2;
  if ((c >> 4) == 0xE) return 3;
  if ((c >> 3) == 0x1E) return 4;
  return 1;
}

void breakWord(const Canvas& canvas, const std::string& word, int maxWidth, int size,
               std::vector<std::string>& out, std::string& line) {
  size_t i = 0;
  while (i < word.size()) {
    size_t n = utf8Len(static_cast<unsigned char>(word[i]));
    std::string next = line + word.substr(i, n);
    if (!line.empty() && canvas.textWidth(next, size) > maxWidth) {
      out.push_back(line);
      line.clear();
      continue;
    }
    line = next;
    i += n;
  }
}

}  // namespace

std::vector<std::string> wrapText(const Canvas& canvas, const std::string& text, int maxWidth, int size) {
  std::vector<std::string> out;
  size_t start = 0;
  while (start <= text.size()) {
    size_t end = text.find('\n', start);
    if (end == std::string::npos) end = text.size();
    std::string para = text.substr(start, end - start);
    std::string line;
    size_t pos = 0;
    while (pos < para.size()) {
      while (pos < para.size() && para[pos] == ' ') pos++;
      size_t wend = para.find(' ', pos);
      if (wend == std::string::npos) wend = para.size();
      if (wend == pos) break;
      std::string word = para.substr(pos, wend - pos);
      pos = wend;
      std::string candidate = line.empty() ? word : line + " " + word;
      if (canvas.textWidth(candidate, size) <= maxWidth) {
        line = candidate;
      } else if (canvas.textWidth(word, size) <= maxWidth) {
        if (!line.empty()) out.push_back(line);
        line = word;
      } else {
        if (!line.empty()) line += " ";
        breakWord(canvas, word, maxWidth, size, out, line);
      }
    }
    out.push_back(line);
    start = end + 1;
  }
  return out;
}

std::string ellipsize(const Canvas& canvas, const std::string& text, int maxWidth, int size) {
  if (canvas.textWidth(text, size) <= maxWidth) return text;
  std::string cut;
  size_t i = 0;
  while (i < text.size()) {
    size_t n = utf8Len(static_cast<unsigned char>(text[i]));
    std::string next = text.substr(0, i + n);
    if (canvas.textWidth(next + "...", size) > maxWidth) break;
    cut = next;
    i += n;
  }
  return cut + "...";
}

}  // namespace watch
