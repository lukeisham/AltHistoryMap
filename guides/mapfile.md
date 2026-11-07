# AltHistoryMap · mapfile — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

Reading and writing a map as one compressed file. **Input:** a model snapshot, or the bytes of a map file. **Output:** the bytes of a map file, or a decoded map for `model.replace`. **Essential functions:** `encodeMap`, `decodeMap`, `MAGIC` and `collectBounded`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── mapfile.js
└── streams.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `mapfile.js` | `model.js` | A marker's `colony` (boolean, default false, true only on a city that is not a capital), written on every save and optional on read. The header keys `crests`, a list of crest choice objects, and `countries`, a list of country records (see the `countrydata.js` row), each written on every save and optional on read: a file saved before either existed has no such key and opens with none. Each country record is written with `relation` and `overlord` only when set, and a file without them opens with none; a key the reader does not know is ignored, and a loop of overlords is refused. The format number (1) and `AHMAP001` are unchanged | Older maps stop opening; a new map fails in an older copy of the app |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `MapFileError` | saving |
| `StreamLimitError` | loading |
| `asScenarioCopy` | saving |
| `collectBounded` | loading |
| `decodeMap` | main, saving |
| `encodeMap` | saving |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| countrydata | `normaliseCountry`, `relationLoops` |
| crestcells | `normaliseCrest` |
| flagcells | `upscaleLegacyFlag` |
| model | `FLAG_H`, `FLAG_W`, `LAYERS`, `LEGACY_FLAG_SCALE`, `MARKER_TYPES`, `MAX_CRESTS`, `MAX_DESIGNS`, `MAX_NAME`, `MAX_PALETTE`, `MAX_TAG_OFFSET`, `N`, `PLANE_NAMES` |
