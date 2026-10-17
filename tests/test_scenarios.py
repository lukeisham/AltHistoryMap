"""Smoke tests for build/build_scenarios.py and the .ahmap files it writes."""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "build"))
import build_scenarios  # noqa: E402

NODE = shutil.which("node")
ONE_MEGABYTE = 1024 * 1024
BUILT = ("blank-world", "roman-117")

READ_MAP = """
import { readFile } from "node:fs/promises";
import { decodeMap } from "%(app)s/mapfile.js";
import { GLYPHS } from "%(app)s/glyphs.js";
const data = await decodeMap(await readFile(process.argv[2]), GLYPHS.map((g) => g.id));
const province = data.planes.province;
console.log(JSON.stringify({
  name: data.name, origin: data.origin, palette: data.palette.length, markers: data.markers.length,
  designs: data.designs.length, painted: data.planes.political.some((v) => v > 0),
  provinces: province.some((v) => v > 0),
}));
"""

STARTERS = """
import { starterLayout } from "%(app)s/flagcells.js";
const kinds = ["plain", "stripes-h", "stripes-v", "cross", "saltire"];
console.log(JSON.stringify(kinds.map((k) => Array.from(starterLayout(k, 3, 5)))));
"""


def run_node(script: str, *args: str) -> str:
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "check.mjs"
        path.write_text(script % {"app": (ROOT / "app").as_uri()}, encoding="utf-8")
        result = subprocess.run([NODE, str(path), *args], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return result.stdout


class ScenariosTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.folder = tempfile.TemporaryDirectory()
        cls.output = Path(cls.folder.name)
        for scenario_id in BUILT:
            build_scenarios.build_one(build_scenarios.SOURCES / f"{scenario_id}.json", cls.output)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.folder.cleanup()

    def test_every_built_file_is_under_a_megabyte(self) -> None:
        files = list(self.output.glob("*.ahmap")) + list(build_scenarios.OUTPUT.glob("*.ahmap"))
        self.assertGreaterEqual(len(files), len(BUILT))
        for path in files:
            self.assertLess(path.stat().st_size, ONE_MEGABYTE, path.name)

    @unittest.skipIf(NODE is None, "node is not installed, so the JavaScript reader cannot be run")
    def test_the_javascript_reader_opens_python_built_files(self) -> None:
        blank = json.loads(run_node(READ_MAP, str(self.output / "blank-world.ahmap")))
        self.assertEqual((blank["name"], blank["origin"], blank["markers"], blank["painted"]), ("Blank world", "blank-world", 0, False))
        roman = json.loads(run_node(READ_MAP, str(self.output / "roman-117.ahmap")))
        self.assertEqual((roman["name"], roman["designs"], roman["painted"], roman["provinces"]), ("Roman Empire AD 117", 1, True, True))
        self.assertGreater(roman["markers"], 10)

    @unittest.skipIf(NODE is None, "node is not installed, so the JavaScript starter layouts cannot be run")
    def test_starter_layouts_match_flagcells_js(self) -> None:
        expected = json.loads(run_node(STARTERS))
        built = [build_scenarios.starter_cells(kind, 3, 5) for kind in build_scenarios.STARTERS]
        self.assertEqual(built, expected)

    def test_a_bad_source_stops_with_its_file_named(self) -> None:
        source = json.loads((build_scenarios.SOURCES / "blank-world.json").read_text(encoding="utf-8"))
        source["id"] = "bad-colour"
        source["areas"] = [{"layer": "political", "colour": 99, "ring": [[0, 0], [1, 0], [1, 1]]}]
        path = self.output / "bad-colour.json"
        path.write_text(json.dumps(source), encoding="utf-8")
        with self.assertRaises(build_scenarios.SourceError) as caught:
            build_scenarios.build_one(path, self.output)
        self.assertIn("bad-colour.json", str(caught.exception))
        self.assertIn("areas[0].colour", str(caught.exception))
        self.assertFalse((self.output / "bad-colour.ahmap").exists())


if __name__ == "__main__":
    unittest.main()
