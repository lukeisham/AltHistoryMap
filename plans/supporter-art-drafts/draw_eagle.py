from shapes import Grid
g = Grid()
left = [(12, 35), (5, 32), (1.5, 25), (0.6, 15), (1.8, 7), (3.8, 12), (4.6, 4), (6.6, 11), (8.2, 3.6), (9.4, 11), (9.6, 20), (12, 26)]
g.poly(left)
g.poly([(30 - x + (1.2 if x > 9 and y < 22 else 0), y) for x, y in left])
g.ellipse(15, 12.5, 3.7, 4.0)                               # head
g.poly([(17.2, 10.2), (22.6, 13.4), (21.6, 15.0), (17.4, 15.8)])          # hooked beak
g.line([(15, 15), (15, 24)], 4.6)                           # neck
g.ellipse(15, 33, 6.4, 9.5)                                 # body
g.poly([(10, 42), (20, 42), (23.5, 53), (15, 57), (6.5, 53)])  # tail fan
g.line([(11.2, 42), (9, 49)], 3.2)                          # thighs
g.line([(18.8, 42), (21, 49)], 3.2)
g.line([(9, 49), (8, 55)], 2.4); g.line([(21, 49), (22, 55)], 2.4)
for cx in (8, 22):                                          # talons
    g.poly([(cx - 3.4, 58), (cx - 2.4, 54.4), (cx + 2.4, 54.4), (cx + 3.4, 58), (cx + 1.6, 56.6), (cx, 58.2), (cx - 1.6, 56.6)])
g.put(17, 11, "e"); g.put(21, 14, "o"); g.put(20, 13, "o")
for y in (28, 31, 34, 37):                                  # breast feathers
    for x in (11, 14, 17):
        g.put(x, y, "o"); g.put(x + 1, y + 1, "o")
for k in range(5):                                          # wing feather lines
    g.put(2 + k, 14 + k * 3, "o"); g.put(3 + k, 14 + k * 3, "o")
    g.put(27 - k, 14 + k * 3, "o"); g.put(26 - k, 14 + k * 3, "o")
for x in (12, 15, 18): g.put(x, 49, "o"); g.put(x, 52, "o")
print(g.text())
