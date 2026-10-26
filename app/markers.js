// Draws and hit-tests cities, flags, labels and symbols over the layer picture.
// render.js calls drawMarkers once per frame and hitMarker from renderer.hitTest, so both use
// the same visibility rule and the same screen geometry.

import { BLOCK_COLS, BLOCK_ROWS, flagBlocks } from "./flagblocks.js";
import { fadeFactor, ZOOM_FADES } from "./viewport.js";
import { parseColour, unpackColour } from "./layerimage.js";

export const HIT_RADIUS = 14;

const { capital: CAPITAL_FADE, city: CITY_FADE, flag: FLAG_FADE } = ZOOM_FADES;
const LABEL_FADE = [0.9, 1.7];
const DRAW_ORDER = ["label", "city", "flag", "symbol"];

const NAME_SIZE = 12;
const LABEL_BASE_SIZE = 12;
const LABEL_GROWTH = 2;
const LABEL_MAX_Z = 6;
const HALO_WIDTH = 3;
const CITY_RADIUS = 6;
const CITY_DOT = 2.6;
const COLONY_HALF_BASE = 1.25;
const COLONY_LIFT = 0.25;
const NATION_REACH = 2;
const CITY_RING = 1.5;
const CAPITAL_GAP = 2.5;
const CAPITAL_RING = 1;
// Screen pixels per block of a flag design (flagblocks.js): 24 blocks across make a 36 pixel cloth.
const FLAG_CELL = 1.5;
const POLE_HEIGHT = 32;
const POLE_WIDTH = 1.5;
const SYMBOL_RADIUS = 11;
const SYMBOL_GLYPH_FILL = 0.62;
const GLYPH_BOX = 24;
const GLYPH_STROKE = 2;
const NAME_GAP = 4;
const SHAPE_OUTLINE = 1.5;
const TAG_HIT_PAD = 3;
const SELECT_RADIUS = 16;
const SELECT_PAD = 4;
const SELECT_WIDTH = 2;
const CULL_MARGIN = 120;

// Design cell 0 is white in the map file, so this is map data and not a theme colour.

const FLAG_CLOTH_W = BLOCK_COLS * FLAG_CELL;
const FLAG_CLOTH_H = BLOCK_ROWS * FLAG_CELL;

/**
 * Whether a marker shows: cities, flags and labels when Political is on screen, a symbol when
 * the layer it was placed on is.
 * @param {{type: string, layer: string}} marker
 * @param {string[]} layers The layers on screen.
 * @returns {boolean}
 */
export function markerVisible(marker, layers) {
  return layers.includes(marker.type === "symbol" ? marker.layer : "political");
}

/**
 * Chooses between two candidate colours the one that stands out more from a background.
 * @param {number} background Packed colour.
 * @param {{css: string, packed: number}} a
 * @param {{css: string, packed: number}} b
 * @returns {string} CSS colour of the winner.
 */
export function contrastColour(background, a, b) {
  const luma = (packed) => {
    const { r, g, b: blue } = unpackColour(packed);
    return 0.2126 * r + 0.7152 * g + 0.0722 * blue;
  };
  const base = luma(background);
  return Math.abs(luma(a.packed) - base) >= Math.abs(luma(b.packed) - base) ? a.css : b.css;
}

/**
 * Looks up Path2D shapes for glyph ids, building each once.
 * @param {{id: string, path: string, solid?: boolean}[]} glyphs
 * @returns {{get: (id: string) => Path2D | null, isSolid: (id: string) => boolean}} `isSolid` is true for a
 *   plain shape that is drawn filled in the marker's colour instead of as an outline on a disc.
 */
export function createGlyphLibrary(glyphs) {
  const sources = new Map(glyphs.map((g) => [g.id, g.path]));
  const solid = new Set(glyphs.filter((g) => g.solid).map((g) => g.id));
  const built = new Map();
  const reported = new Set();
  return {
    get(id) {
      if (built.has(id)) return built.get(id);
      const source = sources.get(id);
      if (source === undefined) {
        if (!reported.has(id)) console.warn("render: unknown glyph id", id);
        reported.add(id);
        return null;
      }
      const path = new Path2D(source);
      built.set(id, path);
      return path;
    },
    isSolid: (id) => solid.has(id),
  };
}

function paletteCss(scene, marker) {
  return scene.palette[marker.colour - 1];
}

// Where the marker's pixel lands on the stage, and the cloth centre for flags.
function anchorOf(marker, vp) {
  return { sx: vp.x + (marker.x + 0.5) * vp.k, sy: vp.y + (marker.y + 0.5) * vp.k };
}

function drawText(ctx, scene, text, x, y, size, alpha, align) {
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${scene.theme.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = HALO_WIDTH;
  ctx.strokeStyle = scene.theme.css.land;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = scene.theme.css.ink;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

function drawLabel(ctx, scene, marker, sx, sy, z) {
  const alpha = fadeFactor(z, LABEL_FADE[0], LABEL_FADE[1]);
  if (alpha <= 0) return;
  const size = LABEL_BASE_SIZE + LABEL_GROWTH * Math.min(z, LABEL_MAX_Z);
  drawText(ctx, scene, marker.name, sx, sy, size, alpha, "center");
}

/**
 * The colour of a city's centre dot: ink, or with `scene.cityColour === "nation"` the political colour that holds
 * the city. Paint never covers a river or lake pixel, so a city on one takes the commonest colour among the
 * nearest painted pixels, searching out to NATION_REACH pixels. A city with none near it stays ink.
 * @param {object} scene Needs theme, palette, and for "nation" also political (the plane) and n (its side).
 * @param {{x: number, y: number}} marker
 * @returns {string} CSS colour.
 */
export function cityDotColour(scene, marker) {
  const ink = scene.theme.css.ink;
  if (scene.cityColour !== "nation") return ink;
  const { political, n } = scene;
  for (let reach = 0; reach <= NATION_REACH; reach++) {
    const counts = new Map();
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== reach) continue;
        const x = marker.x + dx;
        const y = marker.y + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const colour = political[y * n + x];
        if (colour > 0) counts.set(colour, (counts.get(colour) ?? 0) + 1);
      }
    }
    if (counts.size === 0) continue;
    const [best] = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    return scene.palette[best - 1] ?? ink;
  }
  return ink;
}

// A bullseye: an ink ring round a pale centre, and a dot that is ink or the nation's colour.
function drawCity(ctx, scene, marker, sx, sy, z) {
  const alpha = cityAlpha(marker, z);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  if (marker.colony) {
    // A colony is the city bullseye on a triangle: point up, centred on the same spot.
    const lift = CITY_RADIUS * COLONY_LIFT;
    ctx.moveTo(sx, sy - lift - CITY_RADIUS);
    ctx.lineTo(sx + CITY_RADIUS * COLONY_HALF_BASE, sy + CITY_RADIUS - lift);
    ctx.lineTo(sx - CITY_RADIUS * COLONY_HALF_BASE, sy + CITY_RADIUS - lift);
    ctx.closePath();
  } else {
    ctx.arc(sx, sy, CITY_RADIUS, 0, Math.PI * 2);
  }
  ctx.fillStyle = scene.theme.css.land;
  ctx.fill();
  ctx.lineWidth = CITY_RING;
  ctx.strokeStyle = scene.theme.css.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx, sy, CITY_DOT, 0, Math.PI * 2);
  ctx.fillStyle = cityDotColour(scene, marker);
  ctx.fill();
  if (marker.capital) {
    // A capital wears a second, thinner ring round the bullseye.
    ctx.beginPath();
    ctx.arc(sx, sy, CITY_RADIUS + CAPITAL_GAP, 0, Math.PI * 2);
    ctx.lineWidth = CAPITAL_RING;
    ctx.strokeStyle = scene.theme.css.ink;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFlagCloth(ctx, scene, marker, left, top) {
  const design = marker.design >= 0 ? scene.designs[marker.design] : null;
  if (!design) {
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + FLAG_CLOTH_W, top + FLAG_CLOTH_H / 2);
    ctx.lineTo(left, top + FLAG_CLOTH_H);
    ctx.closePath();
    ctx.fillStyle = paletteCss(scene, marker);
    ctx.fill();
    return;
  }
  const blocks = flagBlocks(design, scene.palette, scene.theme.css.flagWhite);
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      ctx.fillStyle = blocks[row * BLOCK_COLS + col];
      ctx.fillRect(left + col * FLAG_CELL, top + row * FLAG_CELL, FLAG_CELL, FLAG_CELL);
    }
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = scene.theme.css.ink;
  ctx.strokeRect(left, top, FLAG_CLOTH_W, FLAG_CLOTH_H);
}

function drawFlag(ctx, scene, marker, sx, sy, z) {
  const alpha = fadeFactor(z, FLAG_FADE[0], FLAG_FADE[1]);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  const top = sy - POLE_HEIGHT;
  ctx.lineWidth = POLE_WIDTH;
  ctx.strokeStyle = scene.theme.css.ink;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx, top);
  ctx.stroke();
  drawFlagCloth(ctx, scene, marker, sx, top);
  ctx.globalAlpha = 1;
}

function drawSolidShape(ctx, scene, marker, path, sx, sy) {
  const colour = paletteCss(scene, marker);
  const { css, packed } = scene.theme;
  const scale = (SYMBOL_RADIUS * 2) / GLYPH_BOX;
  ctx.save();
  ctx.translate(sx - (GLYPH_BOX * scale) / 2, sy - (GLYPH_BOX * scale) / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = colour;
  ctx.fill(path);
  ctx.lineWidth = SHAPE_OUTLINE / scale;
  ctx.lineJoin = "round";
  ctx.strokeStyle = contrastColour(parseColour(colour), { css: css.ink, packed: packed.ink }, { css: css.land, packed: packed.land });
  ctx.stroke(path);
  ctx.restore();
}

// `path` is null for an unknown glyph id, which still gets its disc.
function drawGlyphOnDisc(ctx, scene, marker, path, sx, sy) {
  const colour = paletteCss(scene, marker);
  ctx.beginPath();
  ctx.arc(sx, sy, SYMBOL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.lineWidth = CITY_RING;
  ctx.strokeStyle = scene.theme.css.land;
  ctx.stroke();
  if (!path) return;
  const { css, packed } = scene.theme;
  const stroke = contrastColour(parseColour(colour), { css: css.ink, packed: packed.ink }, { css: css.land, packed: packed.land });
  const scale = (SYMBOL_RADIUS * 2 * SYMBOL_GLYPH_FILL) / GLYPH_BOX;
  ctx.save();
  ctx.translate(sx - (GLYPH_BOX * scale) / 2, sy - (GLYPH_BOX * scale) / 2);
  ctx.scale(scale, scale);
  ctx.lineWidth = GLYPH_STROKE;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke;
  ctx.stroke(path);
  ctx.restore();
}

/**
 * How visible a symbol is at a zoom: it appears with the capitals (see ZOOM_FADES), so a hidden symbol
 * cannot be clicked and its name tag fades with it.
 * @param {number} z Screen pixels per grid pixel divided by the fit-to-screen scale.
 * @returns {number} 0 to 1
 */
export function symbolAlpha(z) {
  return fadeFactor(z, CAPITAL_FADE[0], CAPITAL_FADE[1]);
}

function drawSymbol(ctx, scene, marker, sx, sy, z) {
  const alpha = symbolAlpha(z);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  const path = scene.glyphs.get(marker.glyph);
  if (path && scene.glyphs.isSolid(marker.glyph)) drawSolidShape(ctx, scene, marker, path, sx, sy);
  else drawGlyphOnDisc(ctx, scene, marker, path, sx, sy);
  ctx.globalAlpha = 1;
}

/**
 * How visible a city is at a zoom: a capital appears first, any other city (a colony is one) further in
 * (see ZOOM_FADES). Zoomed fully out (z = 1) neither shows.
 * @param {{capital?: boolean}} marker
 * @param {number} z Screen pixels per grid pixel divided by the fit-to-screen scale.
 * @returns {number} 0 to 1
 */
export function cityAlpha(marker, z) {
  const [from, to] = marker.capital ? CAPITAL_FADE : CITY_FADE;
  return fadeFactor(z, from, to);
}

const PAINTERS = { label: drawLabel, city: drawCity, flag: drawFlag, symbol: drawSymbol };

// Where a marker's name tag sits: beside a city or flag, under a symbol, moved by the offset the person
// dragged it to. A label is its own text, so it has no tag.
function tagSpec(marker, sx, sy, z) {
  if (!marker.name || marker.type === "label") return null;
  let spec;
  if (marker.type === "city") {
    spec = { x: sx + CITY_RADIUS + (marker.capital ? CAPITAL_GAP : 0) + NAME_GAP, y: sy, align: "left", fade: marker.capital ? CAPITAL_FADE : CITY_FADE };
  } else if (marker.type === "flag") {
    spec = { x: sx + FLAG_CLOTH_W + NAME_GAP, y: sy - POLE_HEIGHT + FLAG_CLOTH_H / 2, align: "left", fade: FLAG_FADE };
  } else {
    spec = { x: sx, y: sy + SYMBOL_RADIUS + NAME_SIZE * 0.8, align: "center", fade: CAPITAL_FADE };
  }
  const alpha = fadeFactor(z, spec.fade[0], spec.fade[1]);
  if (alpha <= 0) return null;
  return { text: marker.name, x: spec.x + (marker.tagDx ?? 0), y: spec.y + (marker.tagDy ?? 0), align: spec.align, alpha };
}

// The marker as it should look this frame: a marker being dragged follows the pointer before the edit is recorded.
function previewed(scene, marker) {
  return scene.preview?.id === marker.id ? { ...marker, ...scene.preview } : marker;
}

/**
 * Draws every marker visible on the scene's layers, then every name tag over them.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene Needs layers, vp, stage, markers, designs, palette (CSS colours), theme, glyphs,
 *   cityColour ("neutral" or "nation"), political and n for "nation", and optionally `preview`: fields that replace one marker's while it is dragged.
 */
export function drawMarkers(ctx, scene) {
  const { vp, stage } = scene;
  const z = vp.k / vp.kFit;
  const shown = [];
  for (const type of DRAW_ORDER) {
    for (const original of scene.markers) {
      if (original.type !== type || !markerVisible(original, scene.layers)) continue;
      const marker = previewed(scene, original);
      const { sx, sy } = anchorOf(marker, vp);
      if (sx < -CULL_MARGIN || sy < -CULL_MARGIN || sx > stage.w + CULL_MARGIN || sy > stage.h + CULL_MARGIN) continue;
      PAINTERS[type](ctx, scene, marker, sx, sy, z);
      shown.push({ marker, sx, sy });
    }
  }
  for (const { marker, sx, sy } of shown) {
    const tag = tagSpec(marker, sx, sy, z);
    if (tag) drawText(ctx, scene, tag.text, tag.x, tag.y, NAME_SIZE, tag.alpha, tag.align);
  }
}

/**
 * Rings the selected marker.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene As for drawMarkers.
 * @param {{type: string, x: number, y: number}} marker
 */
export function drawSelection(ctx, scene, marker) {
  const shown = previewed(scene, marker);
  const { sx, sy } = anchorOf(shown, scene.vp);
  const pass = (colour, width) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    if (shown.type === "flag") {
      ctx.rect(sx - SELECT_PAD, sy - POLE_HEIGHT - SELECT_PAD, FLAG_CLOTH_W + 2 * SELECT_PAD, POLE_HEIGHT + 2 * SELECT_PAD);
    } else {
      ctx.arc(sx, sy, SELECT_RADIUS, 0, Math.PI * 2);
    }
    ctx.stroke();
  };
  pass(scene.theme.css.land, SELECT_WIDTH + HALO_WIDTH);
  pass(scene.theme.css.ink, SELECT_WIDTH);
}

/**
 * The nearest visible marker within HIT_RADIUS of a stage point. A flag answers to its pole
 * foot and to its cloth.
 * @param {object[]} markers
 * @param {string[]} layers The layers on screen.
 * @param {{x: number, y: number, k: number}} vp
 * @param {number} sx
 * @param {number} sy
 * @returns {object | null}
 */
export function hitMarker(markers, layers, vp, sx, sy) {
  let best = null;
  let bestDistance = HIT_RADIUS;
  const z = vp.k / vp.kFit;
  for (const marker of markers) {
    if (!markerVisible(marker, layers)) continue;
    if (marker.type === "city" && cityAlpha(marker, z) <= 0) continue;
    if (marker.type === "flag" && fadeFactor(z, FLAG_FADE[0], FLAG_FADE[1]) <= 0) continue;
    if (marker.type === "symbol" && symbolAlpha(z) <= 0) continue;
    const anchor = anchorOf(marker, vp);
    let distance = Math.hypot(anchor.sx - sx, anchor.sy - sy);
    if (marker.type === "flag") {
      const cloth = Math.hypot(anchor.sx + FLAG_CLOTH_W / 2 - sx, anchor.sy - POLE_HEIGHT + FLAG_CLOTH_H / 2 - sy);
      distance = Math.min(distance, cloth);
    }
    if (distance <= bestDistance) {
      best = marker;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The marker whose name tag is under a stage point: the tag must be showing, and the nearest one wins.
 * @param {object[]} markers
 * @param {string[]} layers The layers on screen.
 * @param {{x: number, y: number, k: number, kFit: number}} vp
 * @param {number} sx
 * @param {number} sy
 * @param {(text: string, size: number) => number} measure Width of text in stage pixels, from the canvas.
 * @returns {object | null}
 */
export function hitTag(markers, layers, vp, sx, sy, measure) {
  const z = vp.k / vp.kFit;
  let best = null;
  let bestDistance = Infinity;
  for (const marker of markers) {
    if (!markerVisible(marker, layers)) continue;
    const anchor = anchorOf(marker, vp);
    const tag = tagSpec(marker, anchor.sx, anchor.sy, z);
    if (!tag) continue;
    const width = measure(tag.text, NAME_SIZE);
    const left = tag.align === "left" ? tag.x : tag.x - width / 2;
    if (sx < left - TAG_HIT_PAD || sx > left + width + TAG_HIT_PAD || Math.abs(sy - tag.y) > NAME_SIZE / 2 + TAG_HIT_PAD) continue;
    const distance = Math.abs(sx - (left + width / 2));
    if (distance < bestDistance) {
      best = marker;
      bestDistance = distance;
    }
  }
  return best;
}
