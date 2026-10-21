---
plan: "althistorymap-water-shapes-dragdrop"
context: [Personal Research]
secondary_contexts: []
created: 2026-10-14
status: Completed
major_because: "multi-step"
project: ""
skills_used: [!CreatePlan, !ReviewPlan, !HouseStyle, !DesignCheck]
---

# Plan — AltHistoryMap: water, shapes, name tags, drag and drop, scenario menu, Open

## Purpose
Luke listed eight changes to the Alt History app. This plan groups them so each wave touches one set of files and ends with a passing test run. Where his wording left a choice open, the plan records the choice made.

| # | Luke's request | What the plan does | Choice made where wording was open |
|---|---|---|---|
| 1 | Water slightly darker blue | New `--map-sea` and `--map-water` values, light and dark | Rivers and lakes keep the stronger blue (`--map-water`); the sea is lighter |
| 2 | Rivers and lakes cannot be drawn over | Paint, erase, border, claim and fill skip river and lake pixels; a map loads with those pixels cleared; the renderer draws water last | Fill flows across a river but never colours it |
| 3 | Rivers clearly visible | Stronger blue; rivers shown at least 2 screen pixels wide at world zoom | Decided after looking at the result in the browser |
| 4 | Basic shapes in the glyph picker, colourable | 8 solid shapes (square, circle, triangle, diamond, pentagon, hexagon, solid star, cross) drawn filled in the chosen colour, no disc behind | They share the Symbol tool and the symbol grid |
| 5 | Open and edit saved maps | The file picker opens straight from the click (before the unsaved-work question), plus dropping a `.ahmap` file onto the map | The reader already accepts the saved files (checked against `~/Desktop/wicso sol.ahmap`); the loss of the browser's click permission after the question is the likely fault |
| 6 | Scenarios from a menu | A select list in the footer replaces the scrolling buttons | Native `<select>`: keyboard and touch work with no code |
| 7 | Symbols and cities with or without a name tag | A "Name tag" checkbox in the tool panel for City, Flag and Symbol; off places the marker unnamed | Flags get it too, since they share the code; a label is its text, so never |
| 8 | Flags, name tags and symbols can be dragged and dropped | Drag a symbol, shape or flag design from the panel onto the map; drag a placed marker with live feedback; drag a name tag on its own | The tag's position is stored as an offset in screen pixels from its default spot |

## Objective
In `System/Apps/AltHistoryMap/`, all eight changes work in the running app, verified in the browser pane, with both test suites green, so Luke can build alternative histories on a map whose water reads clearly and whose markers he can place and arrange by hand.

## Success criteria (measurable)
- A paint, erase, border or claim stroke across a river or lake pixel changes none of its planes (test). A fill started beside a river changes the pixels on both banks and none on the river (test).
- Loading a map whose planes hold colour on river or lake pixels clears those pixels (test).
- A marker with an empty name round-trips through Save and Open (test); a label with an empty name is refused (test). A marker's tag offset round-trips (test). Files saved before this change still open (test on a fixture without the new fields, and the real `~/Desktop/wicso sol.ahmap` decodes).
- Placing a city or symbol with "Name tag" off adds no name and opens no name field; with it on, the name field opens as before (test, then browser).
- Each new shape is in the glyph list; its drawing fills with the marker colour (test on the draw call); `test_glyphs.py` counts the new total.
- Dropping a symbol, shape or flag design from the panel onto the map places it at the drop point, honouring the name-tag checkbox. Dragging a placed marker moves it on screen while the pointer is down and records one undo step on release. Dragging a name tag changes only its offset, in one undo step. In View mode none of these change the map.
- The footer shows a list that opens a scenario; the scenario buttons are gone; opening one with unsaved work still asks first.
- Open: clicking Open on a changed map opens the file picker before any question; the question follows the choice of file. Dropping a `.ahmap` file onto the map opens it the same way.
- In the browser at world zoom a river is visible against the land at a glance (screenshot), in light and dark.
- `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"` both pass; `comment_lint.py` passes on the changed files.
- `README.md` and `app-decisions.md` describe the new behaviour.
- Charter baseline: checked against the running app, house style kept (every value a token, no new motion), the change touches only this app.

## Resources
- Context: Personal Research (coding / builds). Charter: `System/Context/PersonalResearch.md`.
- Standard: `Memory/Long-Term/Coding/vibe-coding-rules.md` (AG-1 to AG-5, CORE-1 to CORE-4, JS-*, CSS-*, TEST-*).
- Nearest analogue plan: `althistorymap-layer-views.md`.
- Specs: `_build/specs/interface.spec.md` (FR-7, FR-8, FR-9, FR-10, FR-1), `model.spec.md`, `mapfile.spec.md`, `render.spec.md`.
- The tree already holds uncommitted edits from the layer-views work. This plan builds on them and commits nothing.

## Steps

### Wave 0 — Baseline
- [x] Step 1 — Run both suites and record the counts (node: 93 pass). [runs: both commands]

### Wave 1 — Water (requests 1, 2, 3)
- [x] Step 2 — `app/tokens.css`: darker sea and water values, light and dark. [inline]
- [x] Step 3 — `app/model.js`: one `PAINTABLE` rule (land, not river, not lake) used by `stamp` and `fill` (fill passes through river pixels without writing them); `replace` clears water pixels in every plane. `app/editor.js`: the "land only" message names rivers and lakes. [inline]
- [x] Step 4 — Rivers visible at world zoom: choose between a wider river in `build/build_basemap.py` and a render-time widening, after a screenshot of the colour change alone. [inline; decided on evidence]
- [x] Step 5 — Tests: `tests/model.test.js`, `tests/render.test.js` (and `tests/test_basemap.py` if the build changes). [runs: node, unittest]

### Wave 2 — Markers: shapes, name tags, drag (requests 4, 7, 8)
- [x] Step 6 — `build/build_glyphs.py` gains a SHAPES list (hand-written 24-unit paths); `app/glyphs.js` regenerated; each glyph carries `solid`. [inline; script]
- [x] Step 7 — `app/model.js`, `app/mapfile.js`: an empty name is allowed for every type but a label; markers gain `tagDx` and `tagDy` (default 0); old files load. [inline]
- [x] Step 8 — `app/markers.js`: solid shapes drawn filled; no tag when the name is empty; the tag drawn at its offset; `hitTag` for the tag box; `app/render.js` exposes `hitTag` and a drag preview override. [inline]
- [x] Step 9 — `app/state.js`, `app/editor.js`, `app/toolpanel.js`, `app/index.html`: the `nameTag` setting and its checkbox (City, Flag, Symbol); `editor.place` and `editor.moveTag`. [inline]
- [x] Step 10 — `app/stage.js`: live marker drag with grab offset; tag drag; drop target on the canvas (`dragover`, `drop`) for panel items and for map files; `app/symbols.js`, `app/flagstrip.js`: the buttons are draggable. [inline]
- [x] Step 11 — Tests: `tests/model.test.js`, `tests/mapfile.test.js`, `tests/render.test.js`, `tests/interface.test.js`, `tests/test_glyphs.py`. [runs: both suites]

### Wave 3 — Scenario menu and Open (requests 5, 6)
- [x] Step 12 — `app/scenarios.js`, `app/index.html`, `app/footer.css`: a select list replaces the buttons. [inline]
- [x] Step 13 — `app/actions.js`, `app/filesave.js`: `open` asks for the file first; a shared `openFile(file)` serves Open and the drop. [inline]
- [x] Step 14 — Tests: `tests/actions.test.js`, `tests/interface.test.js`. [runs: node]

### Wave 4 — Verify and close
- [x] Step 15 — Browser pane: Roman Empire scenario; screenshots of water at world zoom and at a river (light and dark); place a city with and without a tag; drop a shape and a flag from the panel; drag a flag, a symbol and a tag; scenario list; Save then Open round trip; console and network clean. [runs: Browser pane tools]
- [x] Step 16 — `!DesignCheck` (visual and usability lenses) on the panel, footer list and name-tag checkbox; fix what it finds. [runs: `!DesignCheck`]
- [x] Step 17 — `python3 System/Tools/comment-lint/comment_lint.py` on the changed files; both suites a last time. [runs]
- [x] Step 18 — Update `README.md` and `app-decisions.md` (the specs under `_build/` were retired before this step, so none were edited) (Key decisions: water cannot be painted; name tag is an offset). [inline]
- [x] Verify — each line in **Success criteria** is met, and the result matches the **Objective**? [pass/fail]
- [x] Step 19 — Suggest whether any repeated step deserves a skill. [runs: `!Suggest`]

Commit only if Luke asks, and only after `python3 System/Tools/gitsync/gitsync.py` and a check that no other session is active.

No `!Checkpoint` step: nothing leaves the system, no Long-Term memory changes, and no Sandbox artefact is promoted.

## Final step — Close out (always present)
- [x] Update `status: Completed` in this plan's frontmatter.
- [x] Move the file from `System/Plans/New/` to `System/Plans/Completed/`.
