"""Render ASCII supporter art ('#' body, 'o' line, 'e' eye) to a PNG sheet with an outline rim."""
import sys, pathlib
from PIL import Image, ImageDraw

W, H, S = 30, 60, 8
BODY, LINE, RIM, BG, EYE = (214, 170, 60), (96, 62, 14), (30, 20, 8), (244, 241, 232), (255, 255, 255)

def load(path):
    rows = [r.rstrip("\n").ljust(W, ".")[:W] for r in pathlib.Path(path).read_text().splitlines() if r.strip() != "" or True]
    rows = (rows + ["." * W] * H)[:H]
    return rows

def draw(rows, flip=False):
    img = Image.new("RGB", (W * S, H * S), BG)
    d = ImageDraw.Draw(img)
    cells = {(x, y): c for y, r in enumerate(rows) for x, c in enumerate(r) if c != "."}
    for (x, y) in cells:
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx, y+dy) not in cells and 0 <= x+dx < W and 0 <= y+dy < H:
                d.rectangle([(x+dx)*S, (y+dy)*S, (x+dx+1)*S-1, (y+dy+1)*S-1], fill=RIM)
    for (x, y), c in cells.items():
        d.rectangle([x*S, y*S, (x+1)*S-1, (y+1)*S-1], fill={"#": BODY, "o": LINE, "e": EYE}[c])
    return img

if __name__ == "__main__":
    names = sys.argv[2:]
    imgs = [draw(load(n)) for n in names]
    sheet = Image.new("RGB", (len(imgs) * (W * S + 20) + 20, H * S + 40), BG)
    for i, im in enumerate(imgs):
        sheet.paste(im, (20 + i * (W * S + 20), 20))
    sheet.save(sys.argv[1])
