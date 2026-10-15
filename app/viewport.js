// Pure view maths. A viewport is {x, y, k, kFit}: grid pixel (gx, gy) sits at CSS pixel
// (x + gx * k, y + gy * k) of the stage, so x and y are the screen offset of the grid's corner.
// render.js owns the state and calls these; none of them touch the DOM.

import { discOffsets, unproject } from "./model.js";

export const MAX_K = 40;
export const SINGLE_PIXEL_K = 14;
export const BUTTON_ZOOM = 1.8;
export const KEY_PAN = 80;

const EM_DASH = "—";

/**
 * Screen pixels per grid pixel at which the whole world fits the stage.
 * @param {{w: number, h: number}} stage Stage size in CSS pixels.
 * @param {number} n Grid side.
 * @returns {number}
 */
export function fitScale(stage, n) {
  return Math.min(stage.w, stage.h) / n;
}

// A world smaller than the stage is centred; a larger one may not leave the stage.
function clampAxis(offset, side, stageSide) {
  if (side <= stageSide) return (stageSide - side) / 2;
  return Math.min(0, Math.max(stageSide - side, offset));
}

/**
 * Limits zoom to [kFit, MAX_K] and keeps the world on the stage.
 * @param {{x: number, y: number, k: number}} vp
 * @param {{w: number, h: number}} stage
 * @param {number} n Grid side.
 * @returns {{x: number, y: number, k: number, kFit: number}}
 */
export function clampViewport(vp, stage, n) {
  const kFit = fitScale(stage, n);
  const k = Math.min(Math.max(vp.k, kFit), Math.max(MAX_K, kFit));
  const side = n * k;
  return { x: clampAxis(vp.x, side, stage.w), y: clampAxis(vp.y, side, stage.h), k, kFit };
}

/**
 * The view that shows the whole world.
 * @param {{w: number, h: number}} stage
 * @param {number} n
 * @returns {{x: number, y: number, k: number, kFit: number}}
 */
export function homeViewport(stage, n) {
  return clampViewport({ x: 0, y: 0, k: fitScale(stage, n) }, stage, n);
}

/**
 * Multiplies the zoom by `factor`, keeping the grid point under (sx, sy) where it is.
 * @param {{x: number, y: number, k: number}} vp
 * @param {number} factor
 * @param {number} sx CSS pixels from the stage's left edge.
 * @param {number} sy CSS pixels from the stage's top edge.
 * @param {{w: number, h: number}} stage
 * @param {number} n
 * @returns {{x: number, y: number, k: number, kFit: number}}
 */
export function zoomViewport(vp, factor, sx, sy, stage, n) {
  const kFit = fitScale(stage, n);
  const k = Math.min(Math.max(vp.k * factor, kFit), Math.max(MAX_K, kFit));
  const gx = (sx - vp.x) / vp.k;
  const gy = (sy - vp.y) / vp.k;
  return clampViewport({ x: sx - gx * k, y: sy - gy * k, k }, stage, n);
}

/**
 * Moves the view by screen pixels, so content follows a dragging pointer.
 * @param {{x: number, y: number, k: number}} vp
 * @param {number} dx
 * @param {number} dy
 * @param {{w: number, h: number}} stage
 * @param {number} n
 * @returns {{x: number, y: number, k: number, kFit: number}}
 */
export function panViewport(vp, dx, dy, stage, n) {
  return clampViewport({ x: vp.x + dx, y: vp.y + dy, k: vp.k }, stage, n);
}

/**
 * Keeps the grid point at the stage centre fixed when the stage changes size; a view that
 * showed the whole world keeps showing it.
 * @param {{x: number, y: number, k: number, kFit: number}} vp
 * @param {{w: number, h: number}} before Previous stage size.
 * @param {{w: number, h: number}} after New stage size.
 * @param {number} n
 * @returns {{x: number, y: number, k: number, kFit: number}}
 */
export function resizeViewport(vp, before, after, n) {
  if (after.w <= 0 || after.h <= 0) return vp;
  if (before.w <= 0 || before.h <= 0 || !(vp.k > 0)) return homeViewport(after, n);
  const centreX = (before.w / 2 - vp.x) / vp.k;
  const centreY = (before.h / 2 - vp.y) / vp.k;
  const showedWorld = vp.k <= fitScale(before, n) * (1 + 1e-9);
  const k = showedWorld ? fitScale(after, n) : vp.k;
  return clampViewport({ x: after.w / 2 - centreX * k, y: after.h / 2 - centreY * k, k }, after, n);
}

/**
 * The grid pixel under a stage point. Coordinates are clamped to the grid; `inside` says whether
 * the point was on the map.
 * @param {{x: number, y: number, k: number}} vp
 * @param {number} sx
 * @param {number} sy
 * @param {number} n
 * @returns {{x: number, y: number, inside: boolean}}
 */
export function screenToGrid(vp, sx, sy, n) {
  if (!(vp.k > 0)) return { x: 0, y: 0, inside: false };
  const gx = Math.floor((sx - vp.x) / vp.k);
  const gy = Math.floor((sy - vp.y) / vp.k);
  const inside = gx >= 0 && gy >= 0 && gx < n && gy < n;
  return { x: Math.min(n - 1, Math.max(0, gx)), y: Math.min(n - 1, Math.max(0, gy)), inside };
}

/**
 * Opacity of a mark that fades in as the zoom ratio z rises from `from` to `to`.
 * @param {number} z Zoom relative to the whole-world view.
 * @param {number} from
 * @param {number} to
 * @returns {number} 0 to 1.
 */
export function fadeFactor(z, from, to) {
  return Math.min(1, Math.max(0, (z - from) / (to - from)));
}

/**
 * The two footer strings for the pointer pixel.
 * @param {{x: number, y: number} | null} pixel Null when the pointer is off the map.
 * @param {{k: number, kFit: number}} vp
 * @param {number} n
 * @returns {{coord: string, zoom: string}}
 */
export function readoutText(pixel, vp, n) {
  const zoom = vp.k >= SINGLE_PIXEL_K ? "single pixels" : `${(vp.k / vp.kFit).toFixed(1)}x`;
  if (!pixel) return { coord: EM_DASH, zoom };
  const { lon, lat } = unproject(pixel.x + 0.5, pixel.y + 0.5, n);
  const ns = `${Math.abs(lat).toFixed(1)}${lat >= 0 ? "N" : "S"}`;
  const ew = `${Math.abs(lon).toFixed(1)}${lon >= 0 ? "E" : "W"}`;
  return { coord: `${ns} ${ew}  x ${pixel.x}, y ${pixel.y}`, zoom };
}

const outlines = new Map();

function brushCells(diameter) {
  const offsets = discOffsets(diameter);
  const cells = new Set();
  for (let k = 0; k < offsets.length; k += 2) cells.add(`${offsets[k]},${offsets[k + 1]}`);
  return cells;
}

/**
 * Edge segments around the cells a brush paints, in cell units relative to the centre cell's corner.
 * @param {number} diameter
 * @returns {number[][]} Segments as [x0, y0, x1, y1].
 */
export function brushOutline(diameter) {
  const cached = outlines.get(diameter);
  if (cached) return cached;
  const cells = brushCells(diameter);
  const edges = [];
  for (const key of cells) {
    const [x, y] = key.split(",").map(Number);
    if (!cells.has(`${x},${y - 1}`)) edges.push([x, y, x + 1, y]);
    if (!cells.has(`${x},${y + 1}`)) edges.push([x, y + 1, x + 1, y + 1]);
    if (!cells.has(`${x - 1},${y}`)) edges.push([x, y, x, y + 1]);
    if (!cells.has(`${x + 1},${y}`)) edges.push([x + 1, y, x + 1, y + 1]);
  }
  outlines.set(diameter, edges);
  return edges;
}
