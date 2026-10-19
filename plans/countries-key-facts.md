---
plan: "althistorymap-countries-key-facts"
context: [Personal Research]
secondary_contexts: [Coding]
created: 2026-10-19
status: New
major_because: "multi-step"
project: ""
skills_used: ["!VibeCoding", "!HouseStyle", "!AppDevelopment", "!DesignCheck"]
---

# Plan — AltHistoryMap: crests dragged onto countries, and a Key Facts pop-up

## Purpose

Today a "country" in AltHistoryMap is only a palette colour painted on the Political layer. This plan gives each colour a small record, a country, so that: (1) Luke can drag a crest from the Crests list onto a country; (2) each country has a **Key Facts** pop-up showing its flag and crest at the top, then Name (defaults to the colour's name), Ruler, Type of Government, Currency and Demonym; (3) Name, Ruler and Demonym each have a generator. Maps saved before the change must open unchanged.

## Objective

In the live app (`System/Apps/AltHistoryMap/`), a crest can be dropped onto a country, every country opens a Key Facts pop-up with the six facts and generators, the facts are saved in the map file, and both test suites stay green. This specialises the Personal Research North Star ("the working builds it feeds") under the build bar.

## Success criteria (measurable)

- Dragging a crest thumbnail onto painted land on the map, or onto a colour swatch, links that crest to that colour's country. A drop on sea or unpainted land says so and changes nothing. In View mode the drop is refused (`editGate`).
- The Key Facts pop-up opens from (a) a **Key Facts** button under the palette for the selected colour, (b) double-click on a swatch, (c) a click on painted land in View mode. Flag and crest sit at the top (a placeholder with a hint when none is linked); below them are Name, Ruler, Type of Government, Currency, Demonym.
- Name shows the colour's name until Luke types one (stored empty = default). The pop-up is read-only in View mode.
- Name, Ruler and Demonym each have a Generate button. The generator is pure and takes a random-number function, so a test with a fixed one gets the same output every run. Demonym is built from the current Name.
- Saving the pop-up is one undoable step; Cancel changes nothing.
- A map with countries round-trips through save and open. A header with no `countries` key (every bundled `.ahmap` and every older save) opens with none. File `format` stays 1; `AHMAP001` is unchanged.
- `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"` pass, including new tests listed in step 9.
- The browser pane shows the drag, the pop-up, a generator click, a save and a reopen working (not just the tests). The build bar: matches house style (a sibling module read first for each new module).
- `GUIDE.md` (Navigation, cross-boundary rows), `README.md` (still 30 lines or fewer), `app-decisions.md` and `issues.md` are current (APP-1).

## Resources

- **Memory to read:** `Memory/Long-Term/Coding/vibe-coding-rules.md` (read in full before the first edit)
- **Capability skills:** none (the browser pane is used for the check in step 10)
- **Domain skills (Skillbank):** `!AppDevelopment` (Refactor loop), `!DesignCheck` (pop-up layout, step 10)
- **Sub-agents:** none. The work is one codebase with tight coupling between steps.
- **Scripts:** none
- **Temp-skills:** none

## Design decisions

These are the plan's defaults. Rows marked **Confirm** change what gets built if Luke answers differently; the plan proceeds on the default unless he says otherwise.

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | What is a "country"? | A Political palette colour (1-based index). A country record exists only once something is set on it. | Matches "country aka colour". No new plane, no new map data: the paint already says where each country is. |
| D2 | Where is a country's data stored? | A new optional header key `countries`: a list of `{colour, name, ruler, government, currency, demonym, flag, crest}`. `flag` and `crest` are indexes into the map's flag designs and crests, or -1. | Same pattern as `crests`. Old files lack the key and read as none. Designs and crests are never removed, so an index stays valid. |
| D3 | Does a country's crest follow edits to the crest? | **Yes** (a link by index). This differs from stamping a crest into a flag, which copies the cells. | A country's identity should show the current crest. **Confirm** if a frozen copy is wanted. |
| D4 | Where can a crest be dropped? | On painted land (the Political pixel under the drop gives the colour) **and** on a palette swatch. | Land is the natural target; the swatch works when the country is off screen or tiny. **Confirm**. |
| D5 | How does a country get its flag? | The Key Facts pop-up has a flag chooser (the map's flag designs). A flag design dropped on a **swatch** also assigns it. A flag dropped on the **map** still places a flag marker, as now. | Changing the map drop would break the existing meaning of dragging a flag. **Confirm**: should a flag dropped on land assign instead? |
| D6 | Name default | A colour name found from the hex value (nearest of about 30 named colours); if the colour is not near any, "Colour N". The default is shown, not stored. | "Default to colour" without storing text that goes stale when the colour changes. |
| D7 | Generators | Pure functions in `namegen.js`. Name and Ruler follow a chosen **style** (Any, Latin, Norse, Arabic, East Asian, Slavic, Celtic; one small syllable table each). Ruler gets a title from the Type of Government (King, Emperor, Sultan, President and so on). Demonym follows suffix rules on the Name (-ia gives -ian, -land gives -lander, -stan gives -i, else -ish or -ese by style) and is always editable. | No outside data, so `app/` stays deployable on its own. One style choice keeps Name and Ruler sounding as one culture. |
| D8 | Type of Government | A text field with suggestions (Monarchy, Republic, Empire, Sultanate, Caliphate, Khanate, Theocracy, Oligarchy, City-state, Federation, Confederation, Principality, Junta). Free text allowed. | Alt-history needs invented types. Suggestions keep it fast. |
| D9 | Currency | Plain text, no generator. | Not asked for. |
| D10 | Scope not included | Showing country names on the map; filling the bundled scenarios with countries; definition pop-ups (`terms.js`) for government types. | Not requested; each can be a later issue. |

## Steps

Read a sibling first for every new file (match existing patterns): `crests.js`/`creststrip.js` for glue and strip, `crestmaker.js` + `crestmaker.css` for the dialog, `dragitem.js` for the drag type.

- [ ] 1 — Read `vibe-coding-rules.md` in full. Run `git status` for the app folder. The working tree already holds uncommitted edits across many AltHistoryMap files; if any changed in the last few minutes another session is working: stop and tell Luke. [reads: Coding store; runs: Bash]
- [ ] 2 — `countrydata.js` (pure): `COLOUR_NAMES`, `colourNameFor(hex, index)`, `GOVERNMENTS`, `normaliseCountry(c, paletteLength, designCount, crestCount)` (the one validator, as `normaliseCrest` is for crests), `blankCountry(colour)`, `MAX_FIELD` length. [VibeCoding]
- [ ] 3 — `namegen.js` (pure): `makeName(style, rng)`, `makeRuler(style, government, rng)`, `makeDemonym(name, style)`, `STYLES`. Every function takes `rng` as an argument. [VibeCoding]
  - [ ] Test in Sandbox — tests in step 9 run these with a fixed `rng`; also print 20 samples per style to `System/Sandbox/` and read them for sense (no empty, doubled or unpronounceable results).
- [ ] 4 — Model and editor: `model.countries` list; `setCountry(colour, patch)` (undoable, validated by `normaliseCountry`); `replace` and `snapshot` carry it; `editor.js` wrapper behind `editGate` (the guide test allows only `model.js` and `editor.js` to call model mutators). A country is dropped from the list if its colour is past the end of the palette. [VibeCoding]
- [ ] 5 — Map file: `mapfile.js` writes `countries` and reads it as optional, validated against palette length, design count and crest count. [VibeCoding]
- [ ] 6 — Drag and drop: extend `dragitem.js` with `{kind: "crest", crest: n}` and a `crestCount` check; make `creststrip.js` thumbnails draggable (as `flagstrip.js` does); `stage.js` `onDragOver`/`onDrop` accept a crest and read the Political pixel; `palette.js` swatches accept crest and flag drops; `countries.js` (glue, like `crests.js`) turns a drop into `editor.setCountry` and says what happened. [VibeCoding]
- [ ] 7 — Key Facts dialog: `countryfacts.js` + `countryfacts.css` + `<dialog data-role="country-facts">` in `index.html`. Flag and crest drawn at the top with `drawCells` (and `flagBlocks` where it fits), fields below, a Generate button on Name, Ruler and Demonym, a style choice, Save and Cancel. Read-only in View mode. Opens from the palette button, swatch double-click and a View-mode click on land (`stage.js`, checked against `CLICK_SLOP` so panning does not open it). Tokens only; no literal colour, size or duration. [VibeCoding, HouseStyle]
- [ ] 8 — Wire in `main.js`: build the dialog and glue, pass `editor`, `model`, `state`, `say`. [VibeCoding]
- [ ] 9 — Tests (write beside each step, run here as a whole): `namegen.test.js`, `countrydata.test.js`, `countryfacts.test.js` (fake DOM), additions to `dragitem` coverage (in `interface.test.js`), `model.test.js` (set, undo, redo, invalid), `mapfile.test.js` (round trip; header without `countries`; bad index refused); `test_scenarios.py` already decodes every bundled scenario; `test_guide.py` additions for the new cross-boundary rows. [VibeCoding TEST rules]
- [ ] 10 — Browser check in the preview: start the app (`preview_start`), drag a crest onto land and a swatch, open Key Facts all three ways, use each Generate, Save, undo, save the map, reopen it, open a bundled scenario. Read the console for errors. Then run `!DesignCheck` on the pop-up. [AG-2; runs: preview tools, !DesignCheck]
- [ ] 11 — Docs (APP-1): `GUIDE.md` Navigation tree (add `plans/`, the new modules) and cross-boundary rows (`countrydata.js`/`mapfile.js`/`model.js`; the crest drag type; `namegen.js`); `README.md` one line on countries; `app-decisions.md` entry for D1 to D5 as Key decisions and an approval row; `issues.md` rows for the D10 items. [APP-1]
- [ ] 12 — Refactor pass: each touched file brought up to standard (AG-6); `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"` both green. [VibeCoding]
- [ ] Verify — outputs meet every line in **Success criteria**, and the result matches the **Objective**? [pass/fail]

## Risks and notes

- **This plan file is published.** `.github/workflows/publish-althistorymap.yml` mirrors the whole app folder into the public repo and excludes only `issues.md`. Either accept that this plan goes public, or add `--exclude /plans` to the workflow (a change outside the app folder, so Luke approves it first).
- **No commit or push in this plan.** A push to `main` publishes the app to the live sites (permission recorded in `app-decisions.md`, 2026-10-19). Commit only when Luke asks and no other session is working.
- **Back-compat is the main risk.** The new key must stay optional on read; the check is in step 9 (header without `countries`) and step 10 (a bundled scenario opens).
- **Palette undo.** `addColour` undo pops the last colour. A country on that colour can only have been set after it, and undo runs newest first, so the order is safe; `normaliseCountry` still refuses an out-of-range colour as a second guard.

## Final step — Close out (always present)
- [ ] Update `status: Completed` in this plan's frontmatter.
- [ ] Copy the file to `System/Plans/Completed/` as the system's record. The copy in the app's `plans/` folder stays, because Luke asked for the plan to live with the app's documents.
