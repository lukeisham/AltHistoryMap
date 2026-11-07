# AltHistoryMap · countryfacts — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The Key Facts dialog, its name generators and the drops that link a crest or flag to a country. **Input:** a click on painted land in View mode, a swatch double-click, the Key facts button, and crests or designs dropped on land or a swatch. **Output:** country edits made through the editor, and generated names, rulers, mottos, demonyms and currencies. **Essential functions:** `createCountries`, `createCountryFacts`, `generateAll` and the `make…` generators, which take a random function so tests can fix it.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── countryfacts.js
├── countryfacts.css
├── namegen.js
└── countries.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `namegen.js` | `countryfacts.js` | Pure `makeGovernment`, `makeName`, `makeRuler`, `makeMotto`, `makeDemonym`, `makeCurrency` and `generateAll`, in the order government, name, ruler, motto, demonym; `generateAll` leaves currency alone and only the Currency row's own Generate button fills it, from the name as typed or its default. Each takes `rng` (`Math.random` in `main.js`, a fixed function in tests). A motto has only three shapes, `A et B`, `Pro B` and `A ante omnia`, built from stored case forms, so none is ungrammatical | Output that differs between runs of a test, or a motto that needs a word to agree with another |
| `countries.js` | `main.js`, `stage.js`, `palette.js` | `createCountries` is built in `main.js` and handed to the stage and the palette. The Key Facts dialog has no relationship control: it keeps a country's `relation` and `overlord` as they were and saves them back with the other facts, and `relations.js` is the only place they are chosen. The Key Facts dialog opens from the button `data-role="country-facts-open"`, a swatch double-click, and a click on painted land in View mode (`stage.js` waits `FACTS_DELAY_MS`, 300 milliseconds, so a double-click still zooms). A crest dropped on painted land (`dropOnLand`, which reads the Political plane) or a crest or flag design dropped on a swatch (`dropOnColour`) is linked to that country; a flag dropped on the map still places a flag marker. Every change goes through `editor.setCountry`, so View mode refuses it | A drop that links nothing, or a double-click that opens the pop-up instead of zooming |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `createCountries` | main |
| `createCountryFacts` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| countrydata | `ALIGNMENTS`, `FALLBACK_TITLES`, `GOVERNMENTS`, `GOVERNMENT_TYPES`, `MAX_FIELD`, `MAX_MOTTO`, `adjectivePool`, `countryName`, `defaultColourName`, `epithetPool`, `governmentPool`, `hardnessBias`, `mottoPool`, `syllableRange` |
| crestcells | `CREST_H`, `CREST_W`, `renderCrest` |
| dialogs | `bindTermTips`, `dialogParts` |
| dragitem | `hasDragItem`, `readDragItem` |
| flagdesigner | `drawThumb` |
| model | `FLAG_H`, `FLAG_W` |
| pngexport | `drawCells` |
| render | `BLOCK_COLS`, `BLOCK_ROWS` |
