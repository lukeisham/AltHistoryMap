// Country names drawn over the Political plane. findRegions works out once per paint change where
// each painted colour has room for a name; drawCountryNames sizes the name to that room at the
// current zoom and hides it when it would be unreadably small. render.js owns the cache and calls
// both from its frame; the text comes from countrydata.js, so a blank name shows the colour's own.

import { countryName } from "./countrydata.js";
import { LAND } from "./model.js";
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
// Water this wide (grid pixels) between a landmass and every larger one makes it an island; a narrower strait is not.
const ISLAND_GAP = 32;
// An area is an island only when it is smaller than this share of its colour's largest area.
const ISLAND_AREA_SHARE = 0.25;
// How wide an island's curved name may be, as a share of the island's width.
const ISLAND_WIDTH_SHARE = 1;
// A coast point counts as facing open water when its outward normal is within 60 degrees of the direction away from the mainland.
const FACING_DOT = 0.5;
const OUTLINE_POINTS = 240;

/**
 * Where each separate area of a painted political colour has room for its name: the middle of that
 * area's longest horizontal run, with the run's length and the height of the colour above and below
 * that point. An area is four-way connected on the sampling grid, and one too small to hold a name is
 * left out, so a stray pixel gets none. Colours that share a representative are one colour.
 * `largest` marks a colour's biggest area. `island` marks a smaller area on a landmass that no larger
 * landmass comes within ISLAND_GAP of, and gives it a `coast`: the stretch of shore facing away from the
 * colour's largest area that its name is drawn along.
 * @param {Uint8Array} political n * n palette indexes, 0 unpainted
 * @param {number} n side of the plane in grid pixels
 * @param {Uint8Array} [representative] palette index -> the index its name belongs to (see `representativeColours`)
 * @param {Uint8Array} [base] the basemap plane; without it no area is an island
 * @returns {{colour: number, x: number, y: number, width: number, height: number, largest: boolean, island: boolean, coast: object | null, tiny?: boolean}[]} grid pixels; `colour` is the representative
 */
export function findRegions(political, n, representative = null, base = null) {
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
  const landmasses = base ? landmassesOf(base, n, stride) : null;

  const regions = kept.map((area) => {
    const { colour, longest } = area;
    const width = longest.end - longest.start;
    const column = Math.min(n - 1, Math.floor((longest.start + width / 2) / stride) * stride);
    let top = longest.y;
    let bottom = longest.y;
    while (top - stride >= 0 && rep(political[(top - stride) * n + column]) === colour) top -= stride;
    while (bottom + stride < n && rep(political[(bottom + stride) * n + column]) === colour) bottom += stride;
    const region = { colour, x: longest.start + width / 2, y: longest.y, width, height: bottom - top + stride, largest: area.cells === largestCells.get(colour), island: false, coast: null };
    region.cells = area.cells;
    region.runs = area.runs;
    return region;
  });

  for (const region of regions) {
    const largest = regions.find((other) => other.colour === region.colour && other.largest);
    if (landmasses && region.cells < ISLAND_AREA_SHARE * largestCells.get(region.colour) && landmasses.isIsolated(region.x, region.y)) {
      region.coast = coastOf(region, largest, stride);
      region.island = region.coast !== null;
    }
    delete region.cells;
    delete region.runs;
  }
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
    return { colour, x: (start + end) / 2, y, width: end - start, height: 1, largest: true, island: false, coast: null, tiny: true };
  });
}

const landmassCache = new WeakMap();

// Labels the connected land of the basemap on the sampling grid, once per basemap. A river or lake pixel
// keeps its LAND bit, so water inside a landmass never splits it. isIsolated(x, y) tells whether the
// landmass under a grid pixel has no larger landmass within ISLAND_GAP.
function landmassesOf(base, n, stride) {
  const cached = landmassCache.get(base);
  if (cached?.stride === stride && cached.n === n) return cached;
  const side = Math.ceil(n / stride);
  const label = new Int32Array(side * side);
  const sizes = [0];
  const stack = [];
  const landAt = (i) => (base[Math.floor(i / side) * stride * n + (i % side) * stride] & LAND) !== 0;
  for (let start = 0; start < label.length; start++) {
    if (label[start] !== 0 || !landAt(start)) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % side;
      for (const j of [x > 0 ? i - 1 : -1, x < side - 1 ? i + 1 : -1, i - side, i + side]) {
        if (j < 0 || j >= label.length || label[j] !== 0 || !landAt(j)) continue;
        label[j] = id;
        stack.push(j);
      }
    }
    sizes.push(size);
  }

  const gapSteps = Math.ceil(ISLAND_GAP / stride);
  const verdicts = new Map();
  // Grows outward from the landmass one ring of cells at a time; reaching a larger landmass inside the gap ends the search.
  function isolated(id) {
    let frontier = [];
    const reached = new Uint8Array(label.length);
    for (let i = 0; i < label.length; i++) {
      if (label[i] === id) {
        reached[i] = 1;
        frontier.push(i);
      }
    }
    for (let step = 0; step < gapSteps && frontier.length; step++) {
      const next = [];
      for (const i of frontier) {
        const x = i % side;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (x + dx < 0 || x + dx >= side) continue;
            const j = i + dy * side + dx;
            if (j < 0 || j >= label.length || reached[j]) continue;
            reached[j] = 1;
            if (label[j] !== 0 && label[j] !== id && sizes[label[j]] > sizes[id]) return false;
            next.push(j);
          }
        }
      }
      frontier = next;
    }
    return true;
  }

  const result = {
    n,
    stride,
    isIsolated(x, y) {
      const id = label[Math.min(side - 1, Math.floor(y / stride)) * side + Math.min(side - 1, Math.floor(x / stride))];
      if (id === 0) return false;
      if (!verdicts.has(id)) verdicts.set(id, isolated(id));
      return verdicts.get(id);
    },
  };
  landmassCache.set(base, result);
  return result;
}

// The silhouette of an area (its leftmost and rightmost cell on every row) as a closed outline sampled
// evenly, with each point's unit tangent and outward normal. Rows run top to bottom on the left and back
// up on the right, which is counter-clockwise on a screen with y down, so the outward normal is (-ty, tx).
function silhouette(runs, stride) {
  const rows = new Map();
  for (const { start, end, y } of runs) {
    const row = rows.get(y);
    rows.set(y, row ? { start: Math.min(row.start, start), end: Math.max(row.end, end) } : { start, end });
  }
  const ys = [...rows.keys()].sort((a, b) => a - b);
  const corners = [];
  for (const y of ys) corners.push({ x: rows.get(y).start, y }, { x: rows.get(y).start, y: y + stride });
  for (const y of [...ys].reverse()) corners.push({ x: rows.get(y).end, y: y + stride }, { x: rows.get(y).end, y });

  const lengths = corners.map((c, i) => Math.hypot(corners[(i + 1) % corners.length].x - c.x, corners[(i + 1) % corners.length].y - c.y));
  const perimeter = lengths.reduce((a, b) => a + b, 0);
  const points = [];
  let segment = 0;
  let before = 0;
  for (let k = 0; k < OUTLINE_POINTS; k++) {
    const target = (k * perimeter) / OUTLINE_POINTS;
    while (before + lengths[segment] < target) before += lengths[segment++];
    const from = corners[segment];
    const to = corners[(segment + 1) % corners.length];
    const t = lengths[segment] === 0 ? 0 : (target - before) / lengths[segment];
    points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  return points.map((p, i) => {
    const before = points[(i - 2 + points.length) % points.length];
    const after = points[(i + 2) % points.length];
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const tx = (after.x - before.x) / length;
    const ty = (after.y - before.y) / length;
    return { x: p.x, y: p.y, tx, ty, nx: -ty, ny: tx };
  });
}

// The longest stretch of an island's shore that faces away from its country's largest area and whose
// text can read left to right without turning upside down: points in reading order, each with the
// outward normal, and the stretch's length and the island's width in grid pixels. Null when the shore has no such stretch.
function coastOf(region, mainland, stride) {
  const outline = silhouette(region.runs, stride);
  if (outline.length < 3) return null;
  const awayX = region.x - (mainland?.x ?? region.x);
  const awayY = region.y - (mainland?.y ?? region.y);
  const away = Math.hypot(awayX, awayY);
  const [dx, dy] = away === 0 ? [0, 1] : [awayX / away, awayY / away];
  const facing = outline.map((p) => p.nx * dx + p.ny * dy >= FACING_DOT);

  let best = { start: 0, length: 0 };
  for (let start = 0; start < outline.length; start++) {
    if (!facing[start] || facing[(start - 1 + outline.length) % outline.length]) continue;
    let length = 0;
    while (length < outline.length && facing[(start + length) % outline.length]) length++;
    if (length > best.length) best = { start, length };
  }
  if (best.length === 0) {
    let nearest = 0;
    outline.forEach((p, i) => {
      if (p.nx * dx + p.ny * dy > outline[nearest].nx * dx + outline[nearest].ny * dy) nearest = i;
    });
    best = { start: (nearest - 2 + outline.length) % outline.length, length: 5 };
  }
  let stretch = Array.from({ length: best.length }, (_, i) => outline[(best.start + i) % outline.length]);

  const along = stretch.reduce((sum, p) => ({ x: sum.x + p.tx, y: sum.y + p.ty }), { x: 0, y: 0 });
  if (along.x < -1e-6 || (Math.abs(along.x) <= 1e-6 && along.y < 0)) {
    stretch = stretch.reverse().map((p) => ({ ...p, tx: -p.tx, ty: -p.ty }));
  }
  let upright = [];
  let longest = [];
  for (const p of stretch) {
    if (p.tx >= 0) upright.push(p);
    else upright = [];
    if (upright.length > longest.length) longest = [...upright];
  }
  if (longest.length < 2) return null;

  let length = 0;
  const points = longest.map((p, i) => {
    if (i > 0) length += Math.hypot(p.x - longest[i - 1].x, p.y - longest[i - 1].y);
    return { ...p, at: length };
  });
  const xs = outline.map((p) => p.x);
  return { points, length, islandWidth: Math.max(...xs) - Math.min(...xs) };
}

/**
 * Draws each region's country name, sized to its room, and skips the names that would be too small. A
 * colour's largest area is named from the names level; its other areas only from the capitals level; an
 * island is named along its shore from the names level.
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
    const alpha = region.largest || region.island ? nameAlpha : smallerAlpha;
    if (alpha <= 0) continue;
    const sx = vp.x + region.x * vp.k;
    const sy = vp.y + (region.y + 0.5) * vp.k;
    if (sx < -CULL_MARGIN || sy < -CULL_MARGIN || sx > stage.w + CULL_MARGIN || sy > stage.h + CULL_MARGIN) continue;
    const name = countryName(recordOf.get(region.colour), palette, region.colour);
    ctx.font = `${MEASURE_SIZE}px ${theme.font}`;
    const widthPerSize = ctx.measureText(name).width / MEASURE_SIZE;
    ctx.globalAlpha = alpha;
    if (region.island) drawAlongCoast(ctx, region, name, widthPerSize, vp, theme);
    else drawStraight(ctx, region, name, widthPerSize, vp, theme, sx, sy);
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

// Letters follow the island's shore, each turned to the shore's direction there and centred a text
// height out from the coast (half a height of gap plus half a height for the letter), so no letter
// touches the island. The size is the smaller of what the stretch of shore holds and a share of the
// island's width, both scaled by the zoom.
function drawAlongCoast(ctx, region, name, widthPerSize, vp, theme) {
  const { points, length, islandWidth } = region.coast;
  const size = Math.min(MAX_SIZE, (length * vp.k) / widthPerSize, ISLAND_WIDTH_SHARE * islandWidth * vp.k);
  if (size < MIN_SIZE) return;
  ctx.font = `${size}px ${theme.font}`;
  ctx.lineWidth = size * HALO_SHARE;
  ctx.strokeStyle = theme.css.land;
  ctx.fillStyle = theme.css.ink;
  const nameWidth = widthPerSize * size;
  const shoreLength = length * vp.k;
  const first = (shoreLength - nameWidth) / 2;
  let travelled = 0;
  for (const letter of name) {
    const advance = ctx.measureText(letter).width;
    const centre = first + travelled + advance / 2;
    travelled += advance;
    const placed = pointAt(points, centre / vp.k);
    const x = vp.x + placed.x * vp.k + placed.nx * size;
    const y = vp.y + placed.y * vp.k + placed.ny * size;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(placed.ty, placed.tx));
    ctx.strokeText(letter, 0, 0);
    ctx.fillText(letter, 0, 0);
    ctx.restore();
  }
}

// The shore point `at` grid pixels along the stretch, between the two sampled points either side of it.
function pointAt(points, at) {
  let i = 1;
  while (i < points.length - 1 && points[i].at < at) i++;
  const from = points[i - 1];
  const to = points[i];
  const t = to.at === from.at ? 0 : Math.min(1, Math.max(0, (at - from.at) / (to.at - from.at)));
  const mix = (a, b) => a + (b - a) * t;
  return { x: mix(from.x, to.x), y: mix(from.y, to.y), nx: mix(from.nx, to.nx), ny: mix(from.ny, to.ny), tx: mix(from.tx, to.tx), ty: mix(from.ty, to.ty) };
}
