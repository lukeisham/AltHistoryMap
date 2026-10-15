"""Smoke tests for build/raster.py."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "build"))
import raster  # noqa: E402


def square(lon0: float, lat0: float, lon1: float, lat1: float) -> list[tuple[float, float]]:
    return [(lon0, lat0), (lon1, lat0), (lon1, lat1), (lon0, lat1)]


class RasterTest(unittest.TestCase):
    def test_project_matches_mercator_corners(self) -> None:
        self.assertEqual(raster.project(-180, 85.0511)[0], 0)
        x, y = raster.project(0, 0)
        self.assertAlmostEqual(x, raster.N / 2)
        self.assertAlmostEqual(y, raster.N / 2)
        self.assertAlmostEqual(raster.project(180, -90)[1], raster.N, delta=0.01)

    def test_fill_polygon_leaves_a_hole_empty(self) -> None:
        grid = bytearray(raster.N * raster.N)
        outer = square(-20, -20, 20, 20)
        hole = square(-5, -5, 5, 5)
        raster.fill_polygon(grid, [outer, hole], 1)
        cx, cy = raster.pixel_at(0, 0)
        ox, oy = raster.pixel_at(12, 12)
        self.assertEqual(grid[cy * raster.N + cx], 0)
        self.assertEqual(grid[oy * raster.N + ox], 1)

    def test_fill_polygon_or_and_clear_touch_only_their_bit(self) -> None:
        grid = bytearray(raster.N * raster.N)
        box = square(-10, -10, 10, 10)
        raster.fill_polygon(grid, [box], 1)
        raster.fill_polygon(grid, [box], 4, "or")
        x, y = raster.pixel_at(0, 0)
        self.assertEqual(grid[y * raster.N + x], 5)
        raster.fill_polygon(grid, [box], 1, "clear")
        self.assertEqual(grid[y * raster.N + x], 4)

    def test_fill_polygon_wraps_past_the_antimeridian(self) -> None:
        grid = bytearray(raster.N * raster.N)
        raster.fill_polygon(grid, [square(170, -10, 190, 10)], 1)
        y = raster.pixel_at(0, 0)[1]
        self.assertEqual(grid[y * raster.N + raster.N - 1], 1)
        self.assertEqual(grid[y * raster.N], 1)
        self.assertEqual(grid[y * raster.N + raster.N // 2], 0)

    def test_draw_line_is_connected_and_clipped(self) -> None:
        grid = bytearray(raster.N * raster.N)
        raster.draw_line(grid, 10, 10, 60, 40, 2)
        self.assertEqual(grid[10 * raster.N + 10], 2)
        self.assertEqual(grid[40 * raster.N + 60], 2)
        self.assertEqual(sum(1 for b in grid if b), 51)
        raster.draw_line(grid, -5, -5, 3, 3, 2)
        self.assertEqual(grid[3 * raster.N + 3], 2)


if __name__ == "__main__":
    unittest.main()
