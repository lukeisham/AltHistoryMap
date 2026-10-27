---
plan: "althistorymap-flags-crests"
context: [Personal Research]
secondary_contexts: []
created: 2026-10-19
status: Completed
major_because: "multi-step"
project: ""
skills_used: ["!VibeCoding", "!HouseStyle", "!AppDevelopment"]
---

# Plan — AltHistoryMap: flag colour picker, hover zoom, crest maker, PNG export

## Purpose
Luke's refactor list for AltHistoryMap: let the flag maker use any colour, enlarge a flag when the pointer rests on it, add a coat-of-arms (crest) maker whose crests stamp into flags, save flags and crests as PNG files, restate the app's purpose as "users create imaginary maps, flags and crests; the app outputs saved imaginary maps, flags and crests", and prove maps saved before the change still open.

## Objective
All six items work in the live app (`System/Apps/AltHistoryMap/`), both test suites are green, and every previously saved map and bundled scenario opens unchanged.

## Success criteria (measurable)
- The flag designer has a "+" swatch that opens the colour picker; the chosen colour joins the map palette and becomes the pen colour.
- Hovering a flag marker on the map, or a flag thumbnail in the Flags list, shows an enlarged copy beside the pointer; it hides on leave, drag, zoom or pan.
- A crest maker dialog composes a crest from shield shape, field division, ordinary, charge and five colours; crests are saved in the map file, listed in the panel, editable.
- The flag designer has a Crest tool that stamps a chosen crest onto the flag grid (undoable).
- "Save PNG" in the flag designer and the crest maker downloads a crisp PNG (crest keeps a transparent surround).
- `GUIDE.md` Purpose states the new input and output within 150 words; `README.md` says the same in plain words and stays under 30 lines.
- `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"` pass; a test opens every bundled `.ahmap` plus a header-without-`crests` fixture and round-trips a map with crests.

## Resources
- **Memory to read:** `System/Docs/Rules/vibe-coding-rules.md`
- **Capability skills:** none
- **Domain skills (Skillbank):** `!AppDevelopment` (Refactor loop)
- **Sub-agents:** none
- **Scripts:** none
- **Temp-skills:** none

## Design decisions
| Question | Decision |
|---|---|
| Colour picker scope | Reuses the map palette: the new colour is added through `editor.addColour`, so flags, crests and the map share colours and the file format needs no change |
| Hover zoom scope | Placed flags and the Flags-list thumbnails; one floating element, one module |
| Crest storage | Parameters (shape, division, ordinary, charge, colour indexes) in a new optional header key `crests`; old files lack it and read as none. File `format` stays 1 and `MAGIC` is unchanged |
| Crest size | 12 x 14 cells, the biggest that fits the 24 x 16 flag grid; cell value 255 is transparent (palette is at most 254) |
| Stamping | Bakes the crest's cells into the flag, so later crest edits never alter a flag |
| PNG | Nearest-neighbour scale of the cell grid; flag 16 px per cell, crest 24 px per cell |

## Steps
- [x] 1 — Pure crest maths `crestcells.js`: parts tables, `renderCrest(params) -> cells`, `stampCrest(flagCells, crestCells, x, y)`, `blankCrest`, `checkCrest` [VibeCoding]
- [x] 2 — Model: `crests` list, `addCrest`/`updateCrest` (undoable), `replace`, `snapshot`; editor wrappers [VibeCoding]
- [x] 3 — Map file: write and read optional `crests`, validated against the palette; scenarios and old files read as none [VibeCoding]
- [x] 4 — PNG helper `pngexport.js` and "Save PNG" in the flag designer [VibeCoding]
- [x] 5 — Flag designer: colour "+" swatch (`addColour` dependency) and Crest tool [VibeCoding]
- [x] 6 — Crest maker dialog `crestmaker.js` + `crestmaker.css`, crest list and buttons in the Flags panel, `crests.js` glue, `main.js` wiring, state `crest` [VibeCoding, HouseStyle]
- [x] 7 — Hover zoom `flagzoom.js` wired in `stage.js` and `flagstrip.js` [VibeCoding, HouseStyle]
- [x] 8 — Tests: crestcells, crestmaker, flagdesigner additions, mapfile and model additions, flagzoom; `test_guide.py` additions [VibeCoding TEST rules]
- [x] 9 — Docs: `GUIDE.md` (Purpose, Navigation, cross-boundary rows), `README.md`, `app-decisions.md`, `issues.md` [APP-1]
- [x] 10 — Back-compat run: decode every bundled `.ahmap`, then check in the browser pane that a scenario opens and a flag, crest and PNG work [AG-2]
- [x] Verify — every line in **Success criteria** passes [pass/fail]

## Final step — Close out (always present)
- [x] Update `status: Completed` in this plan's frontmatter.
- [x] Move the file from `System/Plans/New/` to `System/Plans/Completed/`.
