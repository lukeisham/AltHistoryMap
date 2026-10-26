import math
from shapes import Grid
g = Grid()
cx, cy = 17.5, 11
pts = []
for i, ang in enumerate(range(100, 350, 17)):
    r = 10.4 if i % 2 == 0 else 7.4
    pts.append((cx + r * math.cos(math.radians(ang)), cy - r * math.sin(math.radians(ang))))
pts += [(cx + 5, cy + 8), (cx + 8, cy - 3)]
g.poly(pts)
g.ellipse(17, 19, 7, 6.5)                    # mane down the chest
g.ellipse(21.5, 10.5, 5.2, 5.4)              # face
g.ellipse(26.2, 12.8, 3.6, 2.4)                # muzzle
g.line([(17, 20), (12, 31)], 10, 7.5)        # torso, leaning back
g.ellipse(10.5, 36.5, 7.2, 7)                # haunch
g.line([(13, 40), (19, 45), (15.5, 54)], 6.2, 3.8)   # near hind leg, knee forward
g.ellipse(18, 56.8, 4.6, 1.9)
g.line([(7, 40), (3.5, 48), (5.5, 55)], 5.4, 3.6)    # far hind leg
g.ellipse(8, 57.2, 3.8, 1.7)
g.line([(19, 21), (24.5, 18.5)], 4.6, 3.8)   # raised foreleg
g.ellipse(27.2, 17.8, 2.5, 2.5)
g.line([(16, 28), (24, 27)], 4.6, 3.8)       # lower foreleg
g.ellipse(27.2, 27, 2.5, 2.3)
g.line([(5, 38), (1.8, 32), (1.8, 25), (4.8, 19)], 2.4, 2.0)   # tail
g.ellipse(6, 16.5, 2.8, 3.8, 20)
g.put(23, 8, "e"); g.put(28, 12, "o"); g.put(27, 14, "o"); g.put(26, 14, "o"); g.put(25, 14, "o")
for p in [(12, 14), (11, 17), (12, 20), (13, 23)]: g.put(*p, "o")      # mane strands
for p in [(17, 31), (16, 33)]: g.put(*p, "o")
g.ellipse(20.5, 4.6, 1.5, 1.6)                  # ear
for y in range(7, 15): g.put(16 + (1 if y in (9,10,11,12) else 0), y, "o")   # face edge against the mane
for p in [(29,16),(29,18),(29,26),(29,28)]: g.put(*p, ".")                   # claws
for p in [(28,16),(28,18),(28,26),(28,28)]: g.put(*p, "o")
print(g.text())
