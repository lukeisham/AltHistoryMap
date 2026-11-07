# AltHistoryMap · controls — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The screen's own store and the buttons and keys that change it. **Input:** button clicks, key presses and the name entry. **Output:** changes to the mode, layer, tool, colours, brush, selection and city colour, and the map name. **Essential functions:** `createAppState`, `TOOLS_BY_LAYER`, `createKeys`, `bindToolPanel`, `bindLayerBar` and `createNameField`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── tools.js
├── state.js
├── toolpanel.js
├── toolpanel.css
├── layerbar.js
├── layerbar.css
├── keys.js
├── header.js
├── header.css
├── namefield.js
└── namefield.css
```

## Cross-module behaviour

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `BRUSH_TOOLS` | stage |
| `NAME_TAG_TOOLS` | editor |
| `PLACING_TOOLS` | editor, stage |
| `STROKE_TOOLS` | stage |
| `bindHeader` | main |
| `bindLayerBar` | main |
| `bindToolPanel` | main |
| `createAppState` | main |
| `createKeys` | main |
| `createNameField` | main |
| `keepSelectionsValid` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| layers | `layersOnScreen`, `lookFor`, `settleLayers`, `soloView`, `toggleLayer` |
| model | `LAYERS` |
