# AltHistoryMap · editor — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The one place the screen edits the map, and the markers it places. **Input:** tool actions from the stage, keys and dialogs. **Output:** model edits, which View mode refuses; markers placed, renamed, moved and deleted; the symbol grid; the marker popover. **Essential functions:** `createEditor`, `editGate`, `GLYPHS`, `bindSymbols` and `createMarkerInfo`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── editor.js
├── glyphs.js
├── symbols.js
├── symbols.css
├── markerinfo.js
└── markerinfo.css
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `app/glyphs.js` | `build_scenarios.py` and `editor.js` read it; `main.js` imports it and hands the ids to `mapfile.js` and the list to `symbols.js` and `render.js` (which builds the library `markers.js` draws from) | Glyph ids; `solid` marks a plain shape (filled in the marker's colour) against a Lucide outline on a disc. `build_glyphs.py` writes both kinds | An unknown id is rejected on read and unseen on the map; a shape drawn as an outline |
| interface modules | `model.js` | Every edit goes through `editor.js`'s `editGate()`, which refuses in View mode | An edit made in View mode |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `GLYPHS` | main |
| `bindSymbols` | main |
| `createEditor` | main |
| `createMarkerInfo` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| controls | `NAME_TAG_TOOLS`, `PLACING_TOOLS` |
| dragitem | `setDragItem` |
| model | `LAND`, `WATER` |
