"""Draws a built scenario as a 1024 x 1024 PNG so its shapes can be checked by eye.

Usage: python3 build/preview_scenario.py <id> <out.png> [political|province|culture]
Each output pixel samples the middle of a 4 x 4 block of the map. Cities show as 3 x 3 squares.
Four more numbers (lon0 lat0 lon1 lat1, west/north then east/south corner) crop and zoom in;
a small crop is enlarged in whole pixels up to about 1024 wide.
"""

import gzip
import json
import struct
import sys
import zlib
from pathlib import Path

from raster import N, project

APP = Path(__file__).resolve().parents[1] / "app"
SCENARIOS = APP / "data" / "scenarios"
BASEMAP = APP / "data" / "basemap.bin"

STEP = 4
SIZE = N // STEP
PLANE_ORDER = ("political", "culture", "province", "reserved", "border")
LAYERS = ("political", "province", "culture")

SEA = bytes((196, 214, 230))
LAND = bytes((238, 232, 214))
LAKE = bytes((170, 195, 220))
CITY = bytes((20, 20, 20))


def _read_map(scenario_id: str) -> tuple[dict, dict[str, bytes]]:
    raw = gzip.decompress((SCENARIOS / f"{scenario_id}.ahmap").read_bytes())
    (length,) = struct.unpack(">I", raw[8:12])
    header = json.loads(raw[12 : 12 + length])
    offset = 12 + length
    planes = {name: raw[offset + i * N * N : offset + (i + 1) * N * N] for i, name in enumerate(PLANE_ORDER)}
    return header, planes


def _terrain_table() -> list[bytes]:
    return [LAND if bits & 1 else LAKE if bits & 4 else SEA for bits in range(256)]


def _rgb(hex_colour: str) -> bytes:
    return bytes(int(hex_colour[i : i + 2], 16) for i in (1, 3, 5))


def _png(width: int, height: int, rows: list[bytearray]) -> bytes:
    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))

    scanlines = b"".join(b"\x00" + bytes(row) for row in rows)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(scanlines, 6))
        + chunk(b"IEND", b"")
    )


def _box(corners: list[float] | None) -> tuple[int, int, int, int, int]:
    """Pixel box (x0, y0, width, height) and sampling step for a lon/lat crop, or the whole map."""
    if corners is None:
        return 0, 0, N, N, STEP
    (x0, y0), (x1, y1) = project(corners[0], corners[1]), project(corners[2], corners[3])
    x0, x1 = sorted((max(0, int(x0)), min(N, int(x1))))
    y0, y1 = sorted((max(0, int(y0)), min(N, int(y1))))
    if x1 - x0 < 16 or y1 - y0 < 16:
        sys.exit("the crop is too small or off the map")
    step = max(1, -(-max(x1 - x0, y1 - y0) // SIZE))
    return x0, y0, x1 - x0, y1 - y0, step


def render(scenario_id: str, layer: str, corners: list[float] | None = None) -> bytes:
    header, planes = _read_map(scenario_id)
    base = zlib.decompress(BASEMAP.read_bytes()[8:])
    terrain = _terrain_table()
    colours = [SEA] + [_rgb(c) for c in header["palette"]] + [SEA] * (255 - len(header["palette"]))
    x0, y0, width, height, step = _box(corners)
    out_w, out_h = width // step, height // step
    rows: list[bytearray] = []
    for j in range(out_h):
        start = (y0 + j * step + step // 2) * N + x0 + step // 2
        end = start - step // 2 + width
        ground = [terrain[g] for g in base[start:end:step]]
        plane = planes[layer][start:end:step]
        pixels = [colours[v] if v else g for v, g in zip(plane, ground)]
        rows.append(bytearray(b"".join(pixels)))
    zoom = max(1, SIZE // max(out_w, out_h))
    if zoom > 1:
        rows = [bytearray(b"".join(row[i : i + 3] * zoom for i in range(0, len(row), 3))) for row in rows for _ in range(zoom)]
    for marker in header["markers"]:
        if marker["type"] != "city":
            continue
        cx, cy = (marker["x"] - x0) // step * zoom + zoom // 2, (marker["y"] - y0) // step * zoom + zoom // 2
        for y in range(max(0, cy - 1), min(out_h * zoom, cy + 2)):
            for x in range(max(0, cx - 1), min(out_w * zoom, cx + 2)):
                rows[y][x * 3 : x * 3 + 3] = CITY
    return _png(out_w * zoom, out_h * zoom, rows)


def main(argv: list[str]) -> None:
    usage = f"usage: preview_scenario.py <id> <out.png> [{'|'.join(LAYERS)}] [lon0 lat0 lon1 lat1]"
    if len(argv) < 2 or len(argv) > 7 or len(argv) in (4, 5, 6):
        sys.exit(usage)
    layer = argv[2] if len(argv) > 2 else "political"
    if layer not in LAYERS:
        sys.exit(usage)
    try:
        corners = [float(v) for v in argv[3:7]] if len(argv) == 7 else None
        png = render(argv[0], layer, corners)
    except ValueError:
        sys.exit(usage)
    except FileNotFoundError as error:
        sys.exit(f"missing file {error.filename}; build the scenario first")
    Path(argv[1]).write_bytes(png)
    print(f"wrote {argv[1]}")


if __name__ == "__main__":
    main(sys.argv[1:])
