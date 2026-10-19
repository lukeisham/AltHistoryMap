// Pure grid maths for the crest maker. A crest is a handful of heraldic choices (shield shape, field
// division, ordinary, charge, and an animal supporter on each side) plus the palette colours that
// paint them. renderCrest turns the choices into a Uint8Array(CREST_W * CREST_H) of palette indexes
// (0 is white, as in a flag), row-major, TRANSPARENT wherever nothing is drawn, so flagdesigner.js
// can stamp it onto a flag grid and pngexport.js can draw it. The choices, not the cells, are what
// the map file stores (mapfile.js), so a saved crest stays editable. flagcells.js stamps the result
// onto a flag.

import { SUPPORTERS, SUPPORTER_W, SUPPORTER_H, EYE, rasterSupporter } from "./supporters.js";

export { SUPPORTERS };

/** The shield alone: the crest's centre, between the two supporters. */
export const SHIELD_W = 24;
export const SHIELD_H = 28;
/** Where the shield's top-left cell sits in the crest. Low and between the supporters, so their heads stand clear above it and their forepaws rest against its sides. */
export const SHIELD_X = 17;
export const SHIELD_Y = 11;
export const CREST_W = 58;
export const CREST_H = 40;
/** Cell value where nothing is drawn. The palette holds at most 254 colours, so 255 never collides with one. */
export const TRANSPARENT = 255;

const CELL_COUNT = CREST_W * CREST_H;
const SHIELD_COUNT = SHIELD_W * SHIELD_H;
const COLOUR_KEYS = ["field", "field2", "ordinaryColour", "chargeColour", "outline"];
const CHOICE_KEYS = ["shape", "division", "ordinary", "charge"];

// Position inside the shield as fractions from its centre, -0.5 to 0.5.
const fractions = (x, y) => ({ u: (x + 0.5) / SHIELD_W - 0.5, v: (y + 0.5) / SHIELD_H - 0.5 });

// Whether a cell lies within the shield's half-width at its height; `halfWidth(v)` is 0 to 1 for v from 0 (top) to 1 (point).
const profile = (halfWidth) => (x, y) => {
  const { u } = fractions(x, y);
  return Math.abs(u) * 2 <= halfWidth((y + 0.5) / SHIELD_H);
};

/** Shield outlines. `has(x, y)` is true for a cell inside the shield. */
export const SHAPES = [
  // Straight top, sides curving in to a point.
  { id: "heater", label: "Heater", has: profile((v) => (v < 0.38 ? 1 : (1 - ((v - 0.38) / 0.62) ** 1.6) ** 0.62)) },
  // Straight sides, a rounded base with a short point.
  { id: "french", label: "French", has: profile((v) => (v < 0.62 ? 1 : Math.max(0, 1 - ((v - 0.62) / 0.38) ** 2.1) ** 0.8)) },
  { id: "oval", label: "Oval", has: (x, y) => (2 * fractions(x, y).u) ** 2 + (2 * fractions(x, y).v) ** 2 <= 1 },
  { id: "lozenge", label: "Lozenge", has: (x, y) => Math.abs(fractions(x, y).u) + Math.abs(fractions(x, y).v) <= 0.56 },
];

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
  { id: "cross", label: "Cross", has: (x, y) => Math.abs(fractions(x, y).u) < 0.09 || Math.abs(fractions(x, y).v) < 0.075 },
  {
    id: "saltire",
    label: "Saltire",
    has: (x, y) => {
      const { u, v } = fractions(x, y);
      return Math.abs(Math.abs(u) - Math.abs(v)) < 0.1;
    },
  },
  { id: "pale", label: "Pale", has: (x, y) => Math.abs(fractions(x, y).u) < 0.17 },
  { id: "fess", label: "Fess", has: (x, y) => Math.abs(fractions(x, y).v) < 0.13 },
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
      const top = 6 + (Math.abs(x + 0.5 - SHIELD_W / 2) - 1) * 0.9;
      return y >= top && y < top + 6;
    },
  },
  { id: "chief", label: "Chief", has: (x, y) => y < SHIELD_H * 0.29 },
  { id: "bordure", label: "Bordure", has: (x, y, edge) => edge(x, y) },
];

// Each hand-set bitmap row is drawn twice across and down, so the emblem fills the larger shield.
const enlarge = (rows) => rows.flatMap((row) => {
  const wide = [...row].map((cell) => cell + cell).join("");
  return [wide, wide];
});
const charge = (id, label, rows) => {
  const big = rows[0] === "" ? [""] : enlarge(rows);
  return { id, label, rows: big, w: big[0].length, h: big.length };
};

/** Charges, the emblems at the centre of the shield, as hand-set bitmaps with an even width so they centre exactly. */
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
 * The starting crest: a plain heater shield in the chosen colour, with a white star, a white lion each side.
 * @param {number} colour palette index of the field
 * @param {number} colour2 palette index of the second field colour
 * @returns {{shape: string, division: string, ordinary: string, charge: string, supporterLeft: string, supporterRight: string, field: number, field2: number, ordinaryColour: number, chargeColour: number, supporterLeftColour: number, supporterRightColour: number, outline: number}}
 */
export function defaultCrest(colour, colour2) {
  return {
    shape: SHAPES[0].id,
    division: "plain",
    ordinary: "none",
    charge: "star",
    supporterLeft: "lion",
    supporterRight: "lion",
    field: colour,
    field2: colour2,
    ordinaryColour: 0,
    chargeColour: 0,
    supporterLeftColour: 0,
    supporterRightColour: 0,
    outline: colour,
  };
}

/**
 * Checks a crest's choices and returns a clean copy of them, or null when anything is wrong. A crest
 * with no supporters recorded (made before supporters existed) comes back with none.
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
  for (const side of ["Left", "Right"]) {
    const animal = raw[`supporter${side}`] ?? "none";
    const colour = raw[`supporter${side}Colour`] ?? clean.chargeColour;
    if (!SUPPORTERS.some((entry) => entry.id === animal)) return null;
    if (!Number.isInteger(colour) || colour < 0 || colour > paletteLength) return null;
    clean[`supporter${side}`] = animal;
    clean[`supporter${side}Colour`] = colour;
  }
  return clean;
}

// Cells of a shape that touch the outside; they take the outline colour whatever is drawn beneath.
function rimOf(inside, cols, rows) {
  const rim = new Uint8Array(inside.length);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!inside[y * cols + x]) continue;
      const open = (nx, ny) => nx < 0 || ny < 0 || nx >= cols || ny >= rows || !inside[ny * cols + nx];
      if (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1)) rim[y * cols + x] = 1;
    }
  }
  return rim;
}

// The ring of cells just inside the rim, which the bordure ordinary fills.
function ringInside(inside, rim) {
  const ring = new Uint8Array(SHIELD_COUNT);
  for (let y = 0; y < SHIELD_H; y++) {
    for (let x = 0; x < SHIELD_W; x++) {
      const i = y * SHIELD_W + x;
      if (!inside[i] || rim[i]) continue;
      const touchesRim = (x > 0 && rim[i - 1]) || (x < SHIELD_W - 1 && rim[i + 1]) || (y > 0 && rim[i - SHIELD_W]) || (y < SHIELD_H - 1 && rim[i + SHIELD_W]);
      if (touchesRim) ring[i] = 1;
    }
  }
  return ring;
}

// The shield on its own: field and division, then the ordinary, then the charge, then the outline on top so the shield edge always stays clean.
function renderShield(crest) {
  const shape = pick(SHAPES, crest.shape, "shield shape");
  const division = pick(DIVISIONS, crest.division, "division");
  const ordinary = pick(ORDINARIES, crest.ordinary, "ordinary");
  const emblem = pick(CHARGES, crest.charge, "charge");

  const inside = new Uint8Array(SHIELD_COUNT);
  for (let y = 0; y < SHIELD_H; y++) {
    for (let x = 0; x < SHIELD_W; x++) inside[y * SHIELD_W + x] = shape.has(x, y) ? 1 : 0;
  }
  const rim = rimOf(inside, SHIELD_W, SHIELD_H);
  const ring = ringInside(inside, rim);
  const edge = (x, y) => ring[y * SHIELD_W + x] === 1;

  const cells = new Uint8Array(SHIELD_COUNT).fill(TRANSPARENT);
  const set = (x, y, v) => {
    if (x >= 0 && y >= 0 && x < SHIELD_W && y < SHIELD_H && inside[y * SHIELD_W + x]) cells[y * SHIELD_W + x] = v;
  };
  for (let y = 0; y < SHIELD_H; y++) {
    for (let x = 0; x < SHIELD_W; x++) {
      if (!inside[y * SHIELD_W + x]) continue;
      cells[y * SHIELD_W + x] = division.second(x, y) ? crest.field2 : crest.field;
      if (ordinary.has(x, y, edge)) cells[y * SHIELD_W + x] = crest.ordinaryColour;
    }
  }
  if (emblem.w) {
    const left = (SHIELD_W - emblem.w) / 2;
    // Sits above the middle because every shield narrows toward the bottom.
    const top = Math.max(2, Math.floor((SHIELD_H - emblem.h) / 2) - 4);
    emblem.rows.forEach((row, dy) => {
      for (let dx = 0; dx < emblem.w; dx++) {
        if (row[dx] === "#") set(left + dx, top + dy, crest.chargeColour);
      }
    });
  }
  for (let i = 0; i < SHIELD_COUNT; i++) {
    if (rim[i]) cells[i] = crest.outline;
  }
  return cells;
}

// One supporter painted into the crest, facing the shield: its silhouette in its own colour, the rim and the eye in the outline colour.
function paintSupporter(cells, animalId, colour, outline, side) {
  if (animalId === "none") return;
  const mask = rasterSupporter(animalId);
  const rim = rimOf(mask, SUPPORTER_W, SUPPORTER_H);
  const left = side === "left" ? 0 : CREST_W - SUPPORTER_W;
  for (let y = 0; y < SUPPORTER_H; y++) {
    for (let x = 0; x < SUPPORTER_W; x++) {
      const i = y * SUPPORTER_W + x;
      if (!mask[i]) continue;
      // The left animal faces right as drawn; the right one is its mirror image.
      const cx = left + (side === "left" ? x : SUPPORTER_W - 1 - x);
      cells[y * CREST_W + cx] = mask[i] === EYE || rim[i] ? outline : colour;
    }
  }
}

/**
 * Draws a crest: the two supporters, then the shield over them so the shield edge always stays clean.
 * @param {{shape: string, division: string, ordinary: string, charge: string, supporterLeft?: string, supporterRight?: string, field: number, field2: number, ordinaryColour: number, chargeColour: number, supporterLeftColour?: number, supporterRightColour?: number, outline: number}} crest
 * @returns {Uint8Array} CREST_W * CREST_H palette indexes; TRANSPARENT where nothing is drawn.
 */
export function renderCrest(crest) {
  for (const key of COLOUR_KEYS) assertColour(crest[key], key);
  const leftAnimal = crest.supporterLeft ?? "none";
  const rightAnimal = crest.supporterRight ?? "none";
  const leftColour = crest.supporterLeftColour ?? crest.chargeColour;
  const rightColour = crest.supporterRightColour ?? crest.chargeColour;
  assertColour(leftColour, "supporterLeftColour");
  assertColour(rightColour, "supporterRightColour");
  pick(SUPPORTERS, leftAnimal, "supporter");
  pick(SUPPORTERS, rightAnimal, "supporter");

  const cells = new Uint8Array(CELL_COUNT).fill(TRANSPARENT);
  paintSupporter(cells, leftAnimal, leftColour, crest.outline, "left");
  paintSupporter(cells, rightAnimal, rightColour, crest.outline, "right");
  const shield = renderShield(crest);
  for (let y = 0; y < SHIELD_H; y++) {
    for (let x = 0; x < SHIELD_W; x++) {
      const v = shield[y * SHIELD_W + x];
      if (v !== TRANSPARENT) cells[(SHIELD_Y + y) * CREST_W + SHIELD_X + x] = v;
    }
  }
  return cells;
}
