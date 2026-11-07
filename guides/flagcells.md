# AltHistoryMap · flagcells — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The flag grid and what is drawn into it. **Input:** a flag design, a crest, and a flag saved at the older, smaller size. **Output:** 120 x 80 flag cells, starter flags, a flag stamped with a crest, and an upscaled older flag. **Essential functions:** `upscaleLegacyFlag`, `stampCrest` and the starter layouts.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
└── flagcells.js
```

## Cross-module behaviour

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `blankCells` | flagdesigner |
| `floodFill` | flagdesigner |
| `pencilLine` | flagdesigner |
| `stampCrest` | flagdesigner |
| `starterLayout` | flagdesigner |
| `upscaleLegacyFlag` | mapfile |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| crestcells | `CREST_H`, `CREST_W`, `TRANSPARENT` |
| model | `FLAG_H`, `FLAG_W`, `LEGACY_FLAG_SCALE` |
