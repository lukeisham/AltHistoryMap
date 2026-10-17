"""Compiles build/scenarios/<id>.json into app/data/scenarios/<id>.ahmap, plus index.json.

The output follows the map file format the browser reads (app/mapfile.js): gzip of the magic
AHMAP001, a 4-byte big-endian header length, the JSON header, then the five planes of N*N
bytes (the fourth is reserved and stays zero). A source that breaks a rule stops the run with its file name and the place in it.

Usage: python3 build/build_scenarios.py [id ...]   (every source when no id is given)
"""

import gzip
import json
import re
import struct
import sys
import time
import zlib
from functools import cache
from pathlib import Path

from raster import N, fill_polygon, pixel_at, project

HERE = Path(__file__).resolve().parent
APP = HERE.parent / "app"
SOURCES = HERE / "scenarios"
OUTPUT = APP / "data" / "scenarios"
BASEMAP = APP / "data" / "basemap.bin"
GLYPHS_JS = APP / "glyphs.js"

MAGIC = b"AHMAP001"
BASE_MAGIC = b"AHBASE01"
SAVED_WITH = "ahm-1"
PLANE_NAMES = ("political", "culture", "province", "reserved", "border")
LAYERS = ("political", "province", "culture")
MARKER_TYPES = ("city", "flag", "label", "symbol")
STARTERS = ("plain", "stripes-h", "stripes-v", "cross", "saltire")
LAND = 1
FLAG_W, FLAG_H = 24, 16
MAX_NAME = 60
MAX_PALETTE = 16
MAX_DESIGNS = 8
MAX_RING_POINTS = 200
MAX_LAT = 85.0
BLANK_ID = "blank-world"

ID_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
HEX_PATTERN = re.compile(r"^#[0-9a-f]{6}$")
GLYPH_ID_PATTERN = re.compile(r'"id":\s*"([a-z]+)"')

TOP_KEYS = {"id", "title", "year", "note", "palette", "areas", "flagDesigns", "markers"}
AREA_KEYS = {"layer", "colour", "ring"}
STARTER_KEYS = {"starter", "colour", "colour2"}
MARKER_KEYS = {"type", "name", "lon", "lat", "colour", "glyph", "layer", "design", "capital"}


class SourceError(ValueError):
    """A scenario source breaks a rule; the message names the file and the place in it."""


# ---- validation ----


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _require(condition: bool, where: str, problem: str) -> None:
    if not condition:
        raise SourceError(f"{where}: {problem}")


def _check_keys(item: dict, allowed: set[str], where: str) -> None:
    unknown = sorted(set(item) - allowed)
    _require(not unknown, where, f"unknown key(s) {', '.join(unknown)}")


def _check_colour(value: object, palette_size: int, where: str, low: int = 1) -> None:
    ok = _is_int(value) and low <= value <= palette_size
    _require(ok, where, f"colour {value!r} must be a whole number from {low} to {palette_size} (the palette size)")


def _check_point(lon: object, lat: object, where: str) -> None:
    _require(_is_number(lon) and -180 <= lon <= 180, where, f"longitude {lon!r} must be a number from -180 to 180")
    _require(_is_number(lat) and -90 <= lat <= 90, where, f"latitude {lat!r} must be a number from -90 to 90")


def _check_area(area: object, palette_size: int, where: str) -> None:
    _require(isinstance(area, dict), where, "must be an object")
    _check_keys(area, AREA_KEYS, where)
    layer = area.get("layer")
    _require(layer in LAYERS, where, f"layer {layer!r} must be one of {', '.join(LAYERS)}")
    _require("kind" not in area and "colour2" not in area, where, f"a {layer} area takes only a colour and a ring")
    _check_colour(area.get("colour"), palette_size, f"{where}.colour", low=0)
    ring = area.get("ring")
    _require(isinstance(ring, list) and 3 <= len(ring) <= MAX_RING_POINTS, f"{where}.ring", f"needs 3 to {MAX_RING_POINTS} points")
    for index, point in enumerate(ring):
        point_where = f"{where}.ring[{index}]"
        _require(isinstance(point, list) and len(point) == 2, point_where, "must be [lon, lat]")
        _check_point(point[0], point[1], point_where)


def _check_design(design: object, palette_size: int, where: str) -> None:
    _require(isinstance(design, dict), where, "must be an object")
    if "rows" in design:
        _check_keys(design, {"rows"}, where)
        rows = design["rows"]
        _require(isinstance(rows, list) and len(rows) == FLAG_H, f"{where}.rows", f"needs exactly {FLAG_H} rows")
        for y, row in enumerate(rows):
            _require(isinstance(row, list) and len(row) == FLAG_W, f"{where}.rows[{y}]", f"needs exactly {FLAG_W} numbers")
            for x, cell in enumerate(row):
                _check_colour(cell, palette_size, f"{where}.rows[{y}][{x}]", low=0)
        return
    _check_keys(design, STARTER_KEYS, where)
    _require(design.get("starter") in STARTERS, where, f"starter {design.get('starter')!r} must be one of {', '.join(STARTERS)}")
    _check_colour(design.get("colour"), palette_size, f"{where}.colour", low=0)
    _check_colour(design.get("colour2"), palette_size, f"{where}.colour2", low=0)


def _check_marker(marker: object, palette_size: int, design_count: int, glyph_ids: set[str], where: str) -> None:
    _require(isinstance(marker, dict), where, "must be an object")
    _check_keys(marker, MARKER_KEYS, where)
    kind = marker.get("type")
    _require(kind in MARKER_TYPES, where, f"type {kind!r} must be one of {', '.join(MARKER_TYPES)}")
    name = marker.get("name")
    _require(isinstance(name, str) and 1 <= len(name) <= MAX_NAME, f"{where}.name", f"must be text of 1 to {MAX_NAME} characters")
    _check_point(marker.get("lon"), marker.get("lat"), where)
    _require(abs(marker["lat"]) < MAX_LAT, where, f"latitude {marker['lat']!r} is off the map (needs |lat| < {MAX_LAT})")
    _check_colour(marker.get("colour"), palette_size, f"{where}.colour")
    if kind == "symbol":
        glyph = marker.get("glyph")
        _require(glyph in glyph_ids, f"{where}.glyph", f"{glyph!r} is not a known glyph id")
        layer = marker.get("layer", "political")
        _require(layer in LAYERS, f"{where}.layer", f"{layer!r} must be one of {', '.join(LAYERS)}")
    else:
        _require("glyph" not in marker and "layer" not in marker, where, f"a {kind} marker takes no glyph or layer")
    if kind == "flag":
        design = marker.get("design", -1)
        ok = _is_int(design) and -1 <= design < design_count
        _require(ok, f"{where}.design", f"{design!r} must be -1 or the index of a design (0 to {design_count - 1})")
    else:
        _require("design" not in marker, where, f"a {kind} marker takes no design")
    if "capital" in marker:
        _require(kind == "city" and isinstance(marker["capital"], bool), f"{where}.capital", "only a city takes capital, and it must be true or false")


def validate(data: object, expected_id: str) -> None:
    """Raises SourceError, naming the place, when `data` is not a valid scenario source."""
    _require(isinstance(data, dict), "top level", "must be an object")
    _check_keys(data, TOP_KEYS, "top level")
    scenario_id = data.get("id")
    _require(isinstance(scenario_id, str) and ID_PATTERN.match(scenario_id) is not None, "id", f"{scenario_id!r} must be lowercase letters, digits and hyphens")
    _require(scenario_id == expected_id, "id", f"{scenario_id!r} must equal the file name {expected_id!r}")
    title = data.get("title")
    _require(isinstance(title, str) and 1 <= len(title) <= MAX_NAME, "title", f"must be text of 1 to {MAX_NAME} characters")
    year = data.get("year")
    _require(year is None or _is_int(year), "year", f"{year!r} must be a whole number or null")
    _require(isinstance(data.get("note"), str), "note", "must be text")
    palette = data.get("palette")
    _require(isinstance(palette, list) and 1 <= len(palette) <= MAX_PALETTE, "palette", f"needs 1 to {MAX_PALETTE} colours")
    for index, colour in enumerate(palette):
        _require(isinstance(colour, str) and HEX_PATTERN.match(colour) is not None, f"palette[{index}]", f"{colour!r} must be lowercase #rrggbb")
    for key in ("areas", "flagDesigns", "markers"):
        _require(isinstance(data.get(key), list), key, "must be a list")
    for index, area in enumerate(data["areas"]):
        _check_area(area, len(palette), f"areas[{index}]")
    _require(len(data["flagDesigns"]) <= MAX_DESIGNS, "flagDesigns", f"at most {MAX_DESIGNS} designs")
    for index, design in enumerate(data["flagDesigns"]):
        _check_design(design, len(palette), f"flagDesigns[{index}]")
    glyph_ids = known_glyph_ids()
    for index, marker in enumerate(data["markers"]):
        _check_marker(marker, len(palette), len(data["flagDesigns"]), glyph_ids, f"markers[{index}]")


@cache
def known_glyph_ids() -> set[str]:
    """Glyph ids the app knows, read from app/glyphs.js so the two cannot drift."""
    return set(GLYPH_ID_PATTERN.findall(GLYPHS_JS.read_text(encoding="utf-8")))


def load_source(path: Path) -> dict:
    """Reads and validates one source file; every error names the file."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SourceError(f"{path.name}: line {error.lineno}, column {error.colno}: {error.msg}") from error
    try:
        validate(data, path.stem)
    except SourceError as error:
        raise SourceError(f"{path.name}: {error}") from error
    return data


# ---- rasterising ----


@cache
def _land() -> bytes:
    """One byte per pixel, 1 where the base map has land."""
    raw = BASEMAP.read_bytes()
    if raw[: len(BASE_MAGIC)] != BASE_MAGIC:
        raise SourceError(f"{BASEMAP.name}: not a base map file")
    table = bytes(b & LAND for b in range(256))
    return zlib.decompress(raw[len(BASE_MAGIC) :]).translate(table)


def _land_masks(scratch: bytearray, ring: list[list[float]]) -> dict[int, int]:
    """For each pixel row a ring touches, an int with a 1 in every byte that is inside the ring and on land."""
    ys = [project(lon, lat)[1] for lon, lat in ring]
    first, last = max(0, int(min(ys))), min(N - 1, int(max(ys)) + 1)
    fill_polygon(scratch, [ring], 1)
    land = _land()
    masks: dict[int, int] = {}
    for row in range(first, last + 1):
        start = row * N
        inside = int.from_bytes(scratch[start : start + N], "little")
        if not inside:
            continue
        scratch[start : start + N] = bytes(N)
        covered = inside & int.from_bytes(land[start : start + N], "little")
        if covered:
            masks[row] = covered
    return masks


def _write_masks(plane: bytearray, masks: dict[int, int], value: int) -> None:
    for row, mask in masks.items():
        start = row * N
        current = int.from_bytes(plane[start : start + N], "little")
        merged = (current & ~(mask * 0xFF)) | (mask * value)
        plane[start : start + N] = merged.to_bytes(N, "little")


def _area_writes(area: dict) -> list[tuple[str, int]]:
    return [(area["layer"], area["colour"])]


def _in_accent(kind: str, x: int, y: int) -> bool:
    if kind == "stripes-h":
        return (y * 3) // FLAG_H == 1
    if kind == "stripes-v":
        return (x * 3) // FLAG_W == 1
    if kind == "cross":
        return x in (7, 8) or y in (7, 8)
    if kind == "saltire":
        slope = (FLAG_H - 1) / (FLAG_W - 1)
        return abs(y - x * slope) < 0.8 or abs(y - (FLAG_H - 1 - x * slope)) < 0.8
    return False


def starter_cells(kind: str, colour: int, colour2: int) -> list[int]:
    """The ready-made flag layout of app/flagcells.js `starterLayout`, row-major."""
    return [colour2 if _in_accent(kind, x, y) else colour for y in range(FLAG_H) for x in range(FLAG_W)]


def _design_cells(design: dict) -> list[int]:
    if "rows" in design:
        return [cell for row in design["rows"] for cell in row]
    return starter_cells(design["starter"], design["colour"], design["colour2"])


def _nation_around(political: bytearray, x: int, y: int) -> int:
    """The political colour a capital stands for, as app/model.js `nationAround`: its own pixel's, else the commonest of its four sides, else 0."""
    if political[y * N + x]:
        return political[y * N + x]
    counts: dict[int, int] = {}
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        sx, sy = x + dx, y + dy
        if 0 <= sx < N and 0 <= sy < N and political[sy * N + sx]:
            counts[political[sy * N + sx]] = counts.get(political[sy * N + sx], 0) + 1
    return min(counts, key=lambda colour: (-counts[colour], colour)) if counts else 0


def _marker_record(number: int, marker: dict, political: bytearray) -> dict:
    x, y = pixel_at(marker["lon"], marker["lat"])
    kind = marker["type"]
    capital = marker.get("capital", False)
    return {
        "id": number,
        "type": kind,
        "x": x,
        "y": y,
        "name": marker["name"],
        "colour": marker["colour"],
        "glyph": marker["glyph"] if kind == "symbol" else "",
        "design": marker.get("design", -1) if kind == "flag" else -1,
        "layer": marker.get("layer", "political") if kind == "symbol" else "political",
        "capital": capital,
        "nation": _nation_around(political, x, y) if capital else 0,
    }


def compile_scenario(data: dict) -> bytes:
    """The gzip-compressed .ahmap bytes for a validated source."""
    planes = {name: bytearray(N * N) for name in PLANE_NAMES}
    scratch = bytearray(N * N)
    for area in data["areas"]:
        masks = _land_masks(scratch, area["ring"])
        for plane, value in _area_writes(area):
            _write_masks(planes[plane], masks, value)
    header = {
        "format": 1,
        "name": data["title"],
        "origin": data["id"],
        "palette": data["palette"],
        "markers": [_marker_record(number, m, planes["political"]) for number, m in enumerate(data["markers"], start=1)],
        "flags": [_design_cells(d) for d in data["flagDesigns"]],
        "savedWith": SAVED_WITH,
    }
    header_bytes = json.dumps(header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    raw = b"".join([MAGIC, struct.pack(">I", len(header_bytes)), header_bytes, *(bytes(planes[n]) for n in PLANE_NAMES)])
    return gzip.compress(raw, compresslevel=9, mtime=0)


# ---- running ----


def build_one(source: Path, output_dir: Path = OUTPUT) -> Path:
    """Compiles one source file into `output_dir`; returns the .ahmap path."""
    data = load_source(source)
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"{data['id']}.ahmap"
    target.write_bytes(compile_scenario(data))
    return target


def index_entries(source_dir: Path = SOURCES, output_dir: Path = OUTPUT) -> list[dict]:
    """Index rows for every source that has a built file: Blank world first, then by year."""
    entries = []
    for path in sorted(source_dir.glob("*.json")):
        if not (output_dir / f"{path.stem}.ahmap").exists():
            continue
        try:
            data = load_source(path)
        except SourceError as error:
            print(f"left out of index.json: {error}", file=sys.stderr)
            continue
        entries.append({"id": data["id"], "title": data["title"], "year": data["year"], "note": data["note"]})
    entries.sort(key=lambda e: (e["id"] != BLANK_ID, e["year"] is None, e["year"] or 0, e["id"]))
    return entries


def write_index(source_dir: Path = SOURCES, output_dir: Path = OUTPUT) -> Path:
    target = output_dir / "index.json"
    target.write_text(json.dumps(index_entries(source_dir, output_dir), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return target


def main(argv: list[str]) -> None:
    sources = [SOURCES / f"{scenario_id}.json" for scenario_id in argv] or sorted(SOURCES.glob("*.json"))
    try:
        for source in sources:
            started = time.perf_counter()
            target = build_one(source)
            print(f"{target.name}: {target.stat().st_size} bytes in {time.perf_counter() - started:.1f}s")
        write_index()
    except FileNotFoundError as error:
        sys.exit(f"missing file {error.filename}")
    except SourceError as error:
        sys.exit(f"scenario source rejected: {error}")


if __name__ == "__main__":
    main(sys.argv[1:])
