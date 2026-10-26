from shapes import Grid
g = Grid()
# bearskin: tall cap, wider at the crown, with a plume
g.poly([(8.5, 11), (9.2, 4.5), (11, 2.2), (15.5, 2.2), (18.5, 4.5), (19.5, 11)])
g.line([(14, 2.6), (14.6, 0.2)], 1.8)                    # plume
# face, neck, collar
g.poly([(11, 11.5), (18, 11.5), (18.6, 15), (17, 17.2), (12, 17.2), (10.8, 15)])
g.poly([(10, 17), (18, 17), (19, 19), (9, 19)])
# coat: shoulders, chest, waist
g.poly([(7, 19), (21, 19), (21.5, 24), (19.5, 33), (8.5, 33), (6.5, 24)])
# coat tails
g.poly([(8, 33), (19.5, 33), (21, 45), (14.9, 41), (13.1, 41), (7, 45)])
g.erase(lambda x, y: 38 < y < 46 and 13.4 < x < 14.6)
# legs and gaiters
g.poly([(8.5, 44), (13.2, 44), (13.2, 55), (8.5, 55)])
g.poly([(14.8, 44), (19.8, 44), (20, 55), (14.8, 55)])
g.poly([(7, 55), (13.2, 55), (13.2, 59), (6, 59)])
g.poly([(14.8, 55), (21, 55), (22.4, 59), (14.8, 59)])
# musket held upright at the right, with bayonet
g.line([(24.5, 4), (24.5, 57)], 1.9)
g.line([(24.5, 2), (24.5, 8)], 1.0)
g.poly([(22.4, 48), (26.6, 48), (26.9, 58), (22.2, 58)])    # butt end
# arm across to the musket
g.line([(19, 21), (22, 27), (24.4, 29.5)], 4.2, 3.4)
g.ellipse(24.5, 30, 1.9, 1.9)
# near arm hangs at the side
g.line([(7.5, 21), (6.2, 30), (7.5, 36)], 3.6, 3.0)
# detail: crossbelts, plate, eye, moustache, buttons, gaiter tops
for i in range(0, 12):
    g.put(8 + i, 20 + i, "o"); g.put(19 - i, 20 + i, "o")
g.put(16, 14, "e"); g.put(17, 16, "o"); g.put(16, 16, "o")
for y in (7, 8, 9): g.put(18, y, "o")                      # brass plate
for p in [(13, 24), (13, 26), (13, 28)]: pass
for x in range(8, 14): g.put(x, 51, "o")
for x in range(15, 20): g.put(x, 51, "o")
for p in [(9,3),(10,2),(18,3),(19,5),(9,6),(8,9)]: g.erase(lambda x,y,p=p: int(x)==p[0] and int(y)==p[1])   # ragged fur
for p in [(9,10),(19,10),(8,8),(20,8),(8,6),(20,6)]: g.put(*p)
g.put(14, 1, "o"); g.put(14, 2, "o")
for y in range(44, 56): g.put(13, y, "."); 
print(g.text())
