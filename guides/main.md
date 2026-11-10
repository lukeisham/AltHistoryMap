# AltHistoryMap · main — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The page's start-up and the hand-offs between modules. **Input:** `index.html` and every module's factory. **Output:** a running page, with each module given the others it uses. **Essential functions:** `main.js` start-up, and the roles `index.html` offers.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── main.js
└── index.html
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `flagdesigner.js`, `crestmaker.js` | `main.js` | Their `addColour(hex)` dependency is `main.js`'s `addColour`: `shownColourIndex` (`layerimage.js`) first matches the picked colour against each palette colour as the map shows it (as is, faded on Political, pale on Culture, or blended over the faded Political colour or border beneath it in Edit mode on Culture), the closest match winning, so an eye dropper lifted from a country's land picks that country's colour; otherwise `editor.addColour` adds it, so a colour picked in either dialog or by the palette's + button joins the map's palette (and the palette notice redraws everything that shows colours); `getCrests` gives the designer each crest rendered by `renderCrest` and `getShields` the same crests rendered by `renderShieldOnly`, in the same order (the Shield only toggle picks the list); `saveBlob` is `filesave.js` `downloadBlob` | A picked colour that is lost or applied to one dialog only; a Crest tool with no crests |
| `api.js`, `main.js` | the network, the browser | Startup is one sequence with nothing painted until it ends, under the message "Loading the map...": the starting scenario's fetch (`loadScenarioBlob`) begins at once and overlaps the base map's (`loadBasemap`, `collectBounded`, N x N bytes), then the model is built, the scenario decoded (`decodeMap`) and put in with `model.replace`, and the first frame follows. `main.js` waits one browser turn (`yieldToBrowser`) between the base map and the model, between decode and `replace`, and before the message clears, so the page can paint and answer input. `replace` clears paint from rivers and lakes by reading the base map four bytes at a time | A blank or stuttering page while the map loads; a start that waits on a step nothing needs yet |

**Interface.** None: no other module imports from this module.

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| controls | `bindHeader`, `bindLayerBar`, `bindToolPanel`, `createAppState`, `createKeys`, `createNameField`, `keepSelectionsValid` |
| countryfacts | `createCountries`, `createCountryFacts` |
| crestcells | `renderCrest`, `renderShieldOnly` |
| crestmaker | `bindCrestStrip`, `createCrestMaker`, `createCrests` |
| dialogs | `createDialogs`, `createMessages` |
| editor | `GLYPHS`, `bindSymbols`, `createEditor`, `createMarkerInfo` |
| flagdesigner | `bindFlagStrip`, `createDesigns`, `createFlagDesigner`, `createFlagZoom` |
| layers | `lookFor` |
| loading | `loadBasemap`, `loadScenarioBlob` |
| mapfile | `decodeMap` |
| model | `createModel` |
| palette | `bindPalette` |
| relations | `createRelationMenu`, `createRelations` |
| render | `createRenderer`, `readTheme`, `shownColourIndex` |
| sandbox | `createSandbox` |
| saving | `bindFileDrop`, `clearRecovery`, `createActions`, `downloadBlob`, `loadPrefs`, `readRecovery`, `savePrefs`, `startRecovery` |
| scenarios | `bindScenarios` |
| stage | `createStage` |
