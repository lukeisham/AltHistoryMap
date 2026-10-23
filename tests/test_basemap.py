"""Smoke tests for the built app/data/basemap.bin."""

import sys
import unittest
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "build"))
from build_basemap import COAST, LAKE, LAND, MAGIC, RIVER  # noqa: E402
from raster import N, pixel_at  # noqa: E402

BASEMAP = ROOT / "app" / "data" / "basemap.bin"


def load() -> bytes:
    data = BASEMAP.read_bytes()
    assert data[:8] == MAGIC, "wrong magic"
    return zlib.decompress(data[8:])


class BasemapTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.grid = load()

    def bits(self, lon: float, lat: float) -> int:
        x, y = pixel_at(lon, lat)
        return self.grid[y * N + x]

    def test_decompressed_length_is_the_whole_grid(self) -> None:
        self.assertEqual(len(self.grid), N * N)

    def test_land_sea_and_lake(self) -> None:
        self.assertTrue(self.bits(12.5, 41.9) & LAND, "Rome")
        self.assertFalse(self.bits(18, 35) & (LAND | LAKE), "Mediterranean")
        caspian = self.bits(50, 42)
        self.assertTrue(caspian & LAKE, "Caspian")
        self.assertFalse(caspian & LAND)
        self.assertTrue(self.bits(-87, 44) & LAKE, "Lake Michigan")

    def test_nile_has_a_river_pixel(self) -> None:
        cx, cy = pixel_at(31, 28)
        window = [self.grid[y * N + x] for y in range(cy - 4, cy + 5) for x in range(cx - 4, cx + 5)]
        self.assertTrue(any(b & RIVER for b in window))

    def test_coast_borders_land_on_the_sea_side(self) -> None:
        cx, cy = pixel_at(12.5, 41.9)
        east = [self.grid[cy * N + x] for x in range(cx, cx + 80)]
        coast_at = [i for i, b in enumerate(east) if b & COAST]
        self.assertTrue(coast_at, "a coast pixel east of Rome")
        i = coast_at[0]
        self.assertFalse(east[i] & LAND)
        self.assertTrue(east[i - 1] & LAND)

    def test_lakes_have_a_shoreline_like_the_sea_and_rivers_are_unchanged(self) -> None:
        shore = [b for b in set(self.grid) if b & LAKE and b & COAST]
        self.assertTrue(shore, "a lake pixel marked as coast")
        self.assertFalse(any(b & LAND for b in shore), "lake pixels are never land")
        self.assertFalse(self.bits(50, 42) & COAST, "the middle of the Caspian is open water")
        cx, cy = pixel_at(50, 42)
        row = [self.grid[cy * N + x] for x in range(cx - 400, cx + 400)]
        edge = next(i for i, b in enumerate(row) if b & LAKE and b & COAST)
        self.assertTrue(any(row[j] & LAND for j in (edge - 1, edge + 1)), "a lake shore pixel stands next to land")
        self.assertTrue(all(b & LAND for b in set(self.grid) if b & RIVER), "rivers sit on land as before")

    def test_river_bit_never_sits_on_water_and_seam_is_land(self) -> None:
        for b in set(self.grid):
            if b & RIVER:
                self.assertTrue(b & LAND)
        self.assertTrue(self.bits(-179.9, 66.5) & LAND, "Chukotka west of the seam")
        self.assertTrue(self.bits(179.9, 66.5) & LAND, "Chukotka east of the seam")


if __name__ == "__main__":
    unittest.main()
