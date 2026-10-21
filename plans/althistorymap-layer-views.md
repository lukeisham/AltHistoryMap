---
plan: "althistorymap-layer-views"
context: [Personal Research]
secondary_contexts: [Coding]
created: 2026-10-14
status: Completed
major_because: "multi-step"
project: ""
skills_used: [!CreatePlan, !ReviewPlan, !DesignCheck, !HouseStyle]
---

# Plan — AltHistoryMap: layers shown together by mode

## Purpose
Today the app shows one layer at a time. This plan lets Luke show layers together in View mode, in the combinations that read cleanly, and makes Edit mode on Culture show the political colours faded underneath. It also gives each layer its new look: Political stays full colour, Conflict becomes hatching, Culture becomes a pale tint. Luke approved the design from the mockups `System/Sandbox/AltHistoryMap-mockups/layers-modes.html` (the earlier `layers-together.html` explored patterns for Political + Culture, which are now out of scope).

The rules, as approved in chat on 2026-10-14:

| Mode | What can be on screen |
|---|---|
| View | Political · Conflict · Political + Conflict · Culture · Culture + Conflict. Political + Culture never. |
| Edit, Political | Political alone |
| Edit, Conflict | Conflict alone (assumed; Luke did not answer the question) |
| Edit, Culture | Culture colours over the political colours, faded |

| Wave | What | Who |
|---|---|---|
| 0 | Baseline tests; record the decision; amend the render and interface specs | Main session |
| 1 | Pure layer rules module and its tests | Main session |
| 2 | Renderer: looks, tokens, markers, PNG name | Main session |
| 3 | Interface: state, layer bar, keys, saved preferences | Main session |
| 4 | Tests brought up to date; browser verification; design check | Main session |
| 5 | Independent code review; fixes; docs; close-out | 1 sub-agent, then main session |

Waves 1 to 3 edit files that depend on each other, so they run in order in one session, not in parallel.

## Objective
In `System/Apps/AltHistoryMap/`, View mode offers exactly the five approved views and Edit mode follows the approved table. Each layer has its new look, and every change is verified in the running app, so the app serves Luke's alternative-history building on a map that works and matches house style.

## Success criteria (measurable)
- `app/layers.js` holds the one definition of the allowed views. A test that tries every sequence of eye toggles and name clicks (up to length 6, from every starting view) finds that no state ever has Political and Culture on together, no state has zero layers on, and the set of reachable views is exactly the five approved.
- In the running app on the Roman Empire AD 117 scenario, each of the five views draws as in the mockup: Political full colour with borders; Conflict as hatching only (a `/` line for the first claimant, a `\` line for the second, a denser red cross-hatch for fighting); Culture as a solid pale tint; Political + Conflict with lines one shade deeper; Culture + Conflict with lines in true colours.
- In Edit mode on Culture, the political colours are faded (default 35% of their strength) and culture is drawn over them at 70%. Painting a culture pixel updates only that rectangle (the existing partial-repaint test still holds). Edit mode on Political and on Conflict each shows that layer alone.
- Cities, flags and labels show exactly when Political is on screen; a symbol shows exactly when its own layer is on screen; the hit test uses the same rule (tested). No marker on a hidden layer can be selected.
- The layer bar shows eyes in View mode and three buttons in Edit mode. An action that switches another layer off says so in the bar's message line. The last visible layer's eye is disabled. Keys `1` `2` `3` go to that layer; `Shift` + `1` `2` `3` toggle its eye in View mode.
- The last view and layer are remembered in `ahm.prefs`; a stored value that is not an approved view falls back to Political; old stored values still load (tested).
- PNG export names the layers on screen, for example `Rome-political+conflict.png`.
- Saved maps are unchanged: no change to the map file format or to `build/`, and every `.ahmap` scenario still opens (`test_scenarios.py` passes untouched).
- `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"` both pass, with tests added or rewritten for every rule above. A full layer-picture rebuild takes under 300 ms for every look (render spec AC-5), timed in the browser.
- `README.md`, `app-decisions.md` (Approvals row and one Key decision), `_build/specs/render.spec.md` and `_build/specs/interface.spec.md` all describe the new behaviour. `grep -rniE "one at a time|one layer|dots|stripes" app README.md _build/specs` finds no hit that describes current behaviour. The closed PRD is not edited; the Approvals row records that the new rules reverse its "one layer at a time".
- `!DesignCheck` (usability and visual lenses) finds no defect left open on the layer bar.
- Charter baseline: the app works against reality (browser check, not just tests), matches house style (siblings read first, tokens only, no literal colour), touches no key skill, checkpoint or template, and nothing leaves the system.

## Resources
- **Memory to read:** `Memory/Long-Term/Coding/vibe-coding-rules.md` (the rules the app obeys; read before editing).
- **Capability skills:** none.
- **Domain skills (Skillbank):** `!DesignCheck` (layer bar review). `!HouseStyle` is always on for the layer bar and tokens.
- **Sub-agents:** one fresh code reviewer for the finished diff (judgement; independent of the author).
- **Scripts:** none new. The two existing test commands do the deterministic work.
- **Temp-skills:** none.

## Design decisions the steps carry out
- **Layer rules live in one new pure module, `app/layers.js`.** It holds the approved views, the toggle and solo functions, and the function that turns (mode, edit layer, view) into a look. State, layer bar, keys, renderer and prefs all call it; none repeats the rules.
- **State gains `view`** (the layers shown in View mode). `layer` stays the layer being edited and the tool source. Invariant: in View mode, `layer` is in `view`.
- **The renderer takes a look, not a layer.** Looks: `political`, `conflict`, `political+conflict`, `culture`, `culture+conflict`, `editCulture`. `layerimage.js` keeps one loop per look so the choice stays out of the per-pixel path. A model notice repaints only if its plane takes part in the current look.
- **Looks use tokens.** Numeric tokens for the culture tint, the political fade and the hatch darkening go in `tokens.css` with dark overrides; `readTheme` gains a number reader. No other file writes a literal.
- **Patterns stay fixed to the map grid.** At world view they average into a tint. This is accepted and not addressed here.

## Assumptions (change on Luke's word; each is one place in the code)
1. Edit mode on Conflict shows Conflict alone. (Alternative: hatching over faded political.)
2. In Edit mode on Culture, cities, flags and labels are hidden, and culture symbols show.
3. `Shift` + `1` `2` `3` toggles an eye in View mode, as shown in the mockup notes.
4. Pale tint is 60% toward white in light theme and 32% in dark; hatch lines over a fill are 50% toward black; the culture blend is 70%.

## Steps
Bite-sized and ordered. Each box is one action. Mark `[x]` when complete.

### Wave 0 — Baseline and paperwork
- [x] Step 1 — Run `git status` and confirm no other session is changing files in `System/Apps/AltHistoryMap/` (CLAUDE.md: nothing locks a file). [runs: Bash]
- [x] Step 2 — Run both test suites and record the pass counts as the baseline. [runs: `node --test tests/*.test.js`; `python3 -m unittest discover -s tests -p "test_*.py"` in `System/Apps/AltHistoryMap/`]
- [x] Step 3 — Read `Memory/Long-Term/Coding/vibe-coding-rules.md`, and `app/layerbar.css` and `app/toolpanel.js` as the nearest siblings for the new bar. [reads: Coding store]
- [x] Step 4 — Write the approval and decision into `app-decisions.md`: an Approvals row ("2026-10-14, layer rules change approved; reverses the PRD's one layer at a time") and one Key decision (view-mode combinations; Culture never with Political; Edit Culture fades Political; reason: Political and Culture cannot share a pattern without hiding one of them; rejected: speckle, dots, grid, tint, seam, rim). The PRD closed on 2026-10-14 and stays closed (`!AppDevelopment`: the specs are the build instruction). A decision confined to one app is not a `history.log` line. [inline]
- [x] Step 5 — Amend `_build/specs/render.spec.md` (FR-2, FR-3, FR-5, FR-8, AC-2, AC-3 and the AD-3 pattern decision) and `_build/specs/interface.spec.md` (FR-1, FR-3, FR-4 keys, AC list). Add the looks table and the rules table from this plan. Do not edit `_build/prd.md`. [inline]

### Wave 1 — Layer rules
- [x] Step 6 — Create `app/layers.js`: `ALLOWED_VIEWS`, `isAllowedView`, `toggleLayer(view, layer, shown)` returning `{view, note}`, `soloLayer`, `lookFor({mode, layer, view})`, `layersOnScreen(look)` and `lookFileName`. Pure functions, no DOM, JSDoc like `tools.js`. [inline]
  - [x] Test in Sandbox — N/A: it is pure code, tested in place. Write `tests/layers.test.js` with the exhaustive sequence test from the success criteria, plus one test per `note` message and per look. [runs: `node --test tests/layers.test.js`]

### Wave 2 — Renderer
- [x] Step 7 — Add the numeric tokens (`--culture-tint`, `--political-fade`, `--culture-blend`, `--hatch-deep`) to `app/tokens.css` with dark overrides, and a number reader in `readTheme`. [inline]
- [x] Step 8 — Refactor `app/layerimage.js`: `makeSource` adds the pale, deep and faded palettes; replace `conflictPixel` and `culturePixel` with the line and tint rules; add `editCulturePixel`; `pixelColour(look, …)` and `fillRect(look, …)` take a look; add `lookUses(look, plane)`. [inline]
- [x] Step 9 — Update `app/render.js`: `setLook` and `getLook` replace `setLayer` and `getLayer`; a layer change rebuilds in full; `onModelChange` repaints only when the plane takes part in the look; `pngFileName` takes the layers on screen. [inline]
- [x] Step 10 — Update `app/markers.js`: `markerVisible(marker, layersOnScreen)` and `hitMarker` use the same rule. [inline]

### Wave 3 — Interface
- [x] Step 11 — Update `app/state.js`: add `view`; keep `layer` in `view`; route layer changes through `layers.js`; clear the selection when its marker leaves the screen. [inline]
- [x] Step 12 — Rebuild the bar: `app/layerbar.js`, `app/layerbar.css`, and the `<nav class="layerbar">` markup in `app/index.html`. Eyes in View mode, buttons in Edit mode, note in the message line, last eye disabled, focus ring on every control, `aria-pressed` on eyes and names. [inline; `!HouseStyle` in force]
- [x] Step 13 — Update `app/keys.js` (`1` `2` `3` go to a layer; `Shift` + digits toggle) and `app/recovery.js` (`view` in `ahm.prefs`, validated against `ALLOWED_VIEWS`). [inline]
- [x] Step 14 — Wire it in `app/main.js`, `app/stage.js` (dismiss on a view change) and `app/actions.js` (PNG name). [inline]
- [x] Step 15 — Read `build/preview_scenario.py`. It previews raw planes; change it only if it claims to mirror the app's look. [inline]

### Wave 4 — Tests and verification
- [x] Step 16 — Rewrite the tests that name the old behaviour: `tests/render.test.js` (pixel rules for each look, the "only the active layer shows" test, repaint by look, markers, PNG name), `tests/interface.test.js` (layer switch, keys, tool repair), `tests/recovery.test.js` (prefs), `tests/actions.test.js` (fake renderer). [inline]
  - [x] Test in Sandbox — N/A: tests run in place and use fake DOMs and temp data; confirm no live file changes with `git status` after. [runs: both suites]
- [x] Step 17 — Start the app with `preview_start` on `http://127.0.0.1:8801`. Load Roman Empire AD 117. Click through all five views in View mode and Edit mode on each layer; read the console and network for errors; take a screenshot of each view; check dark theme; time a full rebuild per look in the console. Report five screenshots (one per allowed view), the Edit-on-Culture screenshot, and the five rebuild times in the reply. [runs: Browser pane tools]
- [x] Step 18 — Run `!DesignCheck` on the layer bar (usability and visual lenses) and fix what it finds. [runs: `!DesignCheck`]

### Wave 5 — Review, docs, close
- [x] Step 19 — Spawn a fresh code-review sub-agent on the diff of `System/Apps/AltHistoryMap/` with the rules table above as its brief; fix every confirmed finding. [sub-agent]
- [x] Step 20 — Update `README.md` (the Navigation tree gains `layers.js`; the Cross-app table row for `model.js` and the interface modules mentions views; one sentence on the layer rules). Then run `grep -rniE "one at a time|one layer|dots|stripes" app README.md _build/specs` and fix every hit that describes current behaviour. [inline; the grep is the check]
- [x] Step 21 — Run both suites a last time and compare with the baseline. [runs: both test commands]
- [x] Verify — each line in **Success criteria** is met, and the result matches the **Objective**? [pass/fail]
- [x] Step 22 — Suggest whether any repeated step deserves a skill. [runs: `!Suggest`]

Commit only if Luke asks, and only after `python3 System/Tools/gitsync/gitsync.py` and a check that no other session is active.

No `!Checkpoint` step: nothing leaves the system, no Long-Term memory changes, and no Sandbox artefact is promoted.

## Outcome
Reviewer findings fixed: the first state now repairs the tool and keeps an edited layer the saved view lacks; a plain digit key clears the layer note; the last eye uses `aria-disabled` so it keeps focus; the culture test now puts its claim on a hatched pixel; digit keys use key position so AZERTY works. The reviewer's finding 7 (overflow at 320 px) did not reproduce for the bar. Finding 8 (cities, flags and labels hidden in Edit mode on Culture) stands as assumption 2. Final counts: 94 JavaScript tests, 21 Python tests, comment lint clean; rebuild 21 to 109 ms per look.

## Final step — Close out (always present)
- [x] Update `status: Completed` in this plan's frontmatter.
- [x] Move the file from `System/Plans/New/` to `System/Plans/Completed/`.
