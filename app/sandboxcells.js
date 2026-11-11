// The Sandbox's coarse map and its conversion to a base plane. A square of cells is painted with one
// kind of ground (the start's kind); a cell left blank is the other kind, filled in when the base is made.
// Rivers are lines in cell coordinates, kept apart from the cells so they stay thin at either detail.
// No DOM: sandbox.js draws it and passes pointer positions in.

import { N, LAND, COAST, RIVER, discOffsets } from "./model.js";

export const BLANK = 0;
export const PAINTED = 1;
export const STARTS = ["ocean", "land"];
export const DETAILS = { broad: 256, fine: 1024 };
export const TOOLS = ["paint", "erase", "river"];
/** Brush diameter of each river width on the full N x N plane, in pixels. */
export const RIVER_WIDTHS = { narrow: 2, wide: 4 };

const MAX_HISTORY = 50;
const LAND_THRESHOLD = 0.5;
// An eraser narrower than this would slip between the points of a river drawn at one point a cell.
const MIN_CUT_RADIUS = 1;

/**
 * @param {"broad" | "fine"} detail
 * @returns {number} Cells along one side of the sandbox.
 */
export function sideFor(detail) {
  if (!Object.hasOwn(DETAILS, detail)) throw new RangeError(`unknown detail "${detail}"`);
  return DETAILS[detail];
}

/**
 * @param {{start: "ocean" | "land", side: number}} options `start` is the kind the brush paints; the rest is the other kind.
 * @returns {object} The grid.
 */
export function createSandboxGrid({ start, side }) {
  if (!STARTS.includes(start)) throw new RangeError(`unknown start "${start}"`);
  if (!Number.isInteger(side) || side < 2) throw new RangeError("side must be a whole number of at least 2");
  const cells = new Uint8Array(side * side);
  const undoStack = [];
  const redoStack = [];
  // Each river is {points: Float32Array of x, y pairs, width}; a river is never changed, only replaced,
  // so a history step can hold the whole list by reference.
  let rivers = [];
  let stroke = null;

  function applyStep(step, values, riverList) {
    for (let k = 0; k < step.index.length; k++) cells[step.index[k]] = values[k];
    rivers = riverList;
  }

  function push(step) {
    undoStack.push(step);
    redoStack.length = 0;
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
  }

  function setCell(i, value) {
    if (cells[i] === value) return;
    stroke.index.push(i);
    stroke.before.push(cells[i]);
    stroke.after.push(value);
    cells[i] = value;
  }

  // Drops the river points inside the disc; what is left of a river on either side stays as its own river.
  function cutRivers(x, y, diameter) {
    const limit = Math.max(diameter / 2, MIN_CUT_RADIUS) ** 2;
    const kept = [];
    let changed = false;
    for (const river of rivers) {
      const { points, width } = river;
      const pieces = [];
      let run = [];
      let cut = false;
      for (let k = 0; k < points.length; k += 2) {
        if ((points[k] - x) ** 2 + (points[k + 1] - y) ** 2 > limit) {
          run.push(points[k], points[k + 1]);
          continue;
        }
        cut = true;
        if (run.length >= 4) pieces.push({ points: Float32Array.from(run), width });
        run = [];
      }
      if (!cut) {
        kept.push(river);
        continue;
      }
      changed = true;
      if (run.length >= 4) pieces.push({ points: Float32Array.from(run), width });
      kept.push(...pieces);
    }
    if (changed) rivers = kept;
  }

  function dab(x, y, diameter) {
    if (stroke.tool === "river") {
      stroke.points.push(x, y);
      return;
    }
    if (stroke.tool === "erase") cutRivers(x, y, diameter);
    x = Math.round(x);
    y = Math.round(y);
    const offsets = discOffsets(diameter);
    for (let k = 0; k < offsets.length; k += 2) {
      const cx = x + offsets[k];
      const cy = y + offsets[k + 1];
      if (cx < 0 || cy < 0 || cx >= side || cy >= side) continue;
      const i = cy * side + cx;
      stroke.touched.push(i);
      setCell(i, stroke.value);
    }
  }

  // Blank regions that no path of blank cells connects to the edge are enclosed; a painted stroke fills them.
  function fillEnclosed() {
    const seen = new Uint8Array(side * side);
    const queue = new Int32Array(side * side);
    const neighbours = [-1, 1, -side, side];
    let tail = 0;
    for (const touched of stroke.touched) {
      const tx = touched % side;
      for (const step of neighbours) {
        const seed = touched + step;
        if (seed < 0 || seed >= side * side || (step === -1 && tx === 0) || (step === 1 && tx === side - 1)) continue;
        if (cells[seed] !== BLANK || seen[seed]) continue;
        const from = tail;
        let escapes = false;
        queue[tail++] = seed;
        seen[seed] = 1;
        for (let head = from; head < tail; head++) {
          const here = queue[head];
          const hx = here % side;
          const hy = (here - hx) / side;
          if (hx === 0 || hy === 0 || hx === side - 1 || hy === side - 1) escapes = true;
          for (const s of neighbours) {
            const next = here + s;
            if (next < 0 || next >= side * side || (s === -1 && hx === 0) || (s === 1 && hx === side - 1)) continue;
            if (cells[next] === BLANK && !seen[next]) {
              seen[next] = 1;
              queue[tail++] = next;
            }
          }
        }
        if (escapes) continue;
        for (let k = from; k < tail; k++) setCell(queue[k], PAINTED);
      }
    }
  }

  // Land is the painted kind when the start is land, and the blank kind when the start is ocean.
  function landField() {
    const land = new Uint8Array(side * side);
    const wanted = start === "land" ? PAINTED : BLANK;
    for (let i = 0; i < land.length; i++) land[i] = cells[i] === wanted ? 1 : 0;
    return land;
  }

  return {
    side,
    start,
    cells,

    /**
     * @param {"paint" | "erase" | "river"} [tool] Paint lays the start's kind of ground; erase puts blank cells
     *   back and cuts rivers; river draws a line and leaves the cells alone.
     * @param {"narrow" | "wide"} [width] The river's width; only the river tool reads it.
     */
    beginStroke(tool = "paint", width = "narrow") {
      if (!TOOLS.includes(tool)) throw new RangeError(`unknown tool "${tool}"`);
      if (!Object.hasOwn(RIVER_WIDTHS, width)) throw new RangeError(`unknown river width "${width}"`);
      stroke = { tool, width, value: tool === "erase" ? BLANK : PAINTED, index: [], before: [], after: [], touched: [], points: [], riversBefore: rivers };
    },

    /** Paints or erases one round dab centred on a cell, or adds one point to the river being drawn. */
    dab(x, y, diameter) {
      if (stroke) dab(x, y, diameter);
    },

    /** Dabs along a line, a cell apart at most, so a fast pointer leaves no gaps. */
    drag(x0, y0, x1, y1, diameter) {
      if (!stroke) return;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let s = 1; s <= steps; s++) dab(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, diameter);
    },

    /** @returns {boolean} True when the stroke changed a cell or a river. */
    endStroke() {
      if (!stroke) return false;
      const done = stroke;
      if (done.tool === "paint") fillEnclosed();
      if (done.tool === "river" && done.points.length >= 4) rivers = [...rivers, { points: Float32Array.from(done.points), width: done.width }];
      stroke = null;
      if (done.index.length === 0 && rivers === done.riversBefore) return false;
      push({ index: Uint32Array.from(done.index), before: Uint8Array.from(done.before), after: Uint8Array.from(done.after), riversBefore: done.riversBefore, riversAfter: rivers });
      return true;
    },

    /** Blanks every cell and removes every river, as one undoable step. */
    clear() {
      const index = [];
      for (let i = 0; i < cells.length; i++) if (cells[i] !== BLANK) index.push(i);
      if (index.length === 0 && rivers.length === 0) return false;
      push({ index: Uint32Array.from(index), before: new Uint8Array(index.length).fill(PAINTED), after: new Uint8Array(index.length), riversBefore: rivers, riversAfter: [] });
      cells.fill(BLANK);
      rivers = [];
      return true;
    },

    undo() {
      const step = undoStack.pop();
      if (!step) return false;
      applyStep(step, step.before, step.riversBefore);
      redoStack.push(step);
      return true;
    },

    redo() {
      const step = redoStack.pop();
      if (!step) return false;
      applyStep(step, step.after, step.riversAfter);
      undoStack.push(step);
      return true;
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    /** @returns {{points: ArrayLike<number>, width: "narrow" | "wide"}[]} Every river, the one being drawn last. */
    rivers() {
      if (stroke?.tool !== "river" || stroke.points.length < 4) return rivers;
      return [...rivers, { points: stroke.points, width: stroke.width }];
    },

    /** @returns {number} Share of the sandbox that will be land, 0 to 1. */
    landShare() {
      const land = landField();
      let count = 0;
      for (let i = 0; i < land.length; i++) count += land[i];
      return count / land.length;
    },

    /**
     * Makes the base plane: land is where the smoothed cell field reaches one half, so coasts are rounded
     * rather than blocky, every water pixel beside land carries the coast bit, and a river marks the land
     * pixels under it (the part of a river drawn over the sea is dropped).
     * @param {number} [n] Side of the plane; only tests use a size other than N.
     * @returns {Uint8Array} n * n bytes of LAND, COAST and RIVER bits.
     */
    toBase(n = N) {
      const land = landField();
      const base = new Uint8Array(n * n);
      const scale = side / n;
      const lo = new Int32Array(n);
      const hi = new Int32Array(n);
      const weight = new Float32Array(n);
      for (let p = 0; p < n; p++) {
        const at = (p + 0.5) * scale - 0.5;
        const floor = Math.floor(at);
        lo[p] = Math.max(0, Math.min(side - 1, floor));
        hi[p] = Math.max(0, Math.min(side - 1, floor + 1));
        weight[p] = at - floor;
      }
      for (let y = 0; y < n; y++) {
        const rowLo = lo[y] * side;
        const rowHi = hi[y] * side;
        const wy = weight[y];
        for (let x = 0; x < n; x++) {
          const wx = weight[x];
          const top = land[rowLo + lo[x]] * (1 - wx) + land[rowLo + hi[x]] * wx;
          const bottom = land[rowHi + lo[x]] * (1 - wx) + land[rowHi + hi[x]] * wx;
          if (top * (1 - wy) + bottom * wy >= LAND_THRESHOLD) base[y * n + x] = LAND;
        }
      }
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const i = y * n + x;
          if (base[i] & LAND) continue;
          if ((x > 0 && base[i - 1] & LAND) || (x < n - 1 && base[i + 1] & LAND) || (y > 0 && base[i - n] & LAND) || (y < n - 1 && base[i + n] & LAND)) {
            base[i] |= COAST;
          }
        }
      }
      for (const { points, width } of rivers) {
        const offsets = discOffsets(Math.max(1, Math.round((RIVER_WIDTHS[width] * n) / N)));
        const plane = (cell) => (cell + 0.5) / scale - 0.5;
        for (let k = 2; k < points.length; k += 2) {
          const x0 = plane(points[k - 2]);
          const y0 = plane(points[k - 1]);
          const x1 = plane(points[k]);
          const y1 = plane(points[k + 1]);
          const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
          for (let s = 0; s <= steps; s++) {
            const px = Math.round(x0 + ((x1 - x0) * s) / steps);
            const py = Math.round(y0 + ((y1 - y0) * s) / steps);
            for (let o = 0; o < offsets.length; o += 2) {
              const x = px + offsets[o];
              const y = py + offsets[o + 1];
              if (x < 0 || y < 0 || x >= n || y >= n) continue;
              if (base[y * n + x] & LAND) base[y * n + x] |= RIVER;
            }
          }
        }
      }
      return base;
    },
  };
}
