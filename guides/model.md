# AltHistoryMap · model — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The in-memory map and every change made to it. **Input:** the base map bytes, a decoded map file, and edit calls from the editor. **Output:** the planes, markers, palette, flag designs, crests and countries, change notices for the renderer, and the grid and flag constants. **Essential functions:** strokes and fills on the three layers, markers, `setCountry`, undo and redo, and `replace`, which clears paint from rivers and lakes.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
└── model.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `model.js` | `render.js`, `mapfile.js`, interface modules | Planes, markers, palette, designs, crests (`MAX_CRESTS`); a marker's `name` is empty when it has no name tag (never for a label) and `tagDx`, `tagDy` are its tag's offset in screen pixels; no stroke or fill writes a river or lake pixel, and `replace` clears them; `countries` and `setCountry(colour, patch)`, one undo step that removes a country left with nothing set; `onChange` notices `{layer, rect}`, `{markers}`, `{palette}`, `{all}`, and `{history, countries}` when a country changes; `discOffsets` is shared by the brush and its outline | Rendering draws stale pixels; old files stop opening |
| `replace`, `startOver` | `render.js`, `mapfile.js`, `actions.js`, `sandbox.js` | A map may bring its own base map. `replace` copies a `base` plane in place into the one base array every module holds, keeps a copy of the standard base map the first time, and puts that copy back when the next map has no `base`; `customBase` says which is in use and `snapshot` returns `base` only when it is. `startOver(base, name)` is `replace` over an empty map and the default palette, for a Sandbox base map. A `base` of the wrong size throws before anything changes | A second base array that the renderer and editor do not see; a scenario opened after a custom map drawn on the wrong coastline |
| `FLAG_W`, `FLAG_H`, `LEGACY_FLAG_SCALE` in `model.js` | `mapfile.js`, `flagcells.js`, every flag drawing module | `FLAG_W` x `FLAG_H` (120 x 80) is the flag grid; `LEGACY_FLAG_SCALE` (5) is how many cells an older 24 x 16 flag cell becomes. `mapfile.js` reads a flag of 384 cells and `flagcells.js` `upscaleLegacyFlag` scales it up; it always writes 9600 cells | Old maps and the scenario files stop opening, or open with flags in a corner |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `COAST` | render, sandbox |
| `DEFAULT_PALETTE` | saving |
| `FLAG_H` | countryfacts, flagcells, flagdesigner, mapfile, render |
| `FLAG_W` | countryfacts, flagcells, flagdesigner, mapfile, render |
| `LAKE` | render |
| `LAND` | editor, render, sandbox |
| `LAYERS` | controls, layers, mapfile, saving |
| `LEGACY_FLAG_SCALE` | flagcells, mapfile, render |
| `MARKER_TYPES` | mapfile |
| `MAX_CRESTS` | crestmaker, mapfile |
| `MAX_DESIGNS` | flagdesigner, mapfile |
| `MAX_NAME` | mapfile, sandbox, saving |
| `MAX_PALETTE` | mapfile, palette |
| `MAX_TAG_OFFSET` | mapfile |
| `N` | loading, mapfile, sandbox, saving |
| `PLANE_NAMES` | mapfile, saving |
| `RIVER` | render, sandbox |
| `WATER` | editor |
| `createModel` | main |
| `discOffsets` | sandbox, viewport |
| `unproject` | viewport |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| countrydata | `blankCountry`, `isBlank`, `normaliseCountry`, `relationLoops` |
| crestcells | `normaliseCrest` |
