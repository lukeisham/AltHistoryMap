"""Tiny rasteriser: build a 30x60 grid from circles, ellipses, thick lines and polygons."""
import math
W, H = 30, 60

class Grid:
    def __init__(self):
        self.g = [["."] * W for _ in range(H)]
    def put(self, x, y, c="#"):
        if 0 <= x < W and 0 <= y < H: self.g[y][x] = c
    def fill(self, test, c="#"):
        for y in range(H):
            for x in range(W):
                if test(x + .5, y + .5): self.g[y][x] = c
    def erase(self, test):
        self.fill(test, ".")
    def ellipse(self, cx, cy, rx, ry, deg=0, c="#"):
        a = math.radians(deg); ca, sa = math.cos(a), math.sin(a)
        def t(x, y):
            dx, dy = x - cx, y - cy
            u, v = dx * ca + dy * sa, -dx * sa + dy * ca
            return (u / rx) ** 2 + (v / ry) ** 2 <= 1
        self.fill(t, c)
    def line(self, pts, w1, w2=None, c="#"):
        w2 = w1 if w2 is None else w2
        segs = list(zip(pts, pts[1:]))
        n = len(segs)
        def t(x, y):
            for i, ((x1, y1), (x2, y2)) in enumerate(segs):
                dx, dy = x2 - x1, y2 - y1
                L2 = dx * dx + dy * dy or 1
                k = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / L2))
                px, py = x1 + k * dx, y1 + k * dy
                r = (w1 + (w2 - w1) * ((i + k) / n)) / 2
                if (x - px) ** 2 + (y - py) ** 2 <= r * r: return True
            return False
        self.fill(t, c)
    def poly(self, pts, c="#"):
        def t(x, y):
            inside = False
            j = len(pts) - 1
            for i in range(len(pts)):
                xi, yi = pts[i]; xj, yj = pts[j]
                if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: inside = not inside
                j = i
            return inside
        self.fill(t, c)
    def text(self):
        return "\n".join("".join(r) for r in self.g)
