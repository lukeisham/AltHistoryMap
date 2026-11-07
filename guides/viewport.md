# AltHistoryMap · viewport — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The pure pan and zoom maths for the map and the five zoom levels at which things show. **Input:** a viewport and a pointer or button action. **Output:** a new viewport, and the fade pairs that decide when flags, names, capitals and cities appear. **Essential functions:** `fitScale`, `zoomViewport`, `panViewport` and `ZOOM_FADES`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
└── viewport.js
```

## Cross-module behaviour

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `BUTTON_ZOOM` | render |
| `KEY_PAN` | render |
| `SINGLE_PIXEL_K` | render |
| `ZOOM_FADES` | render |
| `brushOutline` | render |
| `fadeFactor` | render |
| `homeViewport` | render |
| `panViewport` | render |
| `readoutText` | render |
| `resizeViewport` | render |
| `screenToGrid` | render |
| `zoomViewport` | render |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| model | `discOffsets`, `unproject` |
