# AltHistoryMap · sandbox — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The Sandbox page: a whole-window drawing sheet that makes a new base map from scratch. **Input:** a choice of how to create the ground (paint the ocean, or draw the land's border), a detail setting (broad 256 cells a side, fine 1024), pointer strokes on a coarse square of cells, and rivers drawn as lines in a narrow or a wide width. **Output:** an N x N base plane of land, coast and river bits, saved as a map file with no paint, or put under an empty map to play on (View) or edit (Edit). **Essential functions:** `createSandbox` and `createSandboxGrid`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── sandbox.js
├── sandboxcells.js
└── sandbox.css
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `sandbox.js` | `main.js`, `actions.js` | `createSandbox({dialog, saveBase, useBase})`. `saveBase(base, name)` is `actions.saveBaseMap`; `useBase(base, name, mode)` asks `actions.startOnBase` (the unsaved-work question, then `model.startOver`) and sets the mode. A `useBase` that returns false leaves the page open, so drawn work is not lost by declining | A declined question that closes the page and throws the drawing away |
| `sandbox.js` | `sandbox.css`, `index.html` | `open()` shows the `<dialog data-role="sandbox">` of `index.html` over the whole window by giving it the class `sb-page`, and opens on a blank sheet: no grid exists until Create by ocean (`start` `ocean`) or Create by border (`start` `land`) is chosen, and every other tool is disabled until then. The canvas is sized by `.sb-sheet`, a size container, as `min(100cqw, 100cqh)` | A Sandbox that opens as a small pop-up, or a sheet that overflows the window |
| `sandboxcells.js` | `model.js` | Painted cells become the base plane in `toBase()`: land where the smoothed cell field reaches one half, water beside land marked with the coast bit, and no lake bits. A river is a line of points in cell coordinates, not cells; `toBase()` stamps it along its line with `discOffsets(RIVER_WIDTHS[width])` (`narrow` 2, `wide` 4, in pixels of the N x N plane) and sets `RIVER` only on pixels that are `LAND`, keeping `LAND`, as the standard base map does. The plane is N x N bytes and goes into `model.replace` as `base`, or to `mapfile.js` as a sixth plane | A base plane of the wrong size is refused; a river bit on a sea pixel draws a river in the sea, and one without `LAND` is not treated as a wall by a fill |
| `layerimage.js` | `sandbox.js` | `readTheme` gives the map's own sea, land and river (`water`) colours, so the sheet looks like the map | The sheet shows different colours from the result |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `createSandbox` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| dialogs | `bindTermTips`, `dialogParts` |
| model | `COAST`, `LAND`, `MAX_NAME`, `N`, `RIVER`, `discOffsets` |
| render | `readTheme` |
