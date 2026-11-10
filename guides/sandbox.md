# AltHistoryMap · sandbox — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The Sandbox dialog: a paint-style tool that makes a new base map from scratch. **Input:** a choice of ocean or land to paint first, a detail setting (broad 256 cells a side, fine 1024), and pointer strokes on a coarse square of cells. **Output:** an N x N base plane of land and coast bits, saved as a map file with no paint, or put under an empty map to play on (View) or edit (Edit). **Essential functions:** `createSandbox` and `createSandboxGrid`.

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
| `sandbox.js` | `main.js`, `actions.js` | `createSandbox({dialog, saveBase, useBase})`. `saveBase(base, name)` is `actions.saveBaseMap`; `useBase(base, name, mode)` asks `actions.startOnBase` (the unsaved-work question, then `model.startOver`) and sets the mode. A `useBase` that returns false leaves the dialog open, so painted work is not lost by declining | A declined question that closes the dialog and throws the painting away |
| `sandboxcells.js` | `model.js` | Painted cells become the base plane in `toBase()`: land where the smoothed cell field reaches one half, water beside land marked with the coast bit, no river or lake bits. The plane is N x N bytes and goes into `model.replace` as `base`, or to `mapfile.js` as a sixth plane | A base plane of the wrong size is refused; river or lake bits would block painting |
| `layerimage.js` | `sandbox.js` | `readTheme` gives the map's own sea and land colours, so the painting area looks like the map | The painting shows different colours from the result |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `createSandbox` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| dialogs | `bindTermTips`, `dialogParts` |
| model | `COAST`, `LAND`, `MAX_NAME`, `N`, `discOffsets` |
| render | `readTheme` |
