"""Rasteriser for the 4096 x 4096 map grid, shared by the base-map and scenario builders.

The projection must stay identical to `project` in app/model.js: the browser looks up a
clicked longitude/latitude in the grids these functions write.
"""

import math

N = 4096
MAX_LAT = 85.0511

Ring = list[tuple[float, float]]


def project(lon: float, lat: float) -> tuple[float, float]:
    """Longitude/latitude to fractional grid coordinates; a pixel centre sits at +0.5."""
    phi = math.radians(max(-MAX_LAT, min(MAX_LAT, lat)))
    x = (lon + 180) / 360 * N
    y = (1 - math.log(math.tan(math.pi / 4 + phi / 2)) / math.pi) / 2 * N
    return x, y


def pixel_at(lon: float, lat: float) -> tuple[int, int]:
    """The grid pixel holding a longitude/latitude, clamped onto the grid."""
    x, y = project(lon, lat)
    return max(0, min(N - 1, math.floor(x))), max(0, min(N - 1, math.floor(y)))


def _bit_table(op: str, bit: int) -> bytes:
    if op == "or":
        return bytes(b | bit for b in range(256))
    return bytes(b & ~bit & 0xFF for b in range(256))


def fill_polygon(grid: bytearray, rings: list[Ring], value: int, op: str = "set") -> None:
    """Fills the inside of `rings` (lon/lat pairs) into `grid`, even-odd, so a ring inside another is a hole.

    A pixel is inside when its centre is. `op` is "set" (write `value`), "or" (turn on the
    bits in `value`) or "clear" (turn them off). A ring running past longitude +/-180
    wraps round to the other edge instead of streaking across the map. Rings are closed
    implicitly.
    """
    projected = [[project(lon, lat) for lon, lat in ring] for ring in rings if len(ring) >= 3]
    if not projected:
        return
    min_x = min(x for ring in projected for x, _ in ring)
    max_x = max(x for ring in projected for x, _ in ring)
    crossings = _row_crossings(projected)
    table = None if op == "set" else _bit_table(op, value)
    shifts = [s for s in (-N, 0, N) if min_x + s < N and max_x + s > 0]
    for row in sorted(crossings):
        xs = sorted(crossings[row])
        base = row * N
        for shift in shifts:
            for left, right in zip(xs[0::2], xs[1::2]):
                start = max(0, math.ceil(left + shift - 0.5))
                end = min(N, math.ceil(right + shift - 0.5))
                if end <= start:
                    continue
                if table is None:
                    grid[base + start : base + end] = bytes([value]) * (end - start)
                else:
                    grid[base + start : base + end] = grid[base + start : base + end].translate(table)


def _row_crossings(rings: list[Ring]) -> dict[int, list[float]]:
    """For each pixel row, the x where polygon edges cross that row's centre line."""
    crossings: dict[int, list[float]] = {}
    for ring in rings:
        for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
            if y0 == y1:
                continue
            first = max(0, math.ceil(min(y0, y1) - 0.5))
            last = min(N - 1, math.ceil(max(y0, y1) - 0.5) - 1)
            slope = (x1 - x0) / (y1 - y0)
            for row in range(first, last + 1):
                crossings.setdefault(row, []).append(x0 + (row + 0.5 - y0) * slope)
    return crossings


def draw_line(grid: bytearray, x0: int, y0: int, x1: int, y1: int, bit: int) -> None:
    """Turns on `bit` along a one-pixel Bresenham line between two pixels; pixels off the grid are skipped."""
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    step_x = 1 if x0 < x1 else -1
    step_y = 1 if y0 < y1 else -1
    error = dx + dy
    while True:
        if 0 <= x0 < N and 0 <= y0 < N:
            grid[y0 * N + x0] |= bit
        if x0 == x1 and y0 == y1:
            return
        doubled = 2 * error
        if doubled >= dy:
            error += dy
            x0 += step_x
        if doubled <= dx:
            error += dx
            y0 += step_y
