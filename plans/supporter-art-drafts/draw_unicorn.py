from shapes import Grid
g = Grid()
g.line([(24, 6), (27.6, 0.4)], 2.0, 0.9)                # horn
g.ellipse(23.6, 10.6, 5.8, 3.3, 38)                     # head
g.ellipse(26.8, 13.6, 2.4, 2.0, 38)                     # muzzle
g.line([(16.5, 19), (21, 11.5)], 7.5, 5.6)              # neck
for i, (x, y) in enumerate([(14, 10), (12, 13), (12, 17), (11, 21), (12, 25)]):
    g.ellipse(x + 1.5, y, 2.6, 2.0, 25)                 # mane tufts down the neck
g.line([(17, 21), (11.5, 32)], 10.5, 8.5)               # chest and belly
g.ellipse(9.5, 37, 6.6, 7)                              # haunch
g.line([(18.5, 23), (23.5, 25.5), (26.5, 31)], 3.8, 2.8)    # raised foreleg, bent
g.ellipse(27, 32, 1.7, 1.5)
g.line([(17, 29), (22, 32.5), (22.5, 39)], 3.8, 2.8)         # lower foreleg
g.ellipse(22.7, 40, 1.8, 1.5)
g.line([(11, 41), (15, 48), (13, 55)], 5.0, 3.0)             # near hind leg
g.ellipse(14.4, 57, 3.2, 1.5)
g.line([(6.5, 42), (4, 49), (6.5, 55)], 4.4, 3.0)            # far hind leg
g.ellipse(8.2, 57, 3.0, 1.5)
g.line([(4.2, 35), (1.6, 40), (2.2, 47), (4.6, 51)], 2.8, 2.2)   # tail
g.ellipse(5.2, 53.2, 2.6, 3.0, -25)
g.put(24, 9, "e"); g.put(26, 12, "o"); g.put(28, 14, "o")
for p in [(18, 14), (17, 16), (16, 18)]: g.put(*p, "o")
print(g.text())
