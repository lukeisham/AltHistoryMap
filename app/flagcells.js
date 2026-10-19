// Pure grid maths for the flag designer. A design is a Uint8Array(FLAG_W * FLAG_H) of palette
// indexes, row-major, 0 = white. Every function returns a new array and never touches its input,
// so flagdesigner.js can keep earlier arrays as undo history without copying them again.

import { FLAG_W, FLAG_H, LEGACY_FLAG_SCALE } from "./model.js";
import { CREST_W, CREST_H, TRANSPARENT } from "./crestcells.js";

const CELL_COUNT = FLAG_W * FLAG_H;
const STARTER_KINDS = ["plain", "stripes-h", "stripes-v", "cross", "saltire"];

// Cell values are bytes: an unchecked 256 would wrap to 0 and silently turn a colour white.
function assertColour(v) {
  if (!Number.isInteger(v) || v < 0 || v > 255) throw new RangeError(`colour must be an integer 0-255, got ${v}`);
}

function assertCell(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= FLAG_W || y < 0 || y >= FLAG_H) {
    throw new RangeError(`cell (${x}, ${y}) is outside the ${FLAG_W} x ${FLAG_H} grid`);
  }
}

/**
 * An all-white design.
 * @returns {Uint8Array}
 */
export function blankCells() {
  return new Uint8Array(CELL_COUNT);
}

/**
 * A copy of the design with one cell set.
 * @param {Uint8Array} cells
 * @param {number} x column, 0 to FLAG_W - 1
 * @param {number} y row, 0 to FLAG_H - 1
 * @param {number} v palette index, 0 = white
 * @returns {Uint8Array}
 */
export function setCell(cells, x, y, v) {
  assertCell(x, y);
  assertColour(v);
  const next = new Uint8Array(cells);
  next[y * FLAG_W + x] = v;
  return next;
}

/**
 * A ready-made layout in one or two palette colours.
 * @param {"plain"|"stripes-h"|"stripes-v"|"cross"|"saltire"} kind
 * @param {number} colour palette index of the field (and outer stripes)
 * @param {number} colour2 palette index of the middle stripe, cross or saltire
 * @returns {Uint8Array}
 */
export function starterLayout(kind, colour, colour2) {
  if (!STARTER_KINDS.includes(kind)) throw new RangeError(`unknown starter layout "${kind}"`);
  assertColour(colour);
  assertColour(colour2);
  const cells = new Uint8Array(CELL_COUNT).fill(colour);
  for (let y = 0; y < FLAG_H; y++) {
    for (let x = 0; x < FLAG_W; x++) {
      if (inStarterAccent(kind, x, y)) cells[y * FLAG_W + x] = colour2;
    }
  }
  return cells;
}

// Whether a cell takes the second colour. Bands are thirds; the Nordic cross sits left of centre
// like a real one, its bars one twelfth of the flag wide; the saltire follows both diagonals.
// Positions are worked out on the 24 x 16 grid that older flags use, so a starter looks the same at any size.
function inStarterAccent(kind, x, y) {
  switch (kind) {
    case "stripes-h":
      return Math.floor((y * 3) / FLAG_H) === 1;
    case "stripes-v":
      return Math.floor((x * 3) / FLAG_W) === 1;
    case "cross": {
      const column = Math.floor(x / LEGACY_FLAG_SCALE);
      const row = Math.floor(y / LEGACY_FLAG_SCALE);
      return column === 7 || column === 8 || row === 7 || row === 8;
    }
    case "saltire": {
      const slope = (FLAG_H - 1) / (FLAG_W - 1);
      const half = 0.8 * LEGACY_FLAG_SCALE;
      return Math.abs(y - x * slope) < half || Math.abs(y - (FLAG_H - 1 - x * slope)) < half;
    }
    default:
      return false;
  }
}

/**
 * Replace the 4-connected region of equal value that holds (x, y).
 * @param {Uint8Array} cells
 * @param {number} x
 * @param {number} y
 * @param {number} v palette index to fill with
 * @returns {Uint8Array}
 */
export function floodFill(cells, x, y, v) {
  assertCell(x, y);
  assertColour(v);
  const next = new Uint8Array(cells);
  const target = next[y * FLAG_W + x];
  if (target === v) return next;
  const stack = [y * FLAG_W + x];
  while (stack.length) {
    const i = stack.pop();
    if (next[i] !== target) continue;
    next[i] = v;
    const cx = i % FLAG_W;
    if (cx > 0) stack.push(i - 1);
    if (cx < FLAG_W - 1) stack.push(i + 1);
    if (i >= FLAG_W) stack.push(i - FLAG_W);
    if (i < CELL_COUNT - FLAG_W) stack.push(i + FLAG_W);
  }
  return next;
}

function writeInPlace(cells, x, y, v, mirror) {
  cells[y * FLAG_W + x] = v;
  if (mirror) cells[y * FLAG_W + (FLAG_W - 1 - x)] = v;
}

/**
 * Write a cell and its left-right mirror.
 * @param {Uint8Array} cells
 * @param {number} x
 * @param {number} y
 * @param {number} v
 * @returns {Uint8Array}
 */
export function mirrorWrite(cells, x, y, v) {
  assertCell(x, y);
  assertColour(v);
  const next = new Uint8Array(cells);
  writeInPlace(next, x, y, v, true);
  return next;
}

/**
 * Write every cell on the straight line between two cells, so a fast drag leaves no gap.
 * @param {Uint8Array} cells
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} v palette index, 0 = white
 * @param {boolean} mirror also write the left-right mirror of each cell
 * @returns {Uint8Array}
 */
export function pencilLine(cells, x0, y0, x1, y1, v, mirror) {
  assertCell(x0, y0);
  assertCell(x1, y1);
  assertColour(v);
  const next = new Uint8Array(cells);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    writeInPlace(next, x, y, v, mirror);
    if (x === x1 && y === y1) return next;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * A flag saved at 24 x 16, scaled up to the current grid: each old cell becomes a square of cells.
 * @param {ArrayLike<number>} cells 384 palette indexes
 * @returns {Uint8Array} FLAG_W * FLAG_H palette indexes
 */
export function upscaleLegacyFlag(cells) {
  const oldW = FLAG_W / LEGACY_FLAG_SCALE;
  const next = new Uint8Array(CELL_COUNT);
  for (let y = 0; y < FLAG_H; y++) {
    for (let x = 0; x < FLAG_W; x++) {
      next[y * FLAG_W + x] = cells[Math.floor(y / LEGACY_FLAG_SCALE) * oldW + Math.floor(x / LEGACY_FLAG_SCALE)];
    }
  }
  return next;
}

/**
 * A copy of a flag grid with a crest stamped on it, centred on a cell. Transparent crest cells leave
 * the flag as it was, and any part of the crest beyond the flag's edge is dropped.
 * @param {Uint8Array} flagCells FLAG_W * FLAG_H palette indexes
 * @param {Uint8Array} crestCells CREST_W * CREST_H, as renderCrest returns
 * @param {number} cx column of the flag cell that takes the crest's centre
 * @param {number} cy row of that cell
 * @returns {Uint8Array}
 */
export function stampCrest(flagCells, crestCells, cx, cy) {
  if (flagCells.length !== FLAG_W * FLAG_H) throw new RangeError(`flag must have ${FLAG_W * FLAG_H} cells, got ${flagCells.length}`);
  if (crestCells.length !== CREST_W * CREST_H) throw new RangeError(`crest must have ${CREST_W * CREST_H} cells, got ${crestCells.length}`);
  const next = new Uint8Array(flagCells);
  const left = cx - Math.floor(CREST_W / 2);
  const top = cy - Math.floor(CREST_H / 2);
  for (let y = 0; y < CREST_H; y++) {
    for (let x = 0; x < CREST_W; x++) {
      const v = crestCells[y * CREST_W + x];
      const fx = left + x;
      const fy = top + y;
      if (v === TRANSPARENT || fx < 0 || fy < 0 || fx >= FLAG_W || fy >= FLAG_H) continue;
      next[fy * FLAG_W + fx] = v;
    }
  }
  return next;
}
