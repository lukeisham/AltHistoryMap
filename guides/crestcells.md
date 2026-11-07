# AltHistoryMap · crestcells — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

A crest as a set of choices, and the cells those choices draw. **Input:** a crest choice object and the palette size. **Output:** a validated crest, an 88 x 60 cell grid, a shield-only grid, and flag cells stamped from them. **Essential functions:** `normaliseCrest`, `renderCrest`, `renderShieldOnly`, `rasterSupporter` and the supporter list.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── crestcells.js
└── supporters.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `crestcells.js` | `model.js`, `mapfile.js`, `flagcells.js`, `flagdesigner.js`, `crestmaker.js`, `creststrip.js`, `crests.js` | A crest is its choices, not its cells: `shape`, `division`, `ordinary`, `charge`, `supporterLeft`, `supporterRight`, `supporterLeftFacing`, `supporterRightFacing` (`inward` or `outward`), `compartment` (`none` or `mound`), `ribbon` (`none` or `ribbon`), `topper` (`none` or `crown`) (ids from the lists in `crestcells.js`; the supporter ids come from `supporters.js`) and the palette colours `field`, `field2`, `ordinaryColour`, `chargeColour`, `outline`, `supporterLeftColour`, `supporterRightColour`, `compartmentColour`, `ribbonColour`, `topperColour` (0 is white). `normaliseCrest` is the one validator; `model.js` calls it on every edit and `mapfile.js` on every read, and it gives a crest saved without supporters `none` on both sides, facing `inward`, with no compartment, ribbon or top decoration, and the charge colour for the three part colours. `renderCrest` makes 88 x 60 cells, `TRANSPARENT` (255) wherever nothing is drawn: the mound is drawn first along the bottom eight rows, then the two supporters (each 30 x 60 cells at its side), then the ribbon across the gap between them, then the crown above the shield, and the 36 x 42 shield at (26, 16) last, over everything. `renderShieldOnly` draws the shield alone centred in the same frame, so `stampCrest` puts it on the clicked cell. `flagcells.js` `stampCrest` copies the whole result into a flag's cells, so a stamped flag no longer follows its crest | A crest the reader refuses; a flag stamped with transparent cells; a 255 stored as a colour; a shield that hides an animal's head; a mound or ribbon drawn over the shield |
| `supporters.js` | `crestcells.js` | `SUPPORTERS` (ids `none`, `lion`, `unicorn`, `horse`, `stag`, `bear`, `wolf`, `eagle`, `dragon`, `griffin`, `soldier`) and `rasterSupporter(id)`, a 30 x 60 mask facing right (`BODY`, `LINE`, `EYE`) built from a hand-drawn grid of 60 strings per figure; `crestcells.js` mirrors it for the right side facing inward and for the left side facing outward, and paints its rim, detail lines and eye in the outline colour. The mask is never saved. The ids are stored in the map file | An id removed from the list makes every crest that names it refuse to open |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `CHARGES` | crestmaker |
| `COMPARTMENTS` | crestmaker |
| `CREST_H` | countryfacts, crestmaker, flagcells, flagdesigner |
| `CREST_W` | countryfacts, crestmaker, flagcells, flagdesigner |
| `DIVISIONS` | crestmaker |
| `FACINGS` | crestmaker |
| `ORDINARIES` | crestmaker |
| `RIBBONS` | crestmaker |
| `SHAPES` | crestmaker |
| `SUPPORTERS` | crestmaker |
| `TOPPERS` | crestmaker |
| `TRANSPARENT` | flagcells, pngexport |
| `defaultCrest` | crestmaker |
| `normaliseCrest` | mapfile, model |
| `renderCrest` | countryfacts, crestmaker, main |
| `renderShieldOnly` | main |

**Uses.** No other module.
