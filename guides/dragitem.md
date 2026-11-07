# AltHistoryMap · dragitem — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The payload that lists and the map exchange when something is dragged. **Input:** a symbol glyph id, a flag design index or a crest index. **Output:** a drag payload and its reader. **Essential functions:** `ITEM_TYPE`, `setDragItem`, `hasDragItem` and `readDragItem`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
└── dragitem.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `symbols.js`, `flagstrip.js`, `creststrip.js` | `stage.js`, `palette.js`, `countryfacts.js` | `dragitem.js`: the drag payload type `application/x-althistorymap-item`, a symbol glyph id, a flag design index or a crest index | A dropped item places or links nothing |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `hasDragItem` | countryfacts, palette, stage |
| `readDragItem` | countryfacts, palette, stage |
| `setDragItem` | crestmaker, editor, flagdesigner |

**Uses.** No other module.
