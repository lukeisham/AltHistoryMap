# AltHistoryMap · dialogs — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The app's own dialog, the builders the designers share, the term pop-ups and the message line. **Input:** a document, a question or message, and an element carrying `data-term`. **Output:** answered questions, close buttons, definitions in pop-ups and the message line. **Essential functions:** `createDialogs`, `dialogParts`, `termFor`, `bindTermTips` and `createMessages`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── dialogs.js
├── dialogs.css
├── dialogparts.js
├── terms.js
├── termtip.js
├── termtip.css
├── messages.js
└── messages.css
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `terms.js` | `termtip.js`, `crestmaker.js`, `flagdesigner.js`, `countryfacts.js`, `sandbox.js` | `termFor("<group>:<id>")` gives a name and definition. Groups: `part`, `role`, `shape`, `division`, `ordinary`, `charge`, `supporter`, `facing`, `compartment`, `ribbon`, `topper` (crest maker, built from the id lists), `tool`, `starter`, `flag` (flag designer), `alignment` (the nine philosophy squares of the Key Facts dialog), `relation` (`none`, `dominion`, `client`, `colony`: the hints on the right-click relationship menu), `sandbox` (`ocean`, `land`, `detail`, `paint`, `erase`, `brush`, `undo`, `redo`, `clear`, `restart`, `save`, `play`, `edit`: the hover text of every Sandbox control). An element with `data-term` gets a pop-up from `bindTermTips(dialog)`, which each of the four dialogs calls once, because a modal dialog hides everything outside it | An option with no definition shows no pop-up and logs a warning; `terms.test.js` fails when a listed id has none |
| `dialogparts.js`, `dialogs.js`, `markerinfo.js` | `flagdesigner.js`, `crestmaker.js`, `countryfacts.js`, `main.js` | Every pop-up has a close button with `aria-label="Close"`: `closeButton` from `dialogparts.js` (class `fd-close`) in the three designer dialogs, where it settles the promise with null as Cancel does; `dialog-close` in the app dialog (`dialogs.js`), which closes it with `cancel`; and `data-role="info-close"` in the marker popover, which `main.js` hands to `createMarkerInfo` | A pop-up that can only be left with Escape or a far-off button |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `bindTermTips` | countryfacts, crestmaker, flagdesigner, sandbox |
| `createDialogs` | main |
| `createMessages` | main |
| `dialogParts` | countryfacts, crestmaker, flagdesigner, sandbox |
| `termFor` | relations |

**Uses.** No other module.
