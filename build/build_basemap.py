"""Builds app/data/basemap.bin from the Natural Earth GeoJSON in build/source/.

File layout: the 8 bytes AHBASE01, then zlib-compressed N*N bytes (the browser inflates it
with DecompressionStream("deflate")). Per-pixel bits: LAND 1, RIVER 2, LAKE 4, COAST 8.
Run rarely; the result ships in app/data/.
"""

import json
import sys
import zlib
from pathlib import Path

from raster import N, draw_line, fill_polygon, pixel_at

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "source"
OUTPUT = HERE.parent / "app" / "data" / "basemap.bin"
MAGIC = b"AHBASE01"

LAND = 1
RIVER = 2
LAKE = 4
COAST = 8

RIVER_MAX_RANK = 5
LAKE_MAX_RANK = 2

Rings = list[list[tuple[float, float]]]


def _features(name: str) -> list[dict]:
    path = SOURCE / f"ne_50m_{name}.geojson"
    try:
        return json.loads(path.read_text(encoding="utf-8"))["features"]
    except FileNotFoundError:
        sys.exit(f"missing source file {path}; see build/source/SOURCES.md")


def _polygons(feature: dict) -> list[Rings]:
    geometry = feature["geometry"]
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    return geometry["coordinates"]


def _land_and_inland_water(grid: bytearray) -> None:
    # Natural Earth cuts the Caspian out of the land polygons as a hole and leaves it out
    # of the lakes file, so every hole in the land is inland water.
    for feature in _features("land"):
        for rings in _polygons(feature):
            fill_polygon(grid, rings, LAND, "or")
            for hole in rings[1:]:
                fill_polygon(grid, [hole], LAKE, "or")


def _lakes(grid: bytearray, max_rank: int) -> None:
    for feature in _features("lakes"):
        if feature["properties"]["scalerank"] > max_rank:
            continue
        for rings in _polygons(feature):
            fill_polygon(grid, rings, LAKE, "or")
            fill_polygon(grid, rings, LAND, "clear")


def _rivers(grid: bytearray, max_rank: int) -> None:
    for feature in _features("rivers_lake_centerlines"):
        properties = feature["properties"]
        # A lake centreline is a label guide through open water, not a river.
        if properties["featurecla"] != "River" or properties["scalerank"] > max_rank:
            continue
        for line in feature["geometry"]["coordinates"]:
            pixels = [pixel_at(lon, lat) for lon, lat in line]
            for (x0, y0), (x1, y1) in zip(pixels, pixels[1:]):
                draw_line(grid, x0, y0, x1, y1, RIVER)


def _rivers_on_land_only(grid: bytearray) -> bytearray:
    table = bytes(b if b & LAND else b & ~RIVER & 0xFF for b in range(256))
    return grid.translate(table)


def _coast(grid: bytearray) -> None:
    """Marks every water pixel, sea or lake, with a land pixel directly left, right, above or below it."""
    land_mask = int.from_bytes(bytes([LAND]) * N, "little")
    row_mask = int.from_bytes(bytes([0xFF]) * N, "little")

    def land_row(y: int) -> int:
        if y < 0 or y >= N:
            return 0
        return int.from_bytes(grid[y * N : (y + 1) * N], "little") & land_mask

    above, here, below = 0, land_row(0), land_row(1)
    for y in range(N):
        row = int.from_bytes(grid[y * N : (y + 1) * N], "little")
        wet = ~row & land_mask
        # Land bits only reach neighbours within the row, so a shift never wraps to the next row.
        neighbours = above | below | ((here << 8) & row_mask) | (here >> 8)
        coast = neighbours & wet
        if coast:
            merged = row | (coast * COAST)
            grid[y * N : (y + 1) * N] = merged.to_bytes(N, "little")
        above, here, below = here, below, land_row(y + 2)


def build_grid(river_max_rank: int = RIVER_MAX_RANK, lake_max_rank: int = LAKE_MAX_RANK) -> bytearray:
    grid = bytearray(N * N)
    _land_and_inland_water(grid)
    _lakes(grid, lake_max_rank)
    _rivers(grid, river_max_rank)
    grid = _rivers_on_land_only(grid)
    _coast(grid)
    return grid


def write_basemap(grid: bytearray, path: Path = OUTPUT) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(MAGIC + zlib.compress(bytes(grid), 9))


def main() -> None:
    write_basemap(build_grid())
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
