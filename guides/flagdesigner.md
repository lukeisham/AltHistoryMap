# AltHistoryMap · flagdesigner — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The flag designer dialog, the list of flags, and the enlarged picture under the pointer. **Input:** pointer and keyboard input in the dialog, the map's designs and crests, and a palette colour picker. **Output:** designs added or updated in the model, flag pictures saved as PNG, and the enlarged flag. **Essential functions:** `createFlagDesigner`, `createDesigns`, `bindFlagStrip` and `createFlagZoom`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── flagdesigner.js
├── flagdesigner.css
├── designs.js
├── flagstrip.js
├── flagstrip.css
├── flagzoom.js
└── flagzoom.css
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `flagzoom.js` | `stage.js`, `flagstrip.js`, `main.js` | A fixed-position box (`data-role="flag-zoom"` in `index.html`) at the pointer; `stage.js` shows it for a flag marker under the pointer and hides it on leave, press, wheel, key or zoom button, `flagstrip.js` shows it beside a thumbnail | A zoom that stays after the pointer leaves, or shows during a drag |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `bindFlagStrip` | main |
| `createDesigns` | main |
| `createFlagDesigner` | main |
| `createFlagZoom` | main |
| `drawThumb` | countryfacts |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| crestcells | `CREST_H`, `CREST_W` |
| dialogs | `bindTermTips`, `dialogParts` |
| dragitem | `setDragItem` |
| flagcells | `blankCells`, `floodFill`, `pencilLine`, `stampCrest`, `starterLayout` |
| model | `FLAG_H`, `FLAG_W`, `MAX_DESIGNS` |
| palette | `createEyeDropperButton` |
| pngexport | `FLAG_PNG_CELL`, `cellsToPng`, `drawCells` |
| render | `BLOCK_COLS`, `BLOCK_ROWS`, `flagBlocks` |
| saving | `cleanFileName` |
