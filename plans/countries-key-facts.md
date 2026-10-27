---
plan: "althistorymap-countries-key-facts"
context: [Personal Research]
secondary_contexts: [Coding]
created: 2026-10-19
status: Completed
major_because: "multi-step"
project: ""
skills_used: ["!VibeCoding", "!HouseStyle", "!AppDevelopment", "!DesignCheck"]
---

# Plan — AltHistoryMap: crests dragged onto countries, and a Key Facts pop-up

## Purpose

Today a "country" in AltHistoryMap is only a palette colour painted on the Political layer. This plan gives each colour a small record, a country, so that: (1) Luke can drag a crest from the Crests list onto a country; (2) each country has a **Key Facts** pop-up showing its flag and crest at the top, then its philosophy (a nine-square alignment grid), Name (defaults to the colour's name), Ruler, Type of Government, Latin Motto, Currency and Demonym; (3) Name, Ruler, Type of Government, Motto and Demonym each have a generator, and the chosen alignment steers what the generators produce. Maps saved before the change must open unchanged.

## Objective

In the live app (`System/Apps/AltHistoryMap/`), a crest can be dropped onto a country, every country opens a Key Facts pop-up with its alignment, the six facts and generators, the facts are saved in the map file, and both test suites stay green. This specialises the Personal Research North Star ("the working builds it feeds") under the build bar.

## Success criteria (measurable)

- Dragging a crest thumbnail onto painted land on the map, or onto a colour swatch, links that crest to that colour's country. A drop on sea or unpainted land says so and changes nothing. In View mode the drop is refused (`editGate`).
- The Key Facts pop-up opens from (a) a **Key Facts** button under the palette for the selected colour, (b) double-click on a swatch, (c) a click on painted land in View mode. Flag and crest sit at the top (a placeholder with a hint when none is linked); below them are the alignment grid, then Name, Ruler, Type of Government, Motto, Currency, Demonym.
- The alignment grid is a 3 x 3 choice (lawful, neutral, chaotic across; good, neutral, evil down). The chosen square is marked by shape and text as well as colour, and a second click clears it. The choice is saved with the country and shown in the pop-up whenever it opens, including in View mode.
- Name shows the colour's name until Luke types one (stored empty = default). The pop-up is read-only in View mode.
- Name, Ruler, Type of Government, Motto and Demonym each have a Generate button, plus one Generate all that fills them in the order government, name, ruler, motto, demonym. Each generator is pure and takes a random-number function, so a test with a fixed one gets the same output every run. Demonym is built from the current Name.
- The alignment steers the generators, and a test proves it: over 200 fixed-seed runs, every government from lawful-good comes from that square's pool, every motto word for chaotic-evil comes from its pool, and the pools of the nine squares are not all the same.
- A Motto left empty when Save is pressed is generated, from the country's alignment, and stored, so it stays the same afterwards. A motto Luke typed is never replaced. Generated mottos are built only from stored Latin word forms (each noun with its nominative and ablative), so every output is grammatical Latin; a test checks the shapes (see D12).
- Saving the pop-up is one undoable step; Cancel changes nothing.
- A map with countries round-trips through save and open. A header with no `countries` key (every bundled `.ahmap` and every older save) opens with none. File `format` stays 1; `AHMAP001` is unchanged.
- `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"` pass, including new tests listed in step 9.
- The browser pane shows the drag, the pop-up, a generator click, a save and a reopen working (not just the tests). The build bar: matches house style (a sibling module read first for each new module).
- `GUIDE.md` (Navigation, cross-boundary rows), `README.md` (still 30 lines or fewer), `app-decisions.md` and `issues.md` are current (APP-1).

## Resources

- **Memory to read:** `System/Docs/Rules/vibe-coding-rules.md` (read in full before the first edit)
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
| D2 | Where is a country's data stored? | A new optional header key `countries`: a list of `{colour, name, ruler, government, motto, currency, demonym, alignment, flag, crest}`. `alignment` is one of nine ids (`lawful-good` through `chaotic-evil`) or empty. `flag` and `crest` are indexes into the map's flag designs and crests, or -1. | Same pattern as `crests`. Old files lack the key and read as none. Designs and crests are never removed, so an index stays valid. |
| D3 | Does a country's crest follow edits to the crest? | **Yes** (a link by index). This differs from stamping a crest into a flag, which copies the cells. | A country's identity should show the current crest. **Confirm** if a frozen copy is wanted. |
| D4 | Where can a crest be dropped? | On painted land (the Political pixel under the drop gives the colour) **and** on a palette swatch. | Land is the natural target; the swatch works when the country is off screen or tiny. **Confirm**. |
| D5 | How does a country get its flag? | The Key Facts pop-up has a flag chooser (the map's flag designs). A flag design dropped on a **swatch** also assigns it. A flag dropped on the **map** still places a flag marker, as now. | Changing the map drop would break the existing meaning of dragging a flag. **Confirm**: should a flag dropped on land assign instead? |
| D6 | Name default | A colour name found from the hex value (nearest of about 30 named colours); if the colour is not near any, "Colour N". The default is shown, not stored. | "Default to colour" without storing text that goes stale when the colour changes. |
| D7 | Generators | Pure functions in `namegen.js`. Name and Ruler follow a chosen **style** (Any, Latin, Norse, Arabic, East Asian, Slavic, Celtic; one small syllable table each) and the country's **alignment** (D11). Ruler gets a title from the Type of Government (King, Emperor, Sultan, President and so on). Demonym follows suffix rules on the Name (-ia gives -ian, -land gives -lander, -stan gives -i, else -ish or -ese by style) and is always editable. | No outside data, so `app/` stays deployable on its own. One style choice keeps Name and Ruler sounding as one culture. |
| D8 | Type of Government | A text field with suggestions (Monarchy, Republic, Empire, Sultanate, Caliphate, Khanate, Theocracy, Oligarchy, City-state, Federation, Confederation, Principality, Junta) and a Generate button that picks from the alignment's pool. Free text allowed. | Alt-history needs invented types. Suggestions keep it fast. |
| D9 | Currency | Plain text, no generator. | Not asked for. |
| D10 | Scope not included | Showing country names on the map; filling the bundled scenarios with countries. | Not requested; each can be a later issue. |
| D11 | How alignment steers generation (**Confirm**) | Each of the nine squares owns a small pool: governments (lawful-good: Kingdom, Commonwealth, Republic; chaotic-evil: Warlord state, Horde, Tyranny; and so on), name forms ("Holy ...", "Free Cities of ...", "Dominion of ..."), a sound bias (good leans to soft syllables, evil to hard ones; chaotic allows rougher, longer names; lawful keeps them regular), ruler epithets ("the Just", "the Free", "the Cruel") and motto words. The ladder is alignment, then government, then name, then ruler, then motto, then demonym. Unset alignment means no steering. | Luke asked that the choice "determine the type of name, government" and so on. I read "govern name" as the country name and "gov system" as Type of Government, and I added Ruler and the epithets because they belong to the same culture. |
| D12 | Latin mottos (**Confirm**) | Built only from templates that need no agreement: "A et B" (two nominatives, such as Lex et Ordo), "Pro B" (ablative, such as Pro Libertate) and "A ante omnia". Each noun is stored with its nominative and ablative and with the squares it suits. About 12 nouns per axis end. A hand-picked list of well-known mottos is not used, so output is new, not borrowed. | Free-form Latin from a word list would often be wrong Latin. Fixed templates with stored case forms cannot decline wrongly. I cannot prove every pairing reads well, so step 3 prints samples for Luke to skim. |
| D13 | Alignment meaning pop-ups | Nine entries in `terms.js` (group `alignment`) give each square a one-line definition, shown by the existing `data-term` pop-up. | `terms.test.js` already fails if a listed id has no definition, so the grid stays consistent with the rest of the app. |

## Steps

Read a sibling first for every new file (match existing patterns): `crests.js`/`creststrip.js` for glue and strip, `crestmaker.js` + `crestmaker.css` for the dialog, `dragitem.js` for the drag type.

- [x] 1 — Read `vibe-coding-rules.md` in full. Run `git status` for the app folder. The working tree already holds uncommitted edits across many AltHistoryMap files; if any changed in the last few minutes another session is working: stop and tell Luke. [reads: Coding store; runs: Bash]
- [x] 2 — `countrydata.js` (pure): `COLOUR_NAMES`, `colourNameFor(hex, index)`, `GOVERNMENTS`, `ALIGNMENTS` (nine ids with row, column and label), `normaliseCountry(c, paletteLength, designCount, crestCount)` (the one validator, as `normaliseCrest` is for crests; it refuses an unknown alignment id), `blankCountry(colour)`, `MAX_FIELD` length. [VibeCoding]
- [x] 3 — `namegen.js` (pure) plus `alignmentpools.js` (the nine squares' data: governments, name forms, sound bias, epithets, motto words with nominative and ablative forms): `makeGovernment(alignment, rng)`, `makeName(style, alignment, government, rng)`, `makeRuler(style, alignment, government, rng)`, `makeMotto(alignment, rng)`, `makeDemonym(name, style)`, `generateAll(...)`, `STYLES`. Every function takes `rng` as an argument. [VibeCoding]
  - [x] Test in Sandbox — tests in step 9 run these with a fixed `rng`; also print 20 samples per style, and 5 mottos for each of the nine squares, to `System/Sandbox/`. Read them for sense (no empty, doubled or unpronounceable names; mottos that read as correct Latin). Ask Luke to skim the motto samples, since their Latin is the part I cannot prove.
- [x] 4 — Model and editor: `model.countries` list; `setCountry(colour, patch)` (undoable, validated by `normaliseCountry`); `replace` and `snapshot` carry it; `editor.js` wrapper behind `editGate` (the guide test allows only `model.js` and `editor.js` to call model mutators). A country is dropped from the list if its colour is past the end of the palette. [VibeCoding]
- [x] 5 — Map file: `mapfile.js` writes `countries` and reads it as optional, validated against palette length, design count and crest count. [VibeCoding]
- [x] 6 — Drag and drop: extend `dragitem.js` with `{kind: "crest", crest: n}` and a `crestCount` check; make `creststrip.js` thumbnails draggable (as `flagstrip.js` does); `stage.js` `onDragOver`/`onDrop` accept a crest and read the Political pixel; `palette.js` swatches accept crest and flag drops; `countries.js` (glue, like `crests.js`) turns a drop into `editor.setCountry` and says what happened. [VibeCoding]
- [x] 7 — Key Facts dialog: `countryfacts.js` + `countryfacts.css` + `<dialog data-role="country-facts">` in `index.html`. Flag and crest drawn at the top with `drawCells` (and `flagBlocks` where it fits), the 3 x 3 alignment grid under them (radio group with arrow-key movement; each square labelled in words and carrying a `data-term` definition), fields below, a Generate button on Name, Ruler, Type of Government, Motto and Demonym, a Generate all button, a style choice, Save and Cancel. Save fills an empty Motto from the alignment (D12). Add the nine `alignment` entries to `terms.js`. Read-only in View mode. Opens from the palette button, swatch double-click and a View-mode click on land (`stage.js`, checked against `CLICK_SLOP` so panning does not open it). Tokens only; no literal colour, size or duration. [VibeCoding, HouseStyle]
- [x] 8 — Wire in `main.js`: build the dialog and glue, pass `editor`, `model`, `state`, `say`. [VibeCoding]
- [x] 9 — Tests (write beside each step, run here as a whole): `namegen.test.js` (fixed-seed output; alignment steering over 200 runs; every motto matches one of the three templates and uses only stored forms; demonym rules), `countrydata.test.js` (including alignment ids), `terms.test.js` (nine alignment ids), `countryfacts.test.js` (fake DOM), additions to `dragitem` coverage (in `interface.test.js`), `model.test.js` (set, undo, redo, invalid), `mapfile.test.js` (round trip; header without `countries`; bad index refused); `test_scenarios.py` already decodes every bundled scenario; `test_guide.py` additions for the new cross-boundary rows, including the `terms.js` row (new `alignment` group). [VibeCoding TEST rules]
- [x] 10 — Browser check in the preview: start the app (`preview_start`), drag a crest onto land and a swatch, open Key Facts all three ways, pick each alignment square and see the generators change, use each Generate and Generate all, save with an empty Motto and check one appears, Save, undo, save the map, reopen it, open a bundled scenario. Read the console for errors. Then run `!DesignCheck` on the pop-up. [AG-2; runs: preview tools, !DesignCheck]
- [x] 11 — Docs (APP-1): `GUIDE.md` Navigation tree (add `plans/`, the new modules) and cross-boundary rows (`countrydata.js`/`mapfile.js`/`model.js`; the crest drag type; `namegen.js`); `README.md` one line on countries; `app-decisions.md` entry for D1 to D5, D11 and D12 as Key decisions and an approval row; `issues.md` rows for the D10 items. [APP-1]
- [x] 12 — Refactor pass: each touched file brought up to standard (AG-6); `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"` both green. [VibeCoding]
- [x] Verify — outputs meet every line in **Success criteria**, and the result matches the **Objective**? [pass/fail]

## Risks and notes

- **Latin quality.** Fixed templates and stored case forms stop wrong grammar, but not an odd pairing (a motto can be correct and still read strangely). Luke skims the step 3 samples; the word tables are the one place to fix it.
- **Alignment is flavour, not a rule.** It biases choices from pools; Luke can overwrite any field by hand, and an unset alignment leaves the generators unbiased.
- **This plan file is published.** `.github/workflows/publish-althistorymap.yml` mirrors the whole app folder into the public repo and excludes only `issues.md`. Either accept that this plan goes public, or add `--exclude /plans` to the workflow (a change outside the app folder, so Luke approves it first).
- **No commit or push in this plan.** A push to `main` publishes the app to the live sites (permission recorded in `app-decisions.md`, 2026-10-19). Commit only when Luke asks and no other session is working.
- **Back-compat is the main risk.** The new key must stay optional on read; the check is in step 9 (header without `countries`) and step 10 (a bundled scenario opens).
- **Palette undo.** `addColour` undo pops the last colour. A country on that colour can only have been set after it, and undo runs newest first, so the order is safe; `normaliseCountry` still refuses an out-of-range colour as a second guard.

## Final step — Close out (always present)
- [x] Update `status: Completed` in this plan's frontmatter.
- [x] Copy the file to `System/Plans/Completed/` as the system's record. The copy in the app's `plans/` folder stays, because Luke asked for the plan to live with the app's documents.
