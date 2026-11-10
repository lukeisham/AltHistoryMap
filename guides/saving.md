# AltHistoryMap · saving — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

Opening, saving and recovering a map, and remembering view settings. **Input:** the header buttons, a file picker, a dropped file, the model, and IndexedDB and `localStorage`. **Output:** a downloaded map file, an opened map, a recovered map and the saved preferences. **Essential functions:** `createActions`, `bindFileDrop`, `downloadBlob`, `startRecovery` and `loadPrefs`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── filesave.js
├── filedrop.js
├── recovery.js
└── actions.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `filedrop.js` | `actions.js` | A map file dropped anywhere on the page opens as Open does | The browser navigates to the dropped file |
| `mapfile.js`, `recovery.js` | the browser | Download links, a file picker (started inside the click, before the unsaved-work question), IndexedDB `althistorymap` (store `recovery`, key `current`), `localStorage` key `ahm.prefs` | Save or crash recovery stop working |
| `actions.js` | `sandbox.js`, `model.js` | `saveBaseMap(base, name)` downloads a base map as a map file with empty planes and the default palette, and leaves the open map alone; `startOnBase(base, name)` asks the unsaved-work question, calls `model.startOver` and returns false when the person declined. Crash recovery saves `model.snapshot()`, so a map with its own base map recovers on it | A Sandbox map recovered on the standard coastline; a declined question that still replaces the map |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `bindFileDrop` | main |
| `cleanFileName` | crestmaker, flagdesigner |
| `clearRecovery` | main |
| `createActions` | main |
| `downloadBlob` | main |
| `loadPrefs` | main |
| `readRecovery` | main |
| `savePrefs` | main |
| `startRecovery` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| layers | `isAllowedView`, `soloView` |
| loading | `loadScenarioBlob` |
| mapfile | `MapFileError`, `asScenarioCopy`, `decodeMap`, `encodeMap` |
| model | `DEFAULT_PALETTE`, `LAYERS`, `MAX_NAME`, `N`, `PLANE_NAMES` |
| render | `pngFileName` |
