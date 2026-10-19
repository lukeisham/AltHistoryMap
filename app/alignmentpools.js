// The word and phrase pools that the nine alignment squares choose between. namegen.js reads them to
// generate a country's government, name, ruler and Latin motto; countrydata.js reads ALIGNMENTS to
// check a saved alignment and GOVERNMENT_TYPES for the suggestions list. An empty alignment id means
// "no steering": every pool is the whole list.

/**
 * The nine squares, row by row (good, neutral, evil) and left to right within a row (lawful, neutral, chaotic).
 * `law` and `moral` are the axis values that the pools below are tagged with.
 */
export const ALIGNMENTS = [
  { id: "lawful-good", label: "Lawful good", law: "lawful", moral: "good" },
  { id: "neutral-good", label: "Neutral good", law: "neutral", moral: "good" },
  { id: "chaotic-good", label: "Chaotic good", law: "chaotic", moral: "good" },
  { id: "lawful-neutral", label: "Lawful neutral", law: "lawful", moral: "neutral" },
  { id: "true-neutral", label: "True neutral", law: "neutral", moral: "neutral" },
  { id: "chaotic-neutral", label: "Chaotic neutral", law: "chaotic", moral: "neutral" },
  { id: "lawful-evil", label: "Lawful evil", law: "lawful", moral: "evil" },
  { id: "neutral-evil", label: "Neutral evil", law: "neutral", moral: "evil" },
  { id: "chaotic-evil", label: "Chaotic evil", law: "chaotic", moral: "evil" },
];

export const ALIGNMENT_IDS = ALIGNMENTS.map((alignment) => alignment.id);

/**
 * Each type of government with the head noun of a formal country name ("Kingdom" gives "Kingdom of X",
 * null gives the bare name) and the titles its ruler can hold.
 */
export const GOVERNMENT_TYPES = [
  { type: "Monarchy", head: "Kingdom", titles: ["King", "Queen"] },
  { type: "Constitutional monarchy", head: "Kingdom", titles: ["King", "Queen"] },
  { type: "Absolute monarchy", head: "Kingdom", titles: ["King", "Queen", "Tsar"] },
  { type: "Elective monarchy", head: "Kingdom", titles: ["King", "High King"] },
  { type: "Empire", head: "Empire", titles: ["Emperor", "Empress"] },
  { type: "Sultanate", head: "Sultanate", titles: ["Sultan"] },
  { type: "Caliphate", head: "Caliphate", titles: ["Caliph"] },
  { type: "Khanate", head: "Khanate", titles: ["Khan", "Great Khan"] },
  { type: "Principality", head: "Principality", titles: ["Prince", "Princess"] },
  { type: "Grand duchy", head: "Grand Duchy", titles: ["Grand Duke", "Grand Duchess"] },
  { type: "Republic", head: "Republic", titles: ["President", "Consul"] },
  { type: "Commonwealth", head: "Commonwealth", titles: ["Chancellor", "Lord Protector"] },
  { type: "Federation", head: "Federation", titles: ["Chancellor", "President"] },
  { type: "Confederation", head: "Confederation", titles: ["Speaker", "Chairman"] },
  { type: "City-state", head: "Free City", titles: ["Doge", "Mayor"] },
  { type: "Theocracy", head: "Holy Realm", titles: ["High Priest", "Pontiff"] },
  { type: "Oligarchy", head: "League", titles: ["First Councillor", "Archon"] },
  { type: "Junta", head: "State", titles: ["General", "Marshal"] },
  { type: "Tyranny", head: "Dominion", titles: ["Tyrant", "Overlord"] },
  { type: "Horde", head: "Horde", titles: ["Warlord", "Khan"] },
  { type: "Warlord state", head: "Warband", titles: ["Warlord"] },
  { type: "Tribal confederacy", head: "Tribes", titles: ["Chieftain", "Elder"] },
  { type: "Anarchist commune", head: "Free Commune", titles: ["Speaker", "Spokesperson"] },
];

/** Used when a ruler is generated for a government the list does not know (one typed by hand). */
export const FALLBACK_TITLES = ["Ruler", "Leader"];

const GOVERNMENTS_BY_ALIGNMENT = {
  "lawful-good": ["Monarchy", "Constitutional monarchy", "Republic", "Commonwealth", "Principality", "Federation"],
  "neutral-good": ["Commonwealth", "Federation", "Republic", "Confederation", "City-state"],
  "chaotic-good": ["City-state", "Anarchist commune", "Tribal confederacy", "Confederation"],
  "lawful-neutral": ["Empire", "Absolute monarchy", "Oligarchy", "Sultanate", "Republic", "Grand duchy"],
  "true-neutral": ["Elective monarchy", "City-state", "Confederation", "Khanate", "Principality", "Republic"],
  "chaotic-neutral": ["Tribal confederacy", "Khanate", "Anarchist commune", "City-state", "Elective monarchy"],
  "lawful-evil": ["Empire", "Absolute monarchy", "Junta", "Theocracy", "Oligarchy", "Tyranny"],
  "neutral-evil": ["Oligarchy", "Junta", "Tyranny", "Empire", "Theocracy"],
  "chaotic-evil": ["Horde", "Tyranny", "Warlord state", "Junta", "Khanate"],
};

/** Words that may stand before a formal name: "Holy Kingdom of X". */
const NAME_ADJECTIVES = {
  "lawful-good": ["Holy", "Royal", "Noble", "Blessed"],
  "neutral-good": ["Free", "Fair", "United", "Green"],
  "chaotic-good": ["Free", "Merry", "Open"],
  "lawful-neutral": ["Grand", "High", "Ancient"],
  "true-neutral": ["Old", "Grey", "Middle"],
  "chaotic-neutral": ["Wild", "Shifting", "Wandering"],
  "lawful-evil": ["Iron", "Dread", "Imperial"],
  "neutral-evil": ["Black", "Hollow", "Gilded"],
  "chaotic-evil": ["Blood", "Savage", "Black"],
};

const EPITHETS = {
  "lawful-good": ["the Just", "the Wise", "the Faithful", "the Righteous", "the Steadfast"],
  "neutral-good": ["the Kind", "the Fair", "the Peacemaker", "the Healer", "the Generous"],
  "chaotic-good": ["the Free", "the Liberator", "the Bold", "the Merry", "the Wanderer"],
  "lawful-neutral": ["the Steward", "the Lawgiver", "the Stern", "the Builder", "the Careful"],
  "true-neutral": ["the Patient", "the Balanced", "the Quiet", "the Traveller", "the Even-handed"],
  "chaotic-neutral": ["the Wild", "the Unready", "the Fickle", "the Restless", "the Reckless"],
  "lawful-evil": ["the Iron", "the Merciless", "the Tyrant", "the Cold", "the Unyielding"],
  "neutral-evil": ["the Grasping", "the Cunning", "the Schemer", "the Usurper", "the Avaricious"],
  "chaotic-evil": ["the Cruel", "the Mad", "the Butcher", "the Bloody", "the Destroyer"],
};

/**
 * Latin nouns for mottos. `nom` is the nominative and `abl` the ablative singular (plural for Tenebrae),
 * the only two cases the motto templates in namegen.js use. `law` and `moral` list the axis values the
 * word suits; an empty list suits every value of that axis.
 */
const noun = (nom, abl, law = [], moral = []) => ({ nom, abl, law, moral });
export const MOTTO_NOUNS = [
  noun("Lex", "Lege", ["lawful"]),
  noun("Ordo", "Ordine", ["lawful"]),
  noun("Iustitia", "Iustitia", ["lawful", "neutral"], ["good", "neutral"]),
  noun("Fides", "Fide", ["lawful"], ["good", "neutral"]),
  noun("Honor", "Honore", ["lawful", "neutral"], ["good", "neutral"]),
  noun("Virtus", "Virtute", [], ["good", "neutral"]),
  noun("Pax", "Pace", ["lawful", "neutral"], ["good", "neutral"]),
  noun("Libertas", "Libertate", ["chaotic", "neutral"], ["good", "neutral"]),
  noun("Veritas", "Veritate", [], ["good", "neutral"]),
  noun("Concordia", "Concordia", ["lawful", "neutral"], ["good"]),
  noun("Patria", "Patria", ["lawful", "neutral"]),
  noun("Gloria", "Gloria"),
  noun("Fortitudo", "Fortitudine"),
  noun("Sapientia", "Sapientia", ["lawful", "neutral"], ["good", "neutral"]),
  noun("Misericordia", "Misericordia", [], ["good"]),
  noun("Spes", "Spe", ["neutral", "chaotic"], ["good", "neutral"]),
  noun("Amor", "Amore", ["chaotic", "neutral"], ["good"]),
  noun("Fortuna", "Fortuna", ["neutral", "chaotic"]),
  noun("Natura", "Natura", ["neutral", "chaotic"], ["good", "neutral"]),
  noun("Aequitas", "Aequitate", ["lawful", "neutral"], ["good", "neutral"]),
  noun("Tempus", "Tempore", ["neutral"], ["neutral"]),
  noun("Unitas", "Unitate", ["lawful"], ["good", "neutral"]),
  noun("Auctoritas", "Auctoritate", ["lawful"], ["neutral", "evil"]),
  noun("Disciplina", "Disciplina", ["lawful"], ["neutral", "evil"]),
  noun("Imperium", "Imperio", ["lawful"], ["neutral", "evil"]),
  noun("Dominatio", "Dominatione", ["lawful"], ["evil"]),
  noun("Potentia", "Potentia", [], ["neutral", "evil"]),
  noun("Ferrum", "Ferro", [], ["neutral", "evil"]),
  noun("Mors", "Morte", [], ["evil"]),
  noun("Ira", "Ira", ["chaotic", "neutral"], ["evil"]),
  noun("Timor", "Timore", [], ["evil"]),
  noun("Furor", "Furore", ["chaotic"], ["evil"]),
  noun("Sanguis", "Sanguine", ["chaotic", "neutral"], ["evil"]),
  noun("Tenebrae", "Tenebris", ["chaotic", "neutral"], ["evil"]),
  noun("Audacia", "Audacia", ["chaotic"]),
  noun("Bellum", "Bello", ["neutral", "chaotic"], ["neutral", "evil"]),
  noun("Ambitio", "Ambitione", ["neutral", "lawful"], ["neutral", "evil"]),
  noun("Pecunia", "Pecunia", ["neutral", "lawful"], ["neutral", "evil"]),
  noun("Commercium", "Commercio", ["lawful", "neutral"], ["neutral"]),
  noun("Labor", "Labore", ["lawful", "neutral"], ["good", "neutral"]),
  noun("Industria", "Industria", ["lawful"], ["good", "neutral"]),
  noun("Memoria", "Memoria", ["neutral", "lawful"], ["good", "neutral"]),
];

const alignmentOf = (id) => ALIGNMENTS.find((alignment) => alignment.id === id) ?? null;

/**
 * @param {string} alignment an alignment id, or "" for none
 * @returns {{type: string, head: string | null, titles: string[]}[]} the governments this square chooses from
 */
export function governmentPool(alignment) {
  const wanted = GOVERNMENTS_BY_ALIGNMENT[alignment];
  return wanted ? GOVERNMENT_TYPES.filter((government) => wanted.includes(government.type)) : GOVERNMENT_TYPES;
}

/** @returns {string[]} words that may stand before a formal name */
export function adjectivePool(alignment) {
  return NAME_ADJECTIVES[alignment] ?? Object.values(NAME_ADJECTIVES).flat();
}

/** @returns {string[]} epithets for a ruler */
export function epithetPool(alignment) {
  return EPITHETS[alignment] ?? Object.values(EPITHETS).flat();
}

/** @returns {{nom: string, abl: string}[]} the motto nouns that suit this square */
export function mottoPool(alignment) {
  const square = alignmentOf(alignment);
  if (!square) return MOTTO_NOUNS;
  const suits = (values, wanted) => values.length === 0 || values.includes(wanted);
  return MOTTO_NOUNS.filter((word) => suits(word.law, square.law) && suits(word.moral, square.moral));
}

/**
 * How hard the square wants a name to sound: -1 soft (good), 0 plain, 1 hard (evil).
 * @param {string} alignment
 * @returns {number}
 */
export function hardnessBias(alignment) {
  const square = alignmentOf(alignment);
  if (!square) return 0;
  return { good: -1, neutral: 0, evil: 1 }[square.moral];
}

/**
 * Syllables a name may have: chaotic names may run one syllable longer than the rest.
 * @param {string} alignment
 * @returns {{min: number, max: number}}
 */
export function syllableRange(alignment) {
  return { min: 2, max: alignmentOf(alignment)?.law === "chaotic" ? 4 : 3 };
}
