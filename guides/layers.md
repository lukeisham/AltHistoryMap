# AltHistoryMap · layers — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The rules for which of the three layers show, and the look each view draws. **Input:** a requested view or edit layer. **Output:** the allowed views, the look to draw, and which layers' markers show. **Essential functions:** `ALLOWED_VIEWS`, `LOOKS`, `layersOnScreen` and the validators.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
└── layers.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `layers.js` | `state.js`, `render.js`, `recovery.js` import it; `layerbar.js` and `keys.js` reach it through `state.toggleView`; `markers.js` gets the result as `scene.layers` | The allowed views, the look each view or edit layer draws, and which layers' markers show | A saved or typed view the rules reject; a look the renderer has no loop for |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `LOOKS` | render |
| `isAllowedView` | saving |
| `layersDrawn` | render |
| `layersOnScreen` | controls, render |
| `lookFor` | controls, main |
| `settleLayers` | controls |
| `soloView` | controls, saving |
| `toggleLayer` | controls |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| model | `LAYERS` |
