// A country is a political palette colour plus what the person has said about it. The record holds
// only what was set (colour names are worked out, never stored), and normaliseCountry is the one
// validator: model.js calls it on every edit and mapfile.js on every read. The flag and crest are
// indexes into the map's flag designs and crests, which are never removed, so an index stays valid.

import { ALIGNMENTS, ALIGNMENT_IDS, GOVERNMENT_TYPES } from "./alignmentpools.js";

export { ALIGNMENTS };

/** How a country can answer to another: the share of the other colour mixed into its own on the Political look. */
export const RELATIONS = [
  { id: "dominion", label: "Dominion", share: 0.25 },
  { id: "client", label: "Client State", share: 0.45 },
  { id: "colony", label: "Colony", share: 0.65 },
];
const RELATION_IDS = RELATIONS.map((relation) => relation.id);

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
/** Channel difference below which two colours count as the same; screen sampling rounds each channel. layerimage.js groups colours by it too. */
export const SAME_COLOUR_TOLERANCE = 3;

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

const looksSame = (a, b) => Math.max(...rgb(a).map((v, i) => Math.abs(v - rgb(b)[i]))) < SAME_COLOUR_TOLERANCE;
const lightness = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/**
 * The name a colour goes by when its country has none. Colours that look the same share one name; two
 * different colours whose nearest named colour is the same differ by a lightness word, so two countries
 * are never called the same. Dark, base and Light by lightness; a fourth or later colour takes its number.
 * @param {string[]} palette the map's hex colours
 * @param {number} colour 1-based palette index
 * @returns {string}
 */
export function defaultColourName(palette, colour) {
  const root = (index) => palette.findIndex((hex, earlier) => earlier <= index && looksSame(hex, palette[index])) + 1;
  const base = colourNameFor(palette[colour - 1], root(colour - 1));
  const sameName = palette
    .map((_, i) => i + 1)
    .filter((i) => root(i - 1) === i && colourNameFor(palette[i - 1], i) === base);
  if (sameName.length < 2) return base;
  const own = root(colour - 1);
  const ranked = sameName.sort((a, b) => lightness(palette[a - 1]) - lightness(palette[b - 1]));
  const rank = ranked.indexOf(own);
  const word = (adjective) => `${adjective} ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
  if (ranked.length === 2) return rank === 0 ? base : word("Light");
  if (rank === 0) return word("Dark");
  if (rank === ranked.length - 1) return word("Light");
  return rank === 1 ? base : `${base} ${own}`;
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
  return !country.relation && Object.keys(blank).every((key) => country[key] === blank[key]);
}

/**
 * @param {{colour: number, overlord?: number}[]} countries the map's country records
 * @param {number} colour the country that would answer to `overlord`
 * @param {number} overlord the colour it would answer to
 * @returns {boolean} True when following the overlords from `overlord` comes back to `colour`.
 */
export function relationLoops(countries, colour, overlord) {
  const seen = new Set();
  for (let at = overlord; at && !seen.has(at); at = countries.find((country) => country.colour === at)?.overlord) {
    if (at === colour) return true;
    seen.add(at);
  }
  return false;
}

/**
 * The one validator for a country. Text is trimmed. `overlord` and `relation` are kept only as a pair; a
 * country with neither has neither key.
 * @param {unknown} country
 * @param {number} paletteLength
 * @param {number} designCount
 * @param {number} crestCount
 * @returns {object | null} A clean copy, or null when anything is invalid.
 */
export function normaliseCountry(country, paletteLength, designCount, crestCount) {
  if (!country || typeof country !== "object") return null;
  const { colour, alignment = "", flag = -1, crest = -1, overlord = 0, relation = "" } = country;
  if (!Number.isInteger(colour) || colour < 1 || colour > paletteLength) return null;
  if (alignment !== "" && !ALIGNMENT_IDS.includes(alignment)) return null;
  if (!Number.isInteger(flag) || flag < -1 || flag >= designCount) return null;
  if (!Number.isInteger(crest) || crest < -1 || crest >= crestCount) return null;
  const related = relation !== "" || overlord !== 0;
  if (related && (!RELATION_IDS.includes(relation) || !Number.isInteger(overlord) || overlord < 1 || overlord > paletteLength || overlord === colour)) return null;
  const clean = { colour, alignment, flag, crest };
  for (const { key, max } of TEXT_FIELDS) {
    const text = country[key] ?? "";
    if (typeof text !== "string" || text.trim().length > max) return null;
    clean[key] = text.trim();
  }
  return { ...blankCountry(colour), ...clean, ...(related ? { overlord, relation } : {}) };
}

/**
 * @param {object | null | undefined} country the stored record, if any
 * @param {string[]} palette the map's hex colours
 * @param {number} colour its 1-based palette index
 * @returns {string} the name set on the country, or the colour's name
 */
export function countryName(country, palette, colour) {
  return country?.name || defaultColourName(palette, colour);
}
