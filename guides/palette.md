# AltHistoryMap · palette — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The palette swatches and the eye-dropper button beside each colour picker. **Input:** clicks and drops on a swatch, and the colour picker. **Output:** the chosen colours, colours added to the palette, and a country's Key Facts opened. **Essential functions:** `bindPalette` and `createEyeDropperButton`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── palette.js
├── palette.css
└── eyedropper.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `eyedropper.js` | `palette.js`, `flagdesigner.js`, `crestmaker.js` | `createEyeDropperButton({doc, className, onPick, openPicker, getDropper})` makes the button each of the three places puts beside its + swatch (classes `swatch-eyedropper` and `fd-swatch-eyedropper`; the icon class `eyedropper-icon` is styled in `buttons.css`). Where the browser has `window.EyeDropper` a click reads one colour and calls `onPick`, which takes the path the + input takes (`shownColourIndex`, else `addColour`); where it has not, the click opens that + input. The dialogs' buttons carry `data-term="tool:eyedropper"`, defined in `terms.js` | A button that does nothing without `EyeDropper`; a picked colour that adds a second palette entry instead of choosing the country's own |
| `palette.js` | `countrydata.js`, `model.js` | A swatch's `title` is `countryName(country, hex, index)`: the country's name, else the colour's own name. It is redrawn on a `{countries: true}` notice | A hover that shows a hex code, or stays stale after a rename |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `bindPalette` | main |
| `createEyeDropperButton` | crestmaker, flagdesigner |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| countrydata | `countryName` |
| dragitem | `hasDragItem`, `readDragItem` |
| model | `MAX_PALETTE` |
