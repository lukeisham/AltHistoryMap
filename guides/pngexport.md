# AltHistoryMap · pngexport — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

Turning flag and crest cells into pictures. **Input:** a grid of palette cells and a palette. **Output:** a PNG blob, or cells drawn on a canvas. **Essential functions:** `cellsToPng` and `drawCells`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
└── pngexport.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `pngexport.js` | `flagdesigner.js`, `crestmaker.js`, `flagzoom.js`, `creststrip.js` | `cellsToPng` draws a cell grid at `FLAG_PNG_CELL` (8) or `CREST_PNG_CELL` (16) pixels per cell, transparent where the cell is `TRANSPARENT`, and gives a PNG blob; file names come from `designs.js` and `crests.js` (`<map name>-flag-<n>.png`, `<map name>-crest-<n>.png`) | A saved picture that is blurred, blank or wrongly named |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `CREST_PNG_CELL` | crestmaker |
| `FLAG_PNG_CELL` | flagdesigner |
| `cellsToPng` | crestmaker, flagdesigner |
| `drawCells` | countryfacts, crestmaker, flagdesigner |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| crestcells | `TRANSPARENT` |
