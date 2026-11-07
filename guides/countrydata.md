# AltHistoryMap · countrydata — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

What a country is: one political colour with its facts, relationship and links. **Input:** a country patch from the model or a record read from a map file, and a palette. **Output:** a validated record, the relationship kinds, the default name of a colour, and the nine alignment pools the generators draw on. **Essential functions:** `normaliseCountry`, `relationLoops`, `countryName`, `defaultColourName` and `ALIGNMENTS`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── countrydata.js
└── alignmentpools.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `countrydata.js` | `model.js`, `mapfile.js`, `countries.js`, `countryfacts.js` | A country is a political palette colour. Its record is `colour`, `name`, `ruler`, `government`, `motto`, `currency`, `demonym`, `alignment` (one of the nine ids in `alignmentpools.js`, or empty), `flag` (a design index or -1) and `crest` (a crest index or -1). Two optional keys, `relation` (`client`, `dominion` or `colony`, the `RELATIONS` list; each share is how much white is mixed into the country's own colour, 0.25, 0.5 and 0.8, so Client State is the darkest and Colony very light) and `overlord` (another colour's palette index), exist only together and only when set: a country answers to another colour, and `normaliseCountry` refuses one key without the other, an unknown kind, a colour not in the palette, or a country as its own overlord. `relationLoops(countries, colour, overlord)` tells whether a chain of overlords returns to the country; `model.js` `setCountry` and `mapfile.js` both refuse a loop. `normaliseCountry` is the one validator; `model.js` calls it on every edit and `mapfile.js` on every read. A blank `name` is shown as the colour's own name (`defaultColourName(palette, colour)`, built on `colourNameFor`): colours that look the same share one name, and two different colours with the same nearest name differ by Dark or Light by lightness, so no two countries show one name. A default name is never stored. Designs and crests are never removed, so an index stays valid. A country links to its crest, so editing the crest changes the country, unlike `stampCrest`, which copies. `model.countries` holds only countries with something set, and a relationship counts as something set | A country the reader refuses; a stored default name that goes stale when the colour changes |
| `alignmentpools.js` | `namegen.js`, `countrydata.js` | `ALIGNMENTS`: the nine ids `lawful-good`, `neutral-good`, `chaotic-good`, `lawful-neutral`, `true-neutral`, `chaotic-neutral`, `lawful-evil`, `neutral-evil`, `chaotic-evil`, each with its `law` and `moral` axis value. Per square, pools of governments, name adjectives, epithets and Latin motto nouns (`nom` and `abl`); an empty alignment uses every pool whole. The ids are stored in the map file | An id removed from the list makes every country that names it refuse to open |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `ALIGNMENTS` | countryfacts |
| `FALLBACK_TITLES` | countryfacts |
| `GOVERNMENTS` | countryfacts |
| `GOVERNMENT_TYPES` | countryfacts |
| `MAX_FIELD` | countryfacts |
| `MAX_MOTTO` | countryfacts |
| `RELATIONS` | relations, render |
| `SAME_COLOUR_TOLERANCE` | render |
| `adjectivePool` | countryfacts |
| `blankCountry` | model |
| `countryName` | countryfacts, palette, relations, render |
| `defaultColourName` | countryfacts |
| `epithetPool` | countryfacts |
| `governmentPool` | countryfacts |
| `hardnessBias` | countryfacts |
| `isBlank` | model |
| `mottoPool` | countryfacts |
| `normaliseCountry` | mapfile, model |
| `relationLoops` | mapfile, model, relations |
| `syllableRange` | countryfacts |

**Uses.** No other module.
