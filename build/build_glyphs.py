"""Turns the chosen Lucide SVGs in build/source/lucide/ into app/glyphs.js, one path string per symbol.

Every shape element becomes path data, and the shapes are joined into a single string so the
browser can draw a glyph with one `new Path2D(d)` call.
"""

import json
import math
import re
import sys
from pathlib import Path
from xml.etree import ElementTree

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "source" / "lucide"
OUTPUT = HERE.parent / "app" / "glyphs.js"
SVG_NS = "{http://www.w3.org/2000/svg}"

# (Lucide file, glyph id, label); the order here is the order of the symbol picker.
GLYPH_SET: list[tuple[str, str, str]] = [
    ("crown", "crown", "Crown"),
    ("shield", "shield", "Shield"),
    ("star", "star", "Star"),
    ("castle", "fortress", "Fortress"),
    ("swords", "swords", "Crossed swords"),
    ("flame", "flame", "Flame"),
    ("skull", "skull", "Skull"),
    ("anchor", "anchor", "Anchor"),
    ("ship", "ship", "Ship"),
    ("coins", "coins", "Coins"),
    ("wheat", "wheat", "Wheat"),
    ("pickaxe", "pickaxe", "Pickaxe"),
    ("gem", "gem", "Gem"),
    ("mountain", "mountain", "Mountain"),
    ("tree-deciduous", "tree", "Tree"),
    ("tent", "tent", "Tent"),
    ("church", "church", "Church"),
    ("landmark", "temple", "Temple"),
    ("scroll", "scroll", "Scroll"),
]

NUMBER = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")


def _num(value: float) -> str:
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def _attr(element: ElementTree.Element, name: str, default: float = 0.0) -> float:
    return float(element.get(name, default))


def _points(element: ElementTree.Element) -> list[tuple[float, float]]:
    values = [float(v) for v in NUMBER.findall(element.get("points", ""))]
    return list(zip(values[0::2], values[1::2]))


def _ellipse_path(cx: float, cy: float, rx: float, ry: float) -> str:
    return (
        f"M{_num(cx - rx)} {_num(cy)}"
        f"A{_num(rx)} {_num(ry)} 0 1 0 {_num(cx + rx)} {_num(cy)}"
        f"A{_num(rx)} {_num(ry)} 0 1 0 {_num(cx - rx)} {_num(cy)}Z"
    )


def _rect_path(element: ElementTree.Element) -> str:
    x, y = _attr(element, "x"), _attr(element, "y")
    w, h = _attr(element, "width"), _attr(element, "height")
    rx = _attr(element, "rx", _attr(element, "ry"))
    ry = _attr(element, "ry", rx)
    rx, ry = min(rx, w / 2), min(ry, h / 2)
    if not rx and not ry:
        return f"M{_num(x)} {_num(y)}H{_num(x + w)}V{_num(y + h)}H{_num(x)}Z"
    arc = f"A{_num(rx)} {_num(ry)} 0 0 1 "
    return (
        f"M{_num(x + rx)} {_num(y)}H{_num(x + w - rx)}{arc}{_num(x + w)} {_num(y + ry)}"
        f"V{_num(y + h - ry)}{arc}{_num(x + w - rx)} {_num(y + h)}"
        f"H{_num(x + rx)}{arc}{_num(x)} {_num(y + h - ry)}"
        f"V{_num(y + ry)}{arc}{_num(x + rx)} {_num(y)}Z"
    )


def _polyline_path(points: list[tuple[float, float]], close: bool) -> str:
    if not points:
        return ""
    head, *rest = points
    path = f"M{_num(head[0])} {_num(head[1])}" + "".join(f"L{_num(x)} {_num(y)}" for x, y in rest)
    return path + ("Z" if close else "")


def _shape_path(element: ElementTree.Element) -> str:
    tag = element.tag.removeprefix(SVG_NS)
    if tag == "path":
        d = element.get("d", "").strip()
        # A leading relative `m` is only absolute when the path stands alone; after another
        # shape it would offset from that shape's last point.
        return "M0 0" + d if d.startswith("m") else d
    if tag == "line":
        return f"M{_num(_attr(element, 'x1'))} {_num(_attr(element, 'y1'))}L{_num(_attr(element, 'x2'))} {_num(_attr(element, 'y2'))}"
    if tag in ("polyline", "polygon"):
        return _polyline_path(_points(element), close=tag == "polygon")
    if tag == "circle":
        r = _attr(element, "r")
        return _ellipse_path(_attr(element, "cx"), _attr(element, "cy"), r, r)
    if tag == "ellipse":
        return _ellipse_path(_attr(element, "cx"), _attr(element, "cy"), _attr(element, "rx"), _attr(element, "ry"))
    if tag == "rect":
        return _rect_path(element)
    sys.exit(f"unsupported SVG element <{tag}>")


def svg_to_path(svg_text: str) -> str:
    """One path string for every drawable shape in an SVG, in document order."""
    root = ElementTree.fromstring(svg_text)
    shapes = [_shape_path(el) for el in root.iter() if el is not root and el.tag.removeprefix(SVG_NS) != "g"]
    return "".join(shape for shape in shapes if shape)


# Plain shapes drawn filled in the marker's colour; the box is the same 24 units as the Lucide set.
SHAPE_CENTRE = 12.0
SHAPE_RADIUS = 10.0
STAR_INNER_RATIO = 0.42


def _polygon_path(points: list[tuple[float, float]]) -> str:
    return "".join(f"{'M' if i == 0 else 'L'}{_num(x)} {_num(y)}" for i, (x, y) in enumerate(points)) + "Z"


def _regular(sides: int, centre_y: float = SHAPE_CENTRE) -> str:
    """A regular polygon with a vertex at the top."""
    angles = [-math.pi / 2 + 2 * math.pi * i / sides for i in range(sides)]
    return _polygon_path([(SHAPE_CENTRE + SHAPE_RADIUS * math.cos(a), centre_y + SHAPE_RADIUS * math.sin(a)) for a in angles])


def _star(points: int = 5) -> str:
    vertices = []
    for i in range(points * 2):
        radius = SHAPE_RADIUS if i % 2 == 0 else SHAPE_RADIUS * STAR_INNER_RATIO
        angle = -math.pi / 2 + math.pi * i / points
        vertices.append((SHAPE_CENTRE + radius * math.cos(angle), SHAPE_CENTRE + 0.5 + radius * math.sin(angle)))
    return _polygon_path(vertices)


# (glyph id, label, path); they follow the Lucide symbols in the picker.
SHAPE_SET: list[tuple[str, str, str]] = [
    ("shape-square", "Square", "M4 4H20V20H4Z"),
    ("shape-circle", "Circle", _ellipse_path(12, 12, 9, 9)),
    ("shape-triangle", "Triangle", _polygon_path([(12, 3), (21.5, 20), (2.5, 20)])),
    ("shape-diamond", "Diamond", _polygon_path([(12, 2), (22, 12), (12, 22), (2, 12)])),
    ("shape-pentagon", "Pentagon", _regular(5, centre_y=12.5)),
    ("shape-hexagon", "Hexagon", _regular(6)),
    ("shape-star", "Solid star", _star()),
    ("shape-cross", "Cross", "M9 3H15V9H21V15H15V21H9V15H3V9H9Z"),
]

def build_glyphs() -> list[dict]:
    glyphs = []
    for file_name, glyph_id, label in GLYPH_SET:
        path = SOURCE / f"{file_name}.svg"
        try:
            svg_text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            sys.exit(f"Lucide icon {file_name!r} is not in {SOURCE}")
        glyphs.append({"id": glyph_id, "label": label, "path": svg_to_path(svg_text)})
    glyphs.extend({"id": glyph_id, "label": label, "path": path, "solid": True} for glyph_id, label, path in SHAPE_SET)
    return glyphs


def render_module(glyphs: list[dict]) -> str:
    entries = ",\n".join(f"  {json.dumps(glyph)}" for glyph in glyphs)
    return (
        "/**\n"
        " * Preset symbols for the Symbol tool. Generated by build/build_glyphs.py from Lucide icons.\n"
        " * `path` is SVG path data on a 24 x 24 box: `new Path2D(path)`. A Lucide symbol is drawn as a 2-unit\n"
        " * round-capped stroke on a disc; a `solid` shape is drawn filled in the marker's colour.\n"
        " * @type {{id: string, label: string, path: string, solid?: boolean}[]}\n"
        " */\n"
        f"export const GLYPHS = [\n{entries},\n];\n"
    )


def main() -> None:
    glyphs = build_glyphs()
    OUTPUT.write_text(render_module(glyphs), encoding="utf-8")
    print(f"wrote {OUTPUT} ({len(glyphs)} glyphs)")


if __name__ == "__main__":
    main()
