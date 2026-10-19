// Pure grid maths for the crest maker. A crest is a handful of heraldic choices (shield shape, field
// division, ordinary, charge) plus five palette colours. renderCrest turns the choices into a
// Uint8Array(CREST_W * CREST_H) of palette indexes (0 is white, as in a flag), row-major, TRANSPARENT outside the shield, so
// flagdesigner.js can stamp it onto a flag grid and pngexport.js can draw it. The choices, not the
// cells, are what the map file stores (mapfile.js), so a saved crest stays editable. flagcells.js
// stamps the result onto a flag.

export const CREST_W = 12;
export const CREST_H = 14;
/** Cell value outside the shield. The palette holds at most 254 colours, so 255 never collides with one. */
export const TRANSPARENT = 255;

const CELL_COUNT = CREST_W * CREST_H;
const COLOUR_KEYS = ["field", "field2", "ordinaryColour", "chargeColour", "outline"];
const CHOICE_KEYS = ["shape", "division", "ordinary", "charge"];

const fromRows = (rows) => (x, y) => rows[y][x] === "#";

const HEATER = [
  "############",
  "############",
  "############",
  "############",
  "############",
  ".##########.",
  ".##########.",
  ".##########.",
  "..########..",
  "..########..",
  "...######...",
  "...######...",
  "....####....",
  ".....##.....",
];
const FRENCH = [
  "############",
  "############",
  "############",
  "############",
  "############",
  "############",
  "############",
  "############",
  "############",
  ".##########.",
  ".##########.",
  "..########..",
  "...######...",
  "....####....",
];

/** Shield outlines. `has(x, y)` is true for a cell inside the shield. */
export const SHAPES = [
  { id: "heater", label: "Heater", has: fromRows(HEATER) },
  { id: "french", label: "French", has: fromRows(FRENCH) },
  {
    id: "oval",
    label: "Oval",
    has: (x, y) => ((x + 0.5 - CREST_W / 2) / (CREST_W / 2)) ** 2 + ((y + 0.5 - CREST_H / 2) / (CREST_H / 2)) ** 2 <= 1,
  },
  {
    id: "lozenge",
    label: "Lozenge",
    has: (x, y) => Math.abs(x + 0.5 - CREST_W / 2) / (CREST_W / 2) + Math.abs(y + 0.5 - CREST_H / 2) / (CREST_H / 2) <= 1.12,
  },
];

// Position inside the crest box as fractions from the centre, -0.5 to 0.5.
const fractions = (x, y) => ({ u: (x + 0.5) / CREST_W - 0.5, v: (y + 0.5) / CREST_H - 0.5 });

/** Field divisions. `second(x, y)` is true where the field takes its second colour. */
export const DIVISIONS = [
  { id: "plain", label: "Plain", second: () => false },
  { id: "pale", label: "Per pale", second: (x, y) => fractions(x, y).u > 0 },
  { id: "fess", label: "Per fess", second: (x, y) => fractions(x, y).v > 0 },
  { id: "bend", label: "Per bend", second: (x, y) => fractions(x, y).u > fractions(x, y).v },
  { id: "bend-sinister", label: "Per bend sinister", second: (x, y) => fractions(x, y).u > -fractions(x, y).v },
  { id: "quarterly", label: "Quarterly", second: (x, y) => fractions(x, y).u > 0 !== fractions(x, y).v > 0 },
  { id: "saltire", label: "Per saltire", second: (x, y) => Math.abs(fractions(x, y).u) > Math.abs(fractions(x, y).v) },
];

/** Ordinaries, the bold bars laid over the field. `has(x, y, edge)` is true where the ordinary is drawn; `edge(x, y)` is true on the shield's rim ring. */
export const ORDINARIES = [
  { id: "none", label: "None", has: () => false },
  { id: "cross", label: "Cross", has: (x, y) => (x === 5 || x === 6 || y === 6 || y === 7) },
  {
    id: "saltire",
    label: "Saltire",
    has: (x, y) => {
      const { u, v } = fractions(x, y);
      return Math.abs(Math.abs(u) - Math.abs(v)) < 0.1;
    },
  },
  { id: "pale", label: "Pale", has: (x) => x >= 4 && x <= 7 },
  { id: "fess", label: "Fess", has: (x, y) => y >= 5 && y <= 8 },
  {
    id: "bend",
    label: "Bend",
    has: (x, y) => {
      const { u, v } = fractions(x, y);
      return Math.abs(u - v) < 0.17;
    },
  },
  {
    id: "chevron",
    label: "Chevron",
    has: (x, y) => {
      const top = 3 + (Math.abs(x + 0.5 - CREST_W / 2) - 0.5) * 0.9;
      return y >= top && y < top + 3;
    },
  },
  { id: "chief", label: "Chief", has: (x, y) => y < 4 },
  { id: "bordure", label: "Bordure", has: (x, y, edge) => edge(x, y) },
];

const charge = (id, label, rows) => ({ id, label, rows, w: rows[0].length, h: rows.length });

/** Charges, the small emblems at the centre of the shield, as hand-set bitmaps with an even width so they centre exactly. */
export const CHARGES = [
  charge("none", "None", [""]),
  charge("star", "Star", [
    "...##...",
    "#..##..#",
    ".######.",
    "..####..",
    "..####..",
    ".######.",
    "#..##..#",
    "...##...",
  ]),
  charge("crescent", "Crescent", [
    "#......#",
    "##....##",
    "##....##",
    ".##..##.",
    "..####..",
    "...##...",
  ]),
  charge("fleur", "Fleur-de-lis", [
    "...##...",
    "..####..",
    "#.####.#",
    "########",
    ".#.##.#.",
    "...##...",
    "..####..",
    "..#..#..",
  ]),
  charge("castle", "Castle", [
    "#.#..#.#",
    "########",
    ".######.",
    ".#.##.#.",
    ".######.",
    ".##..##.",
    ".##..##.",
    ".##..##.",
  ]),
  charge("crown", "Crown", [
    "#..##..#",
    "##.##.##",
    "########",
    "########",
    "########",
    ".######.",
  ]),
  charge("sword", "Sword", [
    "..##..",
    "..##..",
    "..##..",
    "..##..",
    "..##..",
    "######",
    "..##..",
    "..##..",
  ]),
  charge("tree", "Tree", [
    "..####..",
    ".######.",
    "########",
    "########",
    ".######.",
    "...##...",
    "...##...",
    "...##...",
  ]),
  charge("heart", "Heart", [
    ".##..##.",
    "########",
    "########",
    ".######.",
    "..####..",
    "...##...",
  ]),
  charge("anchor", "Anchor", [
    "...##...",
    "..#..#..",
    "...##...",
    ".######.",
    "...##...",
    "#..##..#",
    ".#.##.#.",
    "..####..",
  ]),
  charge("roundel", "Roundel", [
    ".####.",
    "######",
    "######",
    "######",
    "######",
    ".####.",
  ]),
];

function pick(list, id, what) {
  const found = list.find((entry) => entry.id === id);
  if (!found) throw new RangeError(`unknown ${what} "${id}"`);
  return found;
}

function assertColour(v, key) {
  if (!Number.isInteger(v) || v < 0 || v > 254) throw new RangeError(`${key} must be a palette index 0-254, got ${v}`);
}

/**
 * The starting crest: a plain heater shield in the chosen colour, with a white star.
 * @param {number} colour palette index of the field
 * @param {number} colour2 palette index of the second field colour
 * @returns {{shape: string, division: string, ordinary: string, charge: string, field: number, field2: number, ordinaryColour: number, chargeColour: number, outline: number}}
 */
export function defaultCrest(colour, colour2) {
  return {
    shape: SHAPES[0].id,
    division: "plain",
    ordinary: "none",
    charge: "star",
    field: colour,
    field2: colour2,
    ordinaryColour: 0,
    chargeColour: 0,
    outline: colour,
  };
}

/**
 * Checks a crest's choices and returns a clean copy of them, or null when anything is wrong.
 * @param {unknown} raw
 * @param {number} paletteLength colours the map holds; every colour must be 0 (white) or within 1..paletteLength
 * @returns {object | null}
 */
export function normaliseCrest(raw, paletteLength) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const lists = { shape: SHAPES, division: DIVISIONS, ordinary: ORDINARIES, charge: CHARGES };
  const clean = {};
  for (const key of CHOICE_KEYS) {
    if (!lists[key].some((entry) => entry.id === raw[key])) return null;
    clean[key] = raw[key];
  }
  for (const key of COLOUR_KEYS) {
    const v = raw[key];
    if (!Number.isInteger(v) || v < 0 || v > paletteLength) return null;
    clean[key] = v;
  }
  return clean;
}

// Cells of the shield that touch the outside; they take the outline colour whatever is drawn beneath.
function rimOf(inside) {
  const rim = new Uint8Array(CELL_COUNT);
  for (let y = 0; y < CREST_H; y++) {
    for (let x = 0; x < CREST_W; x++) {
      if (!inside[y * CREST_W + x]) continue;
      const open = (nx, ny) => nx < 0 || ny < 0 || nx >= CREST_W || ny >= CREST_H || !inside[ny * CREST_W + nx];
      if (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1)) rim[y * CREST_W + x] = 1;
    }
  }
  return rim;
}

// The ring of cells just inside the rim, which the bordure ordinary fills.
function ringInside(inside, rim) {
  const ring = new Uint8Array(CELL_COUNT);
  for (let y = 0; y < CREST_H; y++) {
    for (let x = 0; x < CREST_W; x++) {
      const i = y * CREST_W + x;
      if (!inside[i] || rim[i]) continue;
      const touchesRim = (x > 0 && rim[i - 1]) || (x < CREST_W - 1 && rim[i + 1]) || (y > 0 && rim[i - CREST_W]) || (y < CREST_H - 1 && rim[i + CREST_W]);
      if (touchesRim) ring[i] = 1;
    }
  }
  return ring;
}

/**
 * Draws a crest: field and division, then the ordinary, then the charge, then the outline on top so
 * the shield edge always stays clean.
 * @param {{shape: string, division: string, ordinary: string, charge: string, field: number, field2: number, ordinaryColour: number, chargeColour: number, outline: number}} crest
 * @returns {Uint8Array} CREST_W * CREST_H palette indexes; TRANSPARENT outside the shield.
 */
export function renderCrest(crest) {
  for (const key of COLOUR_KEYS) assertColour(crest[key], key);
  const shape = pick(SHAPES, crest.shape, "shield shape");
  const division = pick(DIVISIONS, crest.division, "division");
  const ordinary = pick(ORDINARIES, crest.ordinary, "ordinary");
  const emblem = pick(CHARGES, crest.charge, "charge");

  const inside = new Uint8Array(CELL_COUNT);
  for (let y = 0; y < CREST_H; y++) {
    for (let x = 0; x < CREST_W; x++) inside[y * CREST_W + x] = shape.has(x, y) ? 1 : 0;
  }
  const rim = rimOf(inside);
  const ring = ringInside(inside, rim);
  const edge = (x, y) => ring[y * CREST_W + x] === 1;

  const cells = new Uint8Array(CELL_COUNT).fill(TRANSPARENT);
  const set = (x, y, v) => {
    if (x >= 0 && y >= 0 && x < CREST_W && y < CREST_H && inside[y * CREST_W + x]) cells[y * CREST_W + x] = v;
  };
  for (let y = 0; y < CREST_H; y++) {
    for (let x = 0; x < CREST_W; x++) {
      if (!inside[y * CREST_W + x]) continue;
      cells[y * CREST_W + x] = division.second(x, y) ? crest.field2 : crest.field;
      if (ordinary.has(x, y, edge)) cells[y * CREST_W + x] = crest.ordinaryColour;
    }
  }
  if (emblem.w) {
    const left = (CREST_W - emblem.w) / 2;
    // Sits above the middle because every shield narrows toward the bottom.
    const top = Math.max(1, Math.floor((CREST_H - emblem.h) / 2) - 2);
    emblem.rows.forEach((row, dy) => {
      for (let dx = 0; dx < emblem.w; dx++) {
        if (row[dx] === "#") set(left + dx, top + dy, crest.chargeColour);
      }
    });
  }
  for (let i = 0; i < CELL_COUNT; i++) {
    if (rim[i]) cells[i] = crest.outline;
  }
  return cells;
}
