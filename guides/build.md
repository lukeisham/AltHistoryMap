# AltHistoryMap · build — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The scripts that make the base map, the scenarios and the glyphs. **Input:** downloaded Natural Earth and Lucide files and one polygon source per scenario. **Output:** `basemap.bin`, the `.ahmap` scenario files, `index.json` and `glyphs.js`. **Essential functions:** `build_basemap.py`, `build_scenarios.py`, `build_glyphs.py` and `raster.py`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
build/
├── build_basemap.py
├── build_scenarios.py
├── build_glyphs.py
├── raster.py
└── preview_scenario.py
```

## Cross-module behaviour

**Why a build step.** The base map is rasterised here so the browser loads one small file and never parses geometry; scenarios use the map-file format so the app opens one with the one reader it already has.

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `build/` scripts | `app/data/`, `app/glyphs.js` | `basemap.bin` (`AHBASE01` + zlib; bits LAND=1 RIVER=2 LAKE=4 COAST=8; COAST marks any water pixel, sea or lake, beside land), `.ahmap` scenario files (gzip; `AHMAP001` + JSON header + five 4096 x 4096 planes: political, culture, province, reserved, border; `reserved` is always zero), `index.json`. Rebuild with `python3 build/build_scenarios.py [id ...]`, `python3 build/build_basemap.py`, `python3 build/build_glyphs.py` | The Python writer and the JavaScript reader (`mapfile.js`, `api.js`, `model.js`) must stay in step; `test_scenarios.py` decodes Python output with the real reader |
| `build/raster.py` | `app/model.js` | The same Mercator formula, 4096 grid, latitude clamp 85.0511 | Scenarios land in the wrong place |
| `build/build_scenarios.py` | `app/flagcells.js` | Starter flag layouts (ported, compared by a test); a scenario source draws a flag as 24 x 16 `rows`, each cell scaled to a 5 x 5 square (`SOURCE_SCALE`) | Scenario flags differ from the designer's starters |
| `build/build_scenarios.py` | `app/countrydata.js`, `app/mapfile.js` | An optional source key `countries`: one record per political colour, keys `colour`, `name`, `ruler`, `government`, `motto`, `currency`, `demonym`, limited to the lengths in `countrydata.js` (`COUNTRY_TEXT_LIMITS` mirrors them). The builder writes each as a saved country with `alignment` empty and `flag` and `crest` -1, and writes no `countries` key when the source has none. A `.sources.md` file beside each source in `build/scenarios/` records the citation and the check behind every filled field; a field no source supported is blank | A scenario whose countries the reader refuses, or whose key facts differ from its source |

**Interface.** None in code: the data files it writes are the contract, in the rows above.

**Uses.** No other module in code.
