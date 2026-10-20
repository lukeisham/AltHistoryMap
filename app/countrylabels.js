// Country names drawn over the Political plane. findRegions works out once per paint change where
// each painted colour has room for a name; drawCountryNames sizes the name to that room at the
// current zoom and hides it when it would be unreadably small. render.js owns the cache and calls
// both from its frame; the text comes from countrydata.js, so a blank name shows the colour's own.

import { countryName } from "./countrydata.js";

// The plane is read on a grid of about this many samples a side, so a 4096-pixel plane costs a million reads.
const SAMPLES_PER_SIDE = 1024;
const MIN_SIZE = 10;
const MAX_SIZE = 30;
// How much of the room the name may fill, across and down.
const FILL_WIDTH = 0.9;
const FILL_HEIGHT = 0.5;
const MEASURE_SIZE = 100;
const HALO_SHARE = 0.18;
const CULL_MARGIN = 40;

/**
 * Where each painted political colour has room for its name: the middle of its longest horizontal run,
 * with the run's length and the height of the colour above and below that point.
 * @param {Uint8Array} political n * n palette indexes, 0 unpainted
 * @param {number} n side of the plane in grid pixels
 * @returns {{colour: number, x: number, y: number, width: number, height: number}[]} grid pixels
 */
export function findRegions(political, n) {
  const stride = Math.max(1, Math.floor(n / SAMPLES_PER_SIDE));
  const longest = new Map();

  for (let y = 0; y < n; y += stride) {
    let runColour = 0;
    let runStart = 0;
    const close = (end) => {
      const length = end - runStart;
      if (runColour !== 0 && length > (longest.get(runColour)?.width ?? 0)) {
        longest.set(runColour, { colour: runColour, x: runStart + length / 2, y, width: length });
      }
    };
    for (let x = 0; x < n; x += stride) {
      const colour = political[y * n + x];
      if (colour === runColour) continue;
      close(x);
      runColour = colour;
      runStart = x;
    }
    close(n);
  }

  return [...longest.values()].map((region) => {
    const column = Math.min(n - 1, Math.floor(region.x / stride) * stride);
    let top = region.y;
    let bottom = region.y;
    while (top - stride >= 0 && political[(top - stride) * n + column] === region.colour) top -= stride;
    while (bottom + stride < n && political[(bottom + stride) * n + column] === region.colour) bottom += stride;
    return { ...region, height: bottom - top + stride };
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
  const recordOf = new Map(countries.map((country) => [country.colour, country]));
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
}
