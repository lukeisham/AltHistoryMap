// A country is a political palette colour plus what the person has said about it. The record holds
// only what was set (colour names are worked out, never stored), and normaliseCountry is the one
// validator: model.js calls it on every edit and mapfile.js on every read. The flag and crest are
// indexes into the map's flag designs and crests, which are never removed, so an index stays valid.

import { ALIGNMENTS, ALIGNMENT_IDS, GOVERNMENT_TYPES } from "./alignmentpools.js";

export { ALIGNMENTS };

export const MAX_FIELD = 60;
export const MAX_MOTTO = 80;
/** Suggestions for the Type of Government field; any text is allowed. */
export const GOVERNMENTS = GOVERNMENT_TYPES.map((government) => government.type);

const TEXT_FIELDS = [
  { key: "name", max: MAX_FIELD },
  { key: "ruler", max: MAX_FIELD },
  { key: "government", max: MAX_FIELD },
  { key: "motto", max: MAX_MOTTO },
  { key: "currency", max: MAX_FIELD },
  { key: "demonym", max: MAX_FIELD },
];

// Named colours a swatch is matched against, so an unnamed country is still called something.
const COLOUR_NAMES = [
  ["Black", "#111111"], ["Charcoal", "#4a4a4a"], ["Grey", "#808080"], ["Silver", "#c0c0c0"], ["White", "#f5f5f5"],
  ["Crimson", "#b01030"], ["Red", "#d02020"], ["Brick red", "#b5473b"], ["Rose", "#e07a8a"], ["Pink", "#f2a0b8"],
  ["Orange", "#e07a1f"], ["Amber", "#c98b2b"], ["Ochre", "#b8862a"], ["Gold", "#d4a82a"], ["Mustard", "#d9c04a"],
  ["Yellow", "#eed940"], ["Lime", "#a4c639"], ["Moss", "#5c8a4d"], ["Green", "#2e8b3d"], ["Forest green", "#1f5a2e"],
  ["Teal", "#2a8a8a"], ["Turquoise", "#40c0c0"], ["Sky blue", "#6aaee0"], ["Steel blue", "#3f7f9c"], ["Blue", "#2a5fcf"],
  ["Navy", "#1c2f6b"], ["Indigo", "#4b3a8c"], ["Purple", "#6c5a9e"], ["Violet", "#8a4fc4"], ["Magenta", "#b0307a"],
  ["Brown", "#8a5a3c"], ["Chestnut", "#6b3a22"], ["Tan", "#c8a878"], ["Sand", "#e0cf9a"], ["Olive", "#7a7a2e"],
];
const FAR_FROM_NAMED = 90;

const rgb = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));

/**
 * @param {string} hex a palette colour, "#rrggbb"
 * @param {number} index its 1-based palette index
 * @returns {string} the nearest named colour, or "Colour N" when none is near
 */
export function colourNameFor(hex, index) {
  const target = rgb(hex);
  let best = null;
  for (const [name, named] of COLOUR_NAMES) {
    const distance = Math.hypot(...rgb(named).map((v, i) => v - target[i]));
    if (!best || distance < best.distance) best = { name, distance };
  }
  return best && best.distance <= FAR_FROM_NAMED ? best.name : `Colour ${index}`;
}

/**
 * @param {number} colour 1-based palette index
 * @returns {object} A country with nothing set.
 */
export function blankCountry(colour) {
  return { colour, name: "", ruler: "", government: "", motto: "", currency: "", demonym: "", alignment: "", flag: -1, crest: -1 };
}

/**
 * @param {object} country
 * @returns {boolean} True when nothing but the colour is set.
 */
export function isBlank(country) {
  const blank = blankCountry(country.colour);
  return Object.keys(blank).every((key) => country[key] === blank[key]);
}

/**
 * The one validator for a country. Text is trimmed.
 * @param {unknown} country
 * @param {number} paletteLength
 * @param {number} designCount
 * @param {number} crestCount
 * @returns {object | null} A clean copy, or null when anything is invalid.
 */
export function normaliseCountry(country, paletteLength, designCount, crestCount) {
  if (!country || typeof country !== "object") return null;
  const { colour, alignment = "", flag = -1, crest = -1 } = country;
  if (!Number.isInteger(colour) || colour < 1 || colour > paletteLength) return null;
  if (alignment !== "" && !ALIGNMENT_IDS.includes(alignment)) return null;
  if (!Number.isInteger(flag) || flag < -1 || flag >= designCount) return null;
  if (!Number.isInteger(crest) || crest < -1 || crest >= crestCount) return null;
  const clean = { colour, alignment, flag, crest };
  for (const { key, max } of TEXT_FIELDS) {
    const text = country[key] ?? "";
    if (typeof text !== "string" || text.trim().length > max) return null;
    clean[key] = text.trim();
  }
  return { ...blankCountry(colour), ...clean };
}

/**
 * @param {object | null | undefined} country the stored record, if any
 * @param {string} hex the colour's hex value
 * @param {number} colour its 1-based palette index
 * @returns {string} the name set on the country, or the colour's name
 */
export function countryName(country, hex, colour) {
  return country?.name || colourNameFor(hex, colour);
}
