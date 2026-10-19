// Pure generators for a country's government, name, ruler, Latin motto and demonym. Every function
// takes `rng`, a function returning a number from 0 up to but not including 1, so a test with a fixed
// one gets the same output every time. The alignment (see alignmentpools.js) narrows each choice;
// an empty alignment leaves every pool whole. countryfacts.js calls these from its Generate buttons.

import {
  FALLBACK_TITLES,
  GOVERNMENT_TYPES,
  adjectivePool,
  epithetPool,
  governmentPool,
  hardnessBias,
  mottoPool,
  syllableRange,
} from "./alignmentpools.js";

/** The sound a name is built from; "any" picks one of the others at random. */
export const STYLES = [
  { id: "any", label: "Any" },
  { id: "latin", label: "Latin" },
  { id: "norse", label: "Norse" },
  { id: "arabic", label: "Arabic" },
  { id: "eastasian", label: "East Asian" },
  { id: "slavic", label: "Slavic" },
  { id: "celtic", label: "Celtic" },
];

const SOUNDS = {
  latin: {
    onsets: ["v", "l", "m", "r", "c", "t", "s", "p", "b", "d", "f", "g", "n", "qu"],
    vowels: ["a", "e", "i", "o", "u", "ae"],
    codas: ["", "", "n", "r", "s", "m", "x"],
    ends: ["ia", "ium", "ora", "ana", "onia", "ica"],
  },
  norse: {
    onsets: ["h", "g", "k", "sk", "st", "v", "b", "r", "th", "fj", "tr", "br", "d", "j"],
    vowels: ["a", "o", "u", "e", "i", "ei"],
    codas: ["", "", "r", "n", "d", "rn", "ld", "ng"],
    ends: ["land", "heim", "mark", "gard", "vik", "holm"],
  },
  arabic: {
    onsets: ["h", "k", "m", "s", "z", "b", "t", "d", "j", "r", "sh", "kh", "q", "n", "f", "l"],
    vowels: ["a", "i", "u", "ai"],
    codas: ["", "", "r", "n", "m", "b", "d", "l", "z"],
    ends: ["iyah", "abad", "stan", "ar", "an"],
  },
  eastasian: {
    onsets: ["k", "t", "s", "h", "m", "n", "r", "y", "w", "j", "sh", "ch", "zh", "l"],
    vowels: ["a", "i", "u", "e", "o", "ao", "ei"],
    codas: ["", "", "", "n", "ng"],
    ends: ["an", "ang", "uo", "in"],
  },
  slavic: {
    onsets: ["v", "z", "k", "s", "b", "d", "m", "p", "r", "st", "sl", "kr", "zl", "pr", "gr", "dr", "vl"],
    vowels: ["a", "o", "e", "i", "u", "y"],
    codas: ["", "", "v", "n", "k", "l", "r", "sk"],
    ends: ["ia", "ovia", "grad", "ov", "ska", "stan"],
  },
  celtic: {
    onsets: ["b", "c", "d", "g", "m", "t", "l", "r", "n", "cl", "gl", "br", "tr", "ll", "f", "th"],
    vowels: ["a", "e", "i", "o", "u", "ae", "ei", "ie"],
    codas: ["", "", "n", "r", "th", "gh", "dd", "l"],
    ends: ["ach", "wyn", "mor", "land", "ia", "an", "ford"],
  },
};
const SOUND_IDS = Object.keys(SOUNDS);

// Letters that make a cluster sound harsh or soft; the alignment leans the choice towards one set.
const HARD_SOUND = /[kgdtzxq]|th|kh|gh|zh/;
const SOFT_SOUND = /^[lmnrvwhfsy]+$/;
const BIAS_WEIGHT = 3;
const MAX_NAME_LETTERS = 13;
const MIN_NAME_LETTERS = 4;
const ATTEMPTS = 20;

// How to turn a demonym out of the last word of a country's name.
const DEMONYM_SUFFIX = { latin: "ian", norse: "ish", arabic: "i", eastasian: "ese", slavic: "ian", celtic: "ish", any: "ish" };

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const chance = (probability, rng) => rng() < probability;
const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1);

function pickLeaning(list, bias, rng) {
  if (bias === 0) return pick(list, rng);
  const weights = list.map((cluster) => {
    if (HARD_SOUND.test(cluster)) return bias > 0 ? BIAS_WEIGHT : 1;
    if (SOFT_SOUND.test(cluster)) return bias < 0 ? BIAS_WEIGHT : 1;
    return 1;
  });
  let roll = rng() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i];
    if (roll < 0) return list[i];
  }
  return list[list.length - 1];
}

function concreteStyle(style, rng) {
  return SOUNDS[style] ? style : pick(SOUND_IDS, rng);
}

// Only the last syllable of a stem takes a closing consonant, so "Valor-ia" and "Tarken" read as words
// and "Valrtia" cannot happen.
function syllable(sound, bias, closed, rng) {
  return pickLeaning(sound.onsets, bias, rng) + pick(sound.vowels, rng) + (closed ? pick(sound.codas, rng) : "");
}

// A run of three vowels, a doubled vowel or three of one letter never reads as a word, and a name too
// short or too long is retried; the join between a stem and its suffix is where these happen.
function readable(word) {
  const length = word.length;
  return length >= MIN_NAME_LETTERS && length <= MAX_NAME_LETTERS && !/[aeiouy]{3}|([aeiouy])\1|(.)\2\2/.test(word);
}

function buildWord(style, alignment, { suffix }, rng) {
  const sound = SOUNDS[concreteStyle(style, rng)];
  const { min, max } = syllableRange(alignment);
  const bias = hardnessBias(alignment);
  let word = "";
  for (let attempt = 0; attempt < ATTEMPTS && !readable(word); attempt++) {
    const ending = suffix && chance(0.7, rng) ? pick(sound.ends, rng) : "";
    // A suffix counts as a syllable.
    const count = Math.max(1, min + Math.floor(rng() * (max - min + 1)) - (ending ? 1 : 0));
    const stem = Array.from({ length: count }, (_, i) => syllable(sound, bias, !ending && i === count - 1, rng));
    word = stem.join("") + ending;
  }
  return capitalise(word);
}

const governmentFor = (type) => GOVERNMENT_TYPES.find((government) => government.type === type) ?? null;

/**
 * @param {string} alignment an alignment id, or "" for none
 * @param {() => number} rng
 * @returns {string} a type of government from the square's pool
 */
export function makeGovernment(alignment, rng) {
  return pick(governmentPool(alignment), rng).type;
}

/**
 * @param {string} style a STYLES id
 * @param {string} alignment an alignment id, or ""
 * @param {string} government a type of government, or "" for none
 * @param {() => number} rng
 * @returns {string} a country name; a formal one such as "Free Republic of Valoria" about half the time when the government has a head noun
 */
export function makeName(style, alignment, government, rng) {
  const base = buildWord(style, alignment, { suffix: true }, rng);
  const head = governmentFor(government)?.head;
  if (!head || !chance(0.5, rng)) return base;
  const adjective = pick(adjectivePool(alignment), rng);
  // A head that already carries an adjective ("Free City") takes no second one.
  const useAdjective = chance(0.5, rng) && !head.includes(" ");
  return `${useAdjective ? `${adjective} ` : ""}${head} of ${base}`;
}

/**
 * @param {string} style a STYLES id
 * @param {string} alignment an alignment id, or ""
 * @param {string} government a type of government, or ""
 * @param {() => number} rng
 * @returns {string} a ruler such as "Queen Marvane II the Just": a title for the government, a given name, sometimes a number, usually an epithet
 */
export function makeRuler(style, alignment, government, rng) {
  const title = pick(governmentFor(government)?.titles ?? FALLBACK_TITLES, rng);
  const given = buildWord(style, alignment, { suffix: false }, rng);
  const number = chance(0.2, rng) ? ` ${pick(["II", "III", "IV", "V"], rng)}` : "";
  const epithet = chance(0.7, rng) ? ` ${pick(epithetPool(alignment), rng)}` : "";
  return `${title} ${given}${number}${epithet}`;
}

/**
 * Builds a Latin motto from three shapes that need no word to agree with another: "A et B" (two
 * nominatives), "Pro B" (the ablative that "pro" takes) and "A ante omnia".
 * @param {string} alignment an alignment id, or ""
 * @param {() => number} rng
 * @returns {string}
 */
export function makeMotto(alignment, rng) {
  const pool = mottoPool(alignment);
  const first = pick(pool, rng);
  const shape = Math.floor(rng() * 3);
  if (shape === 1) return `Pro ${first.abl}`;
  if (shape === 2) return `${first.nom} ante omnia`;
  const others = pool.filter((word) => word !== first);
  return `${first.nom} et ${pick(others, rng).nom}`;
}

/**
 * The people of a country, from the last place-word of its name: "Free Republic of Valoria" gives "Valorian".
 * @param {string} name
 * @param {string} style a STYLES id; it picks the ending for names that end in a consonant
 * @returns {string} "" when the name has no letters
 */
export function makeDemonym(name, style) {
  const place = name.split(/\s+of\s+/i).pop().trim().split(/\s+/).pop().replace(/[^\p{L}'-]/gu, "");
  if (!place) return "";
  if (/ia$/i.test(place)) return `${place}n`;
  if (/land$/i.test(place)) return `${place}er`;
  if (/stan$/i.test(place)) return `${place}i`;
  if (/[aou]$/i.test(place)) return `${place}n`;
  if (/[ei]$/i.test(place)) return `${place.slice(0, -1)}ian`;
  return `${place}${DEMONYM_SUFFIX[style] ?? DEMONYM_SUFFIX.any}`;
}

/**
 * Generates everything in the order the facts depend on each other: government, name, ruler, motto, demonym.
 * @param {{style: string, alignment: string, rng: () => number}} options
 * @returns {{government: string, name: string, ruler: string, motto: string, demonym: string}}
 */
export function generateAll({ style, alignment, rng }) {
  const sound = concreteStyle(style, rng);
  const government = makeGovernment(alignment, rng);
  const name = makeName(sound, alignment, government, rng);
  return {
    government,
    name,
    ruler: makeRuler(sound, alignment, government, rng),
    motto: makeMotto(alignment, rng),
    demonym: makeDemonym(name, sound),
  };
}
