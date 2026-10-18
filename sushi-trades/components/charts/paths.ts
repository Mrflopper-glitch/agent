/**
 * Turns a list of numbers into SVG path strings.
 * The highest value touches the top (plus padding), the lowest touches the bottom.
 */
export function chartPaths(values: number[], width: number, height: number, pad = 2, domain?: [number, number]) {
  const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  const span = max - min || 1;
  const points = values.map((value, i) => ({
    x: values.length > 1 ? (i / (values.length - 1)) * width : width / 2,
    y: pad + (1 - (value - min) / span) * (height - pad * 2),
  }));
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("");
  const area = `${line}L${width},${height}L0,${height}Z`;
  return { line, area, points };
}
