"""Smoke tests for build/build_glyphs.py and the app/glyphs.js it wrote."""

import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "build"))
import build_glyphs  # noqa: E402


class GlyphsTest(unittest.TestCase):
    def test_unique_glyphs_with_paths_and_eight_solid_shapes(self) -> None:
        glyphs = build_glyphs.build_glyphs()
        self.assertEqual(len(glyphs), 27)
        self.assertEqual(len({g["id"] for g in glyphs}), 27)
        for glyph in glyphs:
            self.assertRegex(glyph["path"], r"^M[-\d.]")
            self.assertGreater(len(glyph["label"]), 0)
        solid = [g["id"] for g in glyphs if g.get("solid")]
        self.assertEqual(len(solid), 8)
        self.assertEqual(solid, [g["id"] for g in glyphs[-8:]], "the shapes follow the Lucide symbols")
        for glyph in glyphs:
            if glyph.get("solid"):
                self.assertTrue(glyph["path"].endswith("Z"), "a filled shape is a closed path")

    def test_shapes_become_path_data(self) -> None:
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="2"/>'
            '<rect x="2" y="2" width="10" height="6" rx="1"/><line x1="0" y1="1" x2="3" y2="4"/>'
            '<path d="m1 2 3 4"/></svg>'
        )
        path = build_glyphs.svg_to_path(svg)
        self.assertTrue(path.startswith("M10 12A2 2 0 1 0 14 12"))
        self.assertIn("A1 1 0 0 1", path)
        self.assertIn("M0 1L3 4", path)
        self.assertTrue(path.endswith("M0 0m1 2 3 4"))

    def test_written_module_matches_the_build(self) -> None:
        text = (ROOT / "app" / "glyphs.js").read_text(encoding="utf-8")
        self.assertEqual(text, build_glyphs.render_module(build_glyphs.build_glyphs()))
        self.assertEqual(len(re.findall(r'"id":', text)), 27)


if __name__ == "__main__":
    unittest.main()
