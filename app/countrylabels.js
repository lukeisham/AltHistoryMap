// Country names drawn over the Political plane. findRegions works out once per paint change where
// each painted colour has room for a name; drawCountryNames sizes the name to that room at the
// current zoom and hides it when it would be unreadably small. render.js owns the cache and calls
// both from its frame; the text comes from countrydata.js, so a blank name shows the colour's own.

import { countryName } from "./countrydata.js";
import { fadeFactor, ZOOM_FADES } from "./viewport.js";

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
 * @param {Uint8Array} political n * n palette indexes, 0 unpainted
 * @param {number} n side of the plane in grid pixels
 * @param {Uint8Array} [representative] palette index -> the index its name belongs to (see `representativeColours`)
 * @returns {{colour: number, x: number, y: number, width: number, height: number}[]} grid pixels; `colour` is the representative
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
    const area = areas.get(root) ?? { colour: run.colour, cells: 0, longest: null };
    area.cells += (run.end - run.start) / stride;
    if (!area.longest || run.end - run.start > area.longest.end - area.longest.start) area.longest = run;
    areas.set(root, area);
  });

  return [...areas.values()]
    .filter((area) => area.cells >= MIN_AREA_CELLS)
    .map(({ colour, longest }) => {
      const width = longest.end - longest.start;
      const column = Math.min(n - 1, Math.floor((longest.start + width / 2) / stride) * stride);
      let top = longest.y;
      let bottom = longest.y;
      while (top - stride >= 0 && rep(political[(top - stride) * n + column]) === colour) top -= stride;
      while (bottom + stride < n && rep(political[(bottom + stride) * n + column]) === colour) bottom += stride;
      return { colour, x: longest.start + width / 2, y: longest.y, width, height: bottom - top + stride };
    });
}

/**
 * Draws each region's country name, sized to its room, and skips the names that would be too small.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{vp: object, stage: {w: number, h: number}, theme: object, palette: string[], countries: object[], countryRegions: object[]}} scene
 * @returns {void}
 */
export function drawCountryNames(ctx, scene) {
  const { vp, stage, theme, palette, countries, countryRegions } = scene;
  const alpha = fadeFactor(vp.k / vp.kFit, ZOOM_FADES.countryName[0], ZOOM_FADES.countryName[1]);
  if (alpha <= 0) return;
  const recordOf = new Map(countries.map((country) => [country.colour, country]));
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const region of countryRegions) {
    const hex = palette[region.colour - 1];
    if (hex === undefined) continue;
    const sx = vp.x + region.x * vp.k;
    const sy = vp.y + (region.y + 0.5) * vp.k;
    if (sx < -CULL_MARGIN || sy < -CULL_MARGIN || sx > stage.w + CULL_MARGIN || sy > stage.h + CULL_MARGIN) continue;
    const name = countryName(recordOf.get(region.colour), hex, region.colour);
    ctx.font = `${MEASURE_SIZE}px ${theme.font}`;
    const widthPerSize = ctx.measureText(name).width / MEASURE_SIZE;
    const size = Math.min(MAX_SIZE, (FILL_WIDTH * region.width * vp.k) / widthPerSize, FILL_HEIGHT * region.height * vp.k);
    if (size < MIN_SIZE) continue;
    ctx.font = `${size}px ${theme.font}`;
    ctx.lineWidth = size * HALO_SHARE;
    ctx.strokeStyle = theme.css.land;
    ctx.strokeText(name, sx, sy);
    ctx.fillStyle = theme.css.ink;
    ctx.fillText(name, sx, sy);
  }
  ctx.globalAlpha = 1;
}
