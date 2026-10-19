// The animals that stand either side of a crest's shield, as silhouettes made of simple shapes
// (tapered limbs, ellipses, polygons) in a 16 x 32 drawing box (rasterised to SUPPORTER_W x SUPPORTER_H cells), facing right toward the
// shield. rasterSupporter turns one into cells; crestcells.js mirrors it for the right-hand side and
// colours it. Shapes, not bitmaps, so a limb can be thickened or an animal tuned without redrawing cells.

export const SUPPORTER_W = 20;
export const SUPPORTER_H = 40;

// The shapes below are drawn in a 16 x 32 box; the raster is this much larger.
const DRAWN_TO_CELLS = 1.25;

/** Mask value of a cell inside the silhouette. */
export const BODY = 1;
/** Mask value of the eye; crestcells.js paints it in the outline colour. */
export const EYE = 2;

const limb = (x1, y1, x2, y2, r1, r2 = r1) => ({ kind: "limb", x1, y1, x2, y2, r1, r2 });
const blob = (cx, cy, rx, ry, degrees = 0) => ({ kind: "blob", cx, cy, rx, ry, degrees });
const poly = (...points) => ({ kind: "poly", points });

// Parts every upright four-legged animal shares, with the thickness and neck/head set per animal.
function rampant({ bulk = 1, legBulk = 1 }) {
  return [
    limb(4.5, 19.5, 4, 28.5, 2.3 * legBulk, 1.4 * legBulk),
    blob(5.2, 30.6, 2.4, 1.1),
    limb(7.8, 21, 9.2, 28.5, 2.1 * legBulk, 1.3 * legBulk),
    blob(10.2, 30.6, 2.4, 1.1),
    blob(5.5, 20, 3.5 * bulk, 3.3 * bulk),
    limb(6, 19, 10.5, 11.5, 3.3 * bulk, 2.9 * bulk),
  ];
}

const FORELEGS = (reach = 1) => [
  limb(10.5, 12.5, 14.6, 10.2, 1.9 * reach, 1.4 * reach),
  blob(15, 10, 1.4 * reach, 1.4 * reach),
  limb(10.5, 14.6, 14.8, 14.6, 1.7 * reach, 1.3 * reach),
  blob(15, 14.6, 1.2 * reach, 1.3 * reach),
];

const lion = {
  parts: [
    ...rampant({}),
    ...FORELEGS(),
    limb(10.2, 12, 11.4, 7.5, 2.6, 2.3),
    blob(10, 8.2, 3.2, 4.2),
    blob(12, 5.6, 2.5, 2.2),
    blob(14.1, 6.4, 1.6, 1.2),
    blob(10.8, 3.4, 0.9, 1),
    limb(3.2, 19, 1, 13, 1.2, 1.1),
    limb(1, 13, 1.8, 9, 1.1, 1.1),
    blob(1.8, 8, 1.5, 1.9),
  ],
  eye: [12.9, 5.3],
};

const horse = (horn) => ({
  parts: [
    ...rampant({ bulk: 0.9, legBulk: 0.7 }),
    limb(10.5, 13, 13.5, 15.2, 1.2, 1),
    limb(13.5, 15.2, 15, 12, 1, 0.9),
    limb(10.5, 12, 14, 12, 1.1, 0.9),
    limb(9.5, 13, 11, 5.8, 2.1, 1.8),
    limb(11, 5.4, 13.9, 8.6, 1.8, 1.1),
    blob(10.7, 3.4, 0.8, 1.2),
    limb(9.4, 6, 8.2, 12.5, 0.9, 0.9),
    limb(3.5, 19, 1, 24, 1.4, 0.8),
    limb(1, 24, 2.4, 29.5, 0.8, 0.6),
    ...(horn ? [limb(11.8, 3.6, 14.4, 0.2, 1, 0.3)] : []),
  ],
  eye: [12.4, 5.6],
});

const stag = {
  parts: [
    ...rampant({ bulk: 0.85, legBulk: 0.65 }),
    limb(10.5, 13, 13.4, 15.2, 1.1, 0.9),
    limb(13.4, 15.2, 14.8, 12.4, 0.9, 0.8),
    limb(10.5, 12, 14, 11.6, 1, 0.8),
    limb(9.6, 13, 11, 6.5, 2, 1.7),
    limb(11, 6, 13.8, 8.4, 1.6, 1),
    blob(10.4, 4.6, 0.8, 1.1),
    limb(3.4, 18.6, 2.6, 17, 0.9, 0.8),
    limb(10.8, 4.4, 9.6, 0.4, 0.8, 0.6),
    limb(10.8, 4.4, 14.4, 1, 0.8, 0.6),
    limb(10.3, 2.6, 7.8, 1.6, 0.6, 0.5),
    limb(12.6, 2.6, 12.4, 0.2, 0.6, 0.5),
    limb(13.2, 1.8, 15.4, 3, 0.6, 0.5),
  ],
  eye: [12.5, 6],
};

const bear = {
  parts: [
    ...rampant({ bulk: 1.3, legBulk: 1.3 }),
    ...FORELEGS(1.35),
    limb(10.4, 12, 11.4, 8.5, 3.1, 2.6),
    blob(12, 7, 2.9, 2.6),
    blob(14.4, 8.1, 1.6, 1.3),
    blob(10.4, 4.6, 1, 1),
    blob(13.2, 4.4, 1, 1),
    blob(2.6, 17.4, 1.1, 1.3),
  ],
  eye: [13, 6.4],
};

const wolf = {
  parts: [
    ...rampant({ bulk: 0.85, legBulk: 0.8 }),
    ...FORELEGS(0.9),
    limb(10, 12, 11, 7.8, 2.1, 1.8),
    limb(11, 6.8, 14.6, 8.2, 2, 0.9),
    poly([10.2, 5.6], [10.6, 2.2], [12.4, 4.6]),
    poly([12.2, 4.6], [13.4, 2.4], [13.8, 5.6]),
    limb(3.4, 19.4, 0.8, 21, 1.1, 1.3),
    limb(0.8, 21, 1.4, 26.5, 1.3, 0.8),
  ],
  eye: [12.6, 6],
};

const eagle = {
  parts: [
    blob(8.2, 19, 3.4, 6.4),
    limb(9, 14, 11, 8.8, 2.1, 1.9),
    blob(12, 6.6, 2.4, 2.2),
    poly([13.6, 5.6], [16, 7.6], [13.6, 8.8]),
    poly([7, 17.5], [0.2, 12], [0.2, 5.4], [2, 7], [2.8, 2.6], [4.6, 5.4], [5.8, 3], [6.8, 9], [9, 15]),
    poly([6.2, 24], [4.4, 31.4], [11.6, 31.4], [10.6, 24]),
    limb(7.2, 24, 6.4, 29, 1.3, 1.1),
    limb(9.6, 24, 10.6, 29, 1.3, 1.1),
    blob(6.2, 30.6, 1.8, 1),
    blob(10.8, 30.6, 1.8, 1),
  ],
  eye: [12.5, 6.3],
};

const dragon = {
  parts: [
    ...rampant({ bulk: 0.9, legBulk: 0.85 }),
    ...FORELEGS(0.9),
    limb(10, 12, 11.4, 7.6, 2, 1.6),
    limb(11.4, 6.4, 15, 7.2, 1.8, 1),
    limb(10.8, 5, 9.4, 1.6, 0.7, 0.25),
    limb(12.4, 4.8, 12, 1.2, 0.7, 0.25),
    poly([6.4, 16], [-0.4, 9.6], [1.4, 8.6], [-0.2, 4.2], [3.2, 6.4], [3.6, 1.6], [6, 5.4], [8.4, 2.2], [8.8, 12]),
    limb(3.4, 20, 0.8, 23.4, 1.2, 1),
    limb(0.8, 23.4, 2.4, 27.6, 1, 0.8),
    limb(2.4, 27.6, 5.6, 29.2, 0.8, 0.4),
  ],
  eye: [12.9, 6],
};

const griffin = {
  parts: [
    ...rampant({}),
    ...FORELEGS(),
    limb(10.2, 12, 11.2, 8, 2.3, 2),
    blob(11.8, 6.4, 2.1, 2),
    poly([13, 5.6], [15.8, 7.4], [13, 8.6]),
    poly([10.8, 4.6], [10.2, 1.6], [12.6, 4]),
    poly([6, 16.4], [0.2, 9], [1.8, 8.6], [0.6, 4.4], [3.6, 6.6], [4.4, 2.4], [6.2, 6.4], [8.2, 4], [8.6, 12.4]),
    limb(3.2, 19, 1, 14, 0.9, 0.8),
    blob(1.2, 12.4, 1.2, 1.6),
  ],
  eye: [12.6, 6],
};

/** The supporter animals, in the order the crest maker lists them. `parts` are shapes in a 16 x 32 drawing box. */
export const SUPPORTERS = [
  { id: "none", label: "None", parts: [], eye: null },
  { id: "lion", label: "Lion", ...lion },
  { id: "unicorn", label: "Unicorn", ...horse(true) },
  { id: "horse", label: "Horse", ...horse(false) },
  { id: "stag", label: "Stag", ...stag },
  { id: "bear", label: "Bear", ...bear },
  { id: "wolf", label: "Wolf", ...wolf },
  { id: "eagle", label: "Eagle", ...eagle },
  { id: "dragon", label: "Dragon", ...dragon },
  { id: "griffin", label: "Griffin", ...griffin },
];

// Squared distance from a point to the segment x1,y1 - x2,y2, with where along it the nearest point lies.
function nearestOnSegment(part, x, y) {
  const dx = part.x2 - part.x1;
  const dy = part.y2 - part.y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - part.x1) * dx + (y - part.y1) * dy) / lengthSquared));
  const px = part.x1 + t * dx - x;
  const py = part.y1 + t * dy - y;
  return { t, distance: Math.hypot(px, py) };
}

function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function covers(part, x, y) {
  switch (part.kind) {
    case "limb": {
      const { t, distance } = nearestOnSegment(part, x, y);
      return distance <= part.r1 + (part.r2 - part.r1) * t;
    }
    case "blob": {
      const angle = (part.degrees * Math.PI) / 180;
      const dx = x - part.cx;
      const dy = y - part.cy;
      const u = dx * Math.cos(angle) + dy * Math.sin(angle);
      const v = -dx * Math.sin(angle) + dy * Math.cos(angle);
      return (u / part.rx) ** 2 + (v / part.ry) ** 2 <= 1;
    }
    default:
      return insidePolygon(part.points, x, y);
  }
}

const masks = new Map();

/**
 * The silhouette of a supporter, facing right.
 * @param {string} id one of SUPPORTERS
 * @returns {Uint8Array} SUPPORTER_W * SUPPORTER_H cells: 0 outside, BODY inside, EYE at the eye. All 0 for "none".
 */
export function rasterSupporter(id) {
  const cached = masks.get(id);
  if (cached) return cached;
  const animal = SUPPORTERS.find((entry) => entry.id === id);
  if (!animal) throw new RangeError(`unknown supporter "${id}"`);
  const mask = new Uint8Array(SUPPORTER_W * SUPPORTER_H);
  for (let y = 0; y < SUPPORTER_H; y++) {
    for (let x = 0; x < SUPPORTER_W; x++) {
      if (animal.parts.some((part) => covers(part, (x + 0.5) / DRAWN_TO_CELLS, (y + 0.5) / DRAWN_TO_CELLS))) mask[y * SUPPORTER_W + x] = BODY;
    }
  }
  if (animal.eye) {
    const [ex, ey] = animal.eye;
    const eyeIndex = Math.floor(ey * DRAWN_TO_CELLS) * SUPPORTER_W + Math.floor(ex * DRAWN_TO_CELLS);
    if (mask[eyeIndex]) mask[eyeIndex] = EYE;
  }
  masks.set(id, mask);
  return mask;
}
