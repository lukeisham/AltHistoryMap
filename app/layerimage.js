// Colours the current look into one n x n picture so a frame is a single drawImage.
// render.js owns the instance and calls rebuild/update from model notices; pixelColour is the
// one definition of what each look shows. layers.js names the looks.

import { LAND, RIVER, LAKE, COAST } from "./model.js";

const TOKENS = {
  sea: "--map-sea",
  land: "--map-land",
  coast: "--map-coast",
  water: "--map-water",
  border: "--border",
  ink: "--ink",
  flagWhite: "--flag-white",
};
const NUMBERS = {
  cultureTint: "--culture-tint",
  cultureBlend: "--culture-blend",
  politicalFade: "--political-fade",
};
const FONT_TOKEN = "--font-map";
const FONT_FALLBACK = "serif";
// Stand in for a token that is missing; the console warning makes the gap visible.
const MISSING_COLOUR = 0xff808080;
const MISSING_NUMBER = 0.5;

const WHITE = 0xffffffff;
const BLACK = 0xff000000;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;

/**
 * Packs red, green and blue into the little-endian ABGR value a Uint32Array view of ImageData expects.
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {number}
 */
export function packColour(r, g, b) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/**
 * Reads a packed colour back into channels.
 * @param {number} packed
 * @returns {{r: number, g: number, b: number}}
 */
export function unpackColour(packed) {
  return { r: packed & 255, g: (packed >>> 8) & 255, b: (packed >>> 16) & 255 };
}

/**
 * Converts a packed colour to a CSS colour string.
 * @param {number} packed
 * @returns {string}
 */
export function cssColour(packed) {
  const { r, g, b } = unpackColour(packed);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Parses `#rgb`, `#rrggbb`, `rgb()` and `rgba()` text.
 * @param {string} text
 * @returns {number | null} Packed colour, or null when the text is not one of those forms.
 */
export function parseColour(text) {
  const value = String(text ?? "").trim();
  const hex = HEX.exec(value);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1];
    const v = parseInt(digits, 16);
    return packColour((v >> 16) & 255, (v >> 8) & 255, v & 255);
  }
  const rgb = RGB.exec(value);
  if (rgb) return packColour(...rgb.slice(1, 4).map((c) => Math.min(255, Math.round(Number(c)))));
  return null;
}

/**
 * Mixes two packed colours.
 * @param {number} from
 * @param {number} to
 * @param {number} share Share of `to`, 0 to 1.
 * @returns {number}
 */
export function mixColour(from, to, share) {
  const a = unpackColour(from);
  const b = unpackColour(to);
  return packColour(a.r + (b.r - a.r) * share, a.g + (b.g - a.g) * share, a.b + (b.b - a.b) * share);
}

/**
 * Reads the map's theme tokens. A missing or unparseable token warns and becomes grey or one half.
 * @param {{getPropertyValue: (name: string) => string}} style Computed style of the canvas.
 * @returns {{packed: object, css: object, numbers: object, font: string}}
 */
export function readTheme(style) {
  const packed = {};
  const css = {};
  const numbers = {};
  for (const [key, token] of Object.entries(TOKENS)) {
    let colour = parseColour(style.getPropertyValue(token));
    if (colour === null) {
      console.warn(`render: theme token ${token} is missing or not a hex/rgb colour`);
      colour = MISSING_COLOUR;
    }
    packed[key] = colour;
    css[key] = cssColour(colour);
  }
  for (const [key, token] of Object.entries(NUMBERS)) {
    const text = style.getPropertyValue(token).trim();
    const value = text === "" ? NaN : Number(text);
    if (!(value >= 0 && value <= 1)) {
      console.warn(`render: theme token ${token} is missing or not a number from 0 to 1`);
    }
    numbers[key] = value >= 0 && value <= 1 ? value : MISSING_NUMBER;
  }
  let font = style.getPropertyValue(FONT_TOKEN).trim();
  if (!font) {
    console.warn(`render: theme token ${FONT_TOKEN} is missing`);
    font = FONT_FALLBACK;
  }
  return { packed, css, numbers, font };
}

/**
 * Everything the pixel loop reads, gathered once per rebuild so planes replaced by the model
 * (Open, scenario) are picked up.
 * @param {object} model
 * @param {{packed: object, numbers: object}} theme
 * @returns {object} The source argument of pixelColour.
 */
export function makeSource(model, theme) {
  const { packed, numbers } = theme;
  const ground = new Uint32Array(16);
  for (let bits = 0; bits < 16; bits++) {
    if (bits & (RIVER | LAKE)) ground[bits] = packed.water;
    else if (bits & LAND) ground[bits] = packed.land;
    else if (bits & COAST) ground[bits] = packed.coast;
    else ground[bits] = packed.sea;
  }
  // Index 0 stays 0, which every look reads as "no colour, show what is beneath".
  const palette = new Uint32Array(256);
  const pale = new Uint32Array(256);
  const faded = new Uint32Array(256);
  model.palette.forEach((hex, i) => {
    const colour = parseColour(hex);
    if (colour === null) {
      console.warn("render: palette entry is not a colour", hex);
      return;
    }
    palette[i + 1] = colour;
    pale[i + 1] = mixColour(colour, WHITE, numbers.cultureTint);
    faded[i + 1] = mixColour(packed.land, colour, numbers.politicalFade);
  });
  const { political, border, province, culture } = model.planes;
  return {
    n: model.n,
    base: model.base,
    ground,
    palette,
    pale,
    faded,
    political,
    border,
    province,
    culture,
    borderColour: packed.border,
    fadedBorderColour: mixColour(packed.land, packed.border, numbers.politicalFade),
    cultureBlend: numbers.cultureBlend,
  };
}

function politicalPixel(src, i) {
  const g = src.ground[src.base[i] & 15];
  if (src.border[i] !== 0) return src.borderColour;
  const c = src.palette[src.political[i]];
  return c !== 0 ? c : g;
}

function culturePixel(src, i) {
  return src.pale[src.culture[i]] || src.ground[src.base[i] & 15];
}

function editCulturePixel(src, i) {
  let under = src.ground[src.base[i] & 15];
  if (src.border[i] !== 0) under = src.fadedBorderColour;
  else if (src.faded[src.political[i]] !== 0) under = src.faded[src.political[i]];
  const c = src.palette[src.culture[i]];
  return c !== 0 ? mixColour(under, c, src.cultureBlend) : under;
}

// A province pixel is outlined in black when a side neighbour has a different province; the map
// edge counts as the same province.
function provincePixel(src, i) {
  const { province, n } = src;
  const p = province[i];
  if (p !== 0) {
    const x = i % n;
    if ((x > 0 && province[i - 1] !== p) || (x < n - 1 && province[i + 1] !== p) || (i >= n && province[i - n] !== p) || (i < province.length - n && province[i + n] !== p)) {
      return BLACK;
    }
  }
  return src.palette[p] || src.ground[src.base[i] & 15];
}

/**
 * The colour of one grid pixel in a look.
 * @param {"political" | "province" | "culture" | "editCulture"} look
 * @param {object} src From makeSource.
 * @param {number} i Plane index, y * n + x.
 * @param {number} x
 * @param {number} y
 * @returns {number} Packed ABGR colour.
 */
export function pixelColour(look, src, i, x, y) {
  switch (look) {
    case "political":
      return politicalPixel(src, i);
    case "province":
      return provincePixel(src, i);
    case "culture":
      return culturePixel(src, i);
    case "editCulture":
      return editCulturePixel(src, i);
    default:
      console.warn("render: unknown look", look);
      return src.ground[src.base[i] & 15];
  }
}

// One loop per look keeps the look choice out of the per-pixel path.
function fillRect(look, src, rect, out) {
  const n = src.n;
  const { x0, y0, x1, y1 } = rect;
  switch (look) {
    case "political":
      for (let y = y0; y <= y1; y++) for (let x = x0, i = y * n + x0; x <= x1; x++, i++) out[i] = politicalPixel(src, i);
      break;
    case "province":
      for (let y = y0; y <= y1; y++) for (let x = x0, i = y * n + x0; x <= x1; x++, i++) out[i] = provincePixel(src, i);
      break;
    case "culture":
      for (let y = y0; y <= y1; y++) for (let x = x0, i = y * n + x0; x <= x1; x++, i++) out[i] = culturePixel(src, i);
      break;
    case "editCulture":
      for (let y = y0; y <= y1; y++) for (let x = x0, i = y * n + x0; x <= x1; x++, i++) out[i] = editCulturePixel(src, i);
      break;
    default:
      console.warn("render: unknown look", look);
  }
}

/**
 * A drawable surface: an OffscreenCanvas where the browser has one, else a canvas element.
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement | OffscreenCanvas}
 */
export function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * The cached picture of the current look.
 * @param {number} n Grid side.
 * @returns {{canvas: object, rebuild: Function, update: Function}} `rebuild(look, src)` repaints
 *   everything; `update(look, src, rect)` repaints an inclusive pixel rectangle.
 */
export function createLayerImage(n) {
  if (new Uint8Array(new Uint32Array([1]).buffer)[0] !== 1) {
    console.warn("render: big-endian platform; pixel colours will be wrong");
  }
  const canvas = makeCanvas(n, n);
  const g = canvas.getContext("2d");
  const image = g.createImageData(n, n);
  const pixels = new Uint32Array(image.data.buffer);
  const whole = { x0: 0, y0: 0, x1: n - 1, y1: n - 1 };

  return {
    canvas,
    rebuild(look, src) {
      fillRect(look, src, whole, pixels);
      g.putImageData(image, 0, 0);
    },
    update(look, src, rect) {
      // A province outline depends on the neighbours, so that look repaints one pixel wider on every side.
      const pad = look === "province" ? 1 : 0;
      const clipped = {
        x0: Math.max(0, rect.x0 - pad),
        y0: Math.max(0, rect.y0 - pad),
        x1: Math.min(n - 1, rect.x1 + pad),
        y1: Math.min(n - 1, rect.y1 + pad),
      };
      if (clipped.x1 < clipped.x0 || clipped.y1 < clipped.y0) return;
      fillRect(look, src, clipped, pixels);
      g.putImageData(image, 0, 0, clipped.x0, clipped.y0, clipped.x1 - clipped.x0 + 1, clipped.y1 - clipped.y0 + 1);
    },
  };
}

/** Grid pixels per overview pixel; the zoom picks the finest one whose rivers are wide enough to see. */
export const RIVER_LEVELS = [2, 4, 8];
const RIVER_MIN_WIDTH = 1.5;

/**
 * How coarse the river overlay must be so a river is at least RIVER_MIN_WIDTH screen pixels wide.
 * @param {number} k Screen pixels per grid pixel.
 * @returns {number} 1 when the grid's own river pixels are wide enough (no overlay), else one of RIVER_LEVELS.
 */
export function riverScale(k) {
  if (k >= RIVER_MIN_WIDTH) return 1;
  return RIVER_LEVELS.find((scale) => scale * k >= RIVER_MIN_WIDTH) ?? RIVER_LEVELS.at(-1);
}

/**
 * Shrinks the river bits of the base plane: an overview pixel is set when any grid pixel in its block is river.
 * @param {Uint8Array} base
 * @param {number} n Grid side.
 * @param {number} scale Grid pixels per overview pixel.
 * @returns {Uint8Array} Row-major, ceil(n / scale) pixels a side.
 */
export function riverMask(base, n, scale) {
  const side = Math.ceil(n / scale);
  const mask = new Uint8Array(side * side);
  for (let y = 0; y < n; y++) {
    const row = Math.floor(y / scale) * side;
    for (let x = 0, i = y * n; x < n; x++, i++) {
      if (base[i] & RIVER) mask[row + Math.floor(x / scale)] = 1;
    }
  }
  return mask;
}

/**
 * Coarser pictures of the rivers, drawn over the layer picture when zoomed out so a one-pixel river
 * does not vanish. Each level is built the first time its zoom is reached.
 * @param {number} n Grid side.
 * @param {Uint8Array} base The base plane, which never changes.
 * @returns {{levelFor: (k: number, colour: number) => ({canvas: object, scale: number} | null)}}
 *   `levelFor` returns null when no overlay is needed at zoom `k`; `colour` is the packed river colour.
 */
export function createRiverOverview(n, base) {
  const levels = new Map();

  function paint(level, colour) {
    const side = level.canvas.width;
    const g = level.canvas.getContext("2d");
    const image = g.createImageData(side, side);
    const pixels = new Uint32Array(image.data.buffer);
    for (let i = 0; i < level.mask.length; i++) if (level.mask[i]) pixels[i] = colour;
    g.putImageData(image, 0, 0);
    level.colour = colour;
  }

  return {
    levelFor(k, colour) {
      const scale = riverScale(k);
      if (scale === 1) return null;
      let level = levels.get(scale);
      if (!level) {
        const side = Math.ceil(n / scale);
        level = { scale, mask: riverMask(base, n, scale), canvas: makeCanvas(side, side), colour: null };
        levels.set(scale, level);
      }
      if (level.colour !== colour) paint(level, colour);
      return level;
    },
  };
}
