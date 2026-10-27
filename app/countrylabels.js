// Country names drawn over the Political plane. findRegions works out once per paint change where
// each painted colour has room for a name; drawCountryNames sizes the name to that room at the
// current zoom and hides it when it would be unreadably small. render.js owns the cache and calls
// both from its frame; the text comes from countrydata.js, so a blank name shows the colour's own.

import { countryName } from "./countrydata.js";
import { SINGLE_PIXEL_K, fadeFactor, ZOOM_FADES } from "./viewport.js";

// The plane is read on a grid of about this many samples a side, so a 4096-pixel plane costs a million reads.
const SAMPLES_PER_SIDE = 1024;
// An area of fewer sampled cells than this cannot hold a readable name at any zoom.
const MIN_AREA_CELLS = 4;
const MIN_SIZE = 10;
const MAX_SIZE = 30;
// How much of the room the name may fill, across and down.
const FILL_WIDTH = 0.9;
const FILL_HEIGHT = 0.5;
const MEASURE_SIZE = 100;
const HALO_SHARE = 0.18;
const CULL_MARGIN = 40;

/**
 * Where each separate area of a painted political colour has room for its name: the middle of that
 * area's longest horizontal run, with the run's length and the height of the colour above and below
 * that point. An area is four-way connected on the sampling grid, and one too small to hold a name is
 * left out, so a stray pixel gets none. Colours that share a representative are one colour.
 * `largest` marks a colour's biggest area.
 * @param {Uint8Array} political n * n palette indexes, 0 unpainted
 * @param {number} n side of the plane in grid pixels
 * @param {Uint8Array} [representative] palette index -> the index its name belongs to (see `representativeColours`)
 * @returns {{colour: number, x: number, y: number, width: number, height: number, largest: boolean, tiny?: boolean}[]} grid pixels; `colour` is the representative
 */
export function findRegions(political, n, representative = null) {
  const stride = Math.max(1, Math.floor(n / SAMPLES_PER_SIDE));
  const rep = (value) => (representative ? representative[value] : value);

  const parent = [];
  const runs = [];
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };

  let previous = [];
  for (let y = 0; y < n; y += stride) {
    const current = [];
    let colour = 0;
    let start = 0;
    const close = (end) => {
      if (colour === 0) return;
      const id = runs.length;
      parent.push(id);
      runs.push({ colour, start, end, y });
      current.push(id);
    };
    for (let x = 0; x < n; x += stride) {
      const next = rep(political[y * n + x]);
      if (next === colour) continue;
      close(x);
      colour = next;
      start = x;
    }
    close(n);
    // Both lists run left to right, so one pass joins every run to the runs it touches above it.
    let above = 0;
    for (const id of current) {
      const run = runs[id];
      while (above < previous.length && runs[previous[above]].end <= run.start) above++;
      for (let k = above; k < previous.length && runs[previous[k]].start < run.end; k++) {
        if (runs[previous[k]].colour === run.colour) parent[find(id)] = find(previous[k]);
      }
    }
    previous = current;
  }

  const areas = new Map();
  runs.forEach((run, id) => {
    const root = find(id);
    const area = areas.get(root) ?? { colour: run.colour, cells: 0, longest: null, runs: [] };
    area.runs.push(run);
    area.cells += (run.end - run.start) / stride;
    if (!area.longest || run.end - run.start > area.longest.end - area.longest.start) area.longest = run;
    areas.set(root, area);
  });

  const kept = [...areas.values()].filter((area) => area.cells >= MIN_AREA_CELLS);
  const largestCells = new Map();
  for (const area of kept) largestCells.set(area.colour, Math.max(largestCells.get(area.colour) ?? 0, area.cells));

  const regions = kept.map((area) => {
    const { colour, longest } = area;
    const width = longest.end - longest.start;
    const column = Math.min(n - 1, Math.floor((longest.start + width / 2) / stride) * stride);
    let top = longest.y;
    let bottom = longest.y;
    while (top - stride >= 0 && rep(political[(top - stride) * n + column]) === colour) top -= stride;
    while (bottom + stride < n && rep(political[(bottom + stride) * n + column]) === colour) bottom += stride;
    return { colour, x: longest.start + width / 2, y: longest.y, width, height: bottom - top + stride, largest: area.cells === largestCells.get(colour) };
  });

  return [...regions, ...tinyRegions(political, n, rep, regions)];
}

// A colour whose every area is too small for the sampling grid (or too small to hold a name) would
// otherwise have no name at any zoom. It gets one region at its first pixel, flagged `tiny`, which
// drawCountryNames draws at the smallest readable size once the zoom reaches single pixels.
function tinyRegions(political, n, rep, regions) {
  const named = new Set(regions.map((region) => region.colour));
  const found = new Map();
  for (let i = 0; i < political.length; i++) {
    const colour = political[i] === 0 ? 0 : rep(political[i]);
    if (colour !== 0 && !named.has(colour) && !found.has(colour)) found.set(colour, i);
  }
  return [...found].map(([colour, i]) => {
    const y = Math.floor(i / n);
    let start = i % n;
    let end = start + 1;
    while (start > 0 && rep(political[y * n + start - 1]) === colour) start--;
    while (end < n && rep(political[y * n + end]) === colour) end++;
    return { colour, x: (start + end) / 2, y, width: end - start, height: 1, largest: true, tiny: true };
  });
}

/**
 * Draws each region's country name, sized to its room, and skips the names that would be too small. A
 * colour's largest area is named from the names level; its other areas only from the capitals level.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{vp: object, stage: {w: number, h: number}, theme: object, palette: string[], countries: object[], countryRegions: object[]}} scene
 * @returns {void}
 */
export function drawCountryNames(ctx, scene) {
  const { vp, stage, theme, palette, countries, countryRegions } = scene;
  const z = vp.k / vp.kFit;
  const nameAlpha = fadeFactor(z, ZOOM_FADES.countryName[0], ZOOM_FADES.countryName[1]);
  if (nameAlpha <= 0) return;
  const smallerAlpha = fadeFactor(z, ZOOM_FADES.capital[0], ZOOM_FADES.capital[1]);
  const recordOf = new Map(countries.map((country) => [country.colour, country]));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const region of countryRegions) {
    const hex = palette[region.colour - 1];
    if (hex === undefined) continue;
    const alpha = region.largest ? nameAlpha : smallerAlpha;
    if (alpha <= 0) continue;
    const sx = vp.x + region.x * vp.k;
    const sy = vp.y + (region.y + 0.5) * vp.k;
    if (sx < -CULL_MARGIN || sy < -CULL_MARGIN || sx > stage.w + CULL_MARGIN || sy > stage.h + CULL_MARGIN) continue;
    const name = countryName(recordOf.get(region.colour), palette, region.colour);
    ctx.font = `${MEASURE_SIZE}px ${theme.font}`;
    const widthPerSize = ctx.measureText(name).width / MEASURE_SIZE;
    ctx.globalAlpha = alpha;
    drawStraight(ctx, region, name, widthPerSize, vp, theme, sx, sy);
  }
  ctx.globalAlpha = 1;
}

function drawStraight(ctx, region, name, widthPerSize, vp, theme, sx, sy) {
  const fitted = Math.min(MAX_SIZE, (FILL_WIDTH * region.width * vp.k) / widthPerSize, FILL_HEIGHT * region.height * vp.k);
  const size = region.tiny && vp.k >= SINGLE_PIXEL_K ? MIN_SIZE : fitted;
  if (size < MIN_SIZE) return;
  ctx.font = `${size}px ${theme.font}`;
  ctx.lineWidth = size * HALO_SHARE;
  ctx.strokeStyle = theme.css.land;
  ctx.strokeText(name, sx, sy);
  ctx.fillStyle = theme.css.ink;
  ctx.fillText(name, sx, sy);
}
