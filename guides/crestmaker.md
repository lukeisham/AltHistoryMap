# AltHistoryMap · crestmaker — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The crest maker dialog, its list of crests and the glue that adds or edits one on the map. **Input:** pointer and keyboard input in the dialog, the map's crests, and a palette colour picker. **Output:** crests added or updated in the model, and crest pictures saved as PNG. **Essential functions:** `createCrestMaker`, `createCrests` and `bindCrestStrip`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── crestmaker.js
├── crestmaker.css
├── crests.js
├── creststrip.js
└── creststrip.css
```

## Cross-module behaviour

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `bindCrestStrip` | main |
| `createCrestMaker` | main |
| `createCrests` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| crestcells | `CHARGES`, `COMPARTMENTS`, `CREST_H`, `CREST_W`, `DIVISIONS`, `FACINGS`, `ORDINARIES`, `RIBBONS`, `SHAPES`, `SUPPORTERS`, `TOPPERS`, `defaultCrest`, `renderCrest` |
| dialogs | `bindTermTips`, `dialogParts` |
| dragitem | `setDragItem` |
| model | `MAX_CRESTS` |
| palette | `createEyeDropperButton` |
| pngexport | `CREST_PNG_CELL`, `cellsToPng`, `drawCells` |
| saving | `cleanFileName` |
