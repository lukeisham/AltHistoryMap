# AltHistoryMap · relations — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

Making a country a client state, dominion or colony of the country holding the nearest capital. **Input:** a right-button press on land that ends without moving, and the markers and Political plane. **Output:** a relationship set through the editor, and the menu that offers the choices. **Essential functions:** `createRelations`, `nearestCapitalColour`, `coloursTouch` and `createRelationMenu`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── relations.js
├── relationmenu.js
└── relationmenu.css
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `relations.js` | `stage.js`, `relationmenu.js`, `main.js`, `countrydata.js`, `model.js` | `stage.js` calls `relations.menuAt(pixel, point)` when a right-button press ends without moving (`done.kind === "pan"`, button 2); a right-button drag is still a pan. `menuAt` reads the Political plane under the pixel; sea does nothing. In View mode it only says so. The overlord is `nearestCapitalColour`: the `nation` of the capital marker nearest the pixel, skipping the clicked colour's own capitals. `coloursTouch` refuses a colour that shares an edge with that overlord colour (the home country's own land), and `relationLoops` refuses a loop; with no capital the message asks for one. Allowed, the menu lists Client State, Dominion and Colony from `RELATIONS`, plus None when the country already has a relationship (None is offered even when the others are refused), each with the hint from `termFor("relation:<id>")`. The choice goes through `editor.setCountry(colour, {relation, overlord})`, or `{relation: "", overlord: 0}` for None, so View mode refuses it and undo restores it | A relationship chosen with a loop or against the colour it touches; a right-button drag that opens a menu; a menu in View mode that changes the map |
| `relationmenu.js` | `relations.js`, `main.js`, `stage.js` | `createRelationMenu({box, stage})` fills the element `data-role="relation-menu"` in `index.html` (styled by `relationmenu.css`, positioned by `--at-x` and `--at-y` like the marker popover) and `choose` resolves with an option id or null. A choice, Escape, a press outside the menu (a capture-phase `pointerdown` on the document) or a second `choose` settles it once; `stage.js` also calls `hide` on a wheel, key or zoom button | A menu that stays open over the map, or a pending choice that never settles |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `createRelationMenu` | main |
| `createRelations` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| countrydata | `RELATIONS`, `countryName`, `relationLoops` |
| dialogs | `termFor` |
