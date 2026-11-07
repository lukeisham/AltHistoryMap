# AltHistoryMap · stage — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The pointer, wheel and zoom-button handling over the canvas. **Input:** pointer events on the canvas and drops from the lists. **Output:** pans, zooms, tool strokes, popovers and the readout. **Essential functions:** `createStage`, `intentFor` and `cursorFor`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── stage.js
└── stage.css
```

## Cross-module behaviour

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `createStage` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| controls | `BRUSH_TOOLS`, `PLACING_TOOLS`, `STROKE_TOOLS` |
| dragitem | `hasDragItem`, `readDragItem` |
