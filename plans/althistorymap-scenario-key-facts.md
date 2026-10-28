---
plan: "althistorymap-scenario-key-facts"
context: [Lukeatron]
secondary_contexts: [Personal Research]
created: 2026-10-20
status: Completed
major_because: "multi-step; edits the scenario builder, eight scenario sources and tests; fans out research and verification sub-agents"
project: ""
rows: ["AltHistoryMap#5 (second half)"]
review: "APPROVED 2026-10-20 — inline !ReviewPlan: alignment (Lukeatron charter, app-decisions #17), efficiency (research and verification by sub-agents, build and tests by script, new builder code paired with tests), measurability (each step has a done-check, Verify precedes close-out); one flag fixed (sources file records the verdict)"
skills_used: [!IssuesAndDecisions, !VibeCoding, !FactCheck, !HeadlessChromeBrowser, !PlainEnglish]
---

# Plan — AltHistoryMap: real, source-checked key facts for the bundled scenarios

## Objective
Each country (political palette colour) in the eight bundled scenarios opens in the Key Facts pop-up with a ruler, government, motto, currency and demonym that a second, independent check confirmed against a primary or scholarly source, and any field that no source supports stays blank (`app-decisions.md` #17).

## Success criteria (measurable)
- `build/build_scenarios.py` accepts an optional `countries` list in a scenario source and writes it to the `.ahmap` header in the shape the app saves; a bad record stops the run with the file name and place.
- Every political colour in `achaemenid-500bc`, `han-100`, `roman-117`, `abbasid-800`, `mongol-1279`, `spanish-1600`, `ottoman-1683` and `british-1920` has a `countries` record. `blank-world` has none.
- Every non-blank `ruler`, `government`, `motto`, `currency` and `demonym` has a citation in `build/scenarios/<id>.sources.md` (source title, author or publisher, URL, locator), and the independent check marked it **verified** for the scenario's year. No generated or `namegen.js` text is used.
- `alignment` is empty, `flag` and `crest` are -1 in every record. No scenario map, flag or marker changes.
- `tests/test_scenarios.py` reads every rebuilt `.ahmap` with the app's real reader and matches its countries to the source; the app's full test suite is green.
- `GUIDE.md` describes the new `countries` key in the `build_scenarios.py` cross-file row, and `test_guide` passes.
- Row 5 of `issues.md` is deleted through `!IssuesAndDecisions` (see step 8).
- Charter baseline (Lukeatron): the feature works (shown by test output and by opening a scenario in the running app), it follows the house style of the sibling build code, and no core skill, checkpoint, template or `CLAUDE.md` file changed.

## Pre-decisions (change at review, or they stand)
- **A colour is a country.** Where two colours are the core and the outer provinces of one state (Achaemenid, Han, Abbasid, Roman), both records carry the same state's facts, and the name is qualified, for example "Achaemenid Empire (outer satrapies)".
- **Year-true.** Each fact must hold in the scenario's year, not today.
- **Blank beats guessed.** Ancient states with no attested motto, or no ruler for a vassal colour, stay blank. The schema's limits apply: 60 characters, 80 for the motto.
- **Linking is out of scope.** Linking each country to its scenario flag design is a separate wish, not done here.

## Resources
- **Memory to read:** `System/Docs/Rules/vibe-coding-rules.md` in full before the first edit; `System/Apps/AltHistoryMap/GUIDE.md` and `app-decisions.md` (#14, #17); `app/countrydata.js` (field limits), `app/mapfile.js` (how `countries` is read).
- **Capability skills:** `!HeadlessChromeBrowser` for sources that need a real page; sub-agents also use their own web search and fetch tools.
- **Domain skills (Skillbank):** `!FactCheck` (its fail-closed rule and provenance labels, applied per field rather than to a pasted paragraph), `!IssuesAndDecisions` (delete the row), `!VibeCoding` (always on).
- **Sub-agents:** one researcher per scenario (7 historical scenarios, step 3); one independent verifier per scenario (step 4). The verifier gets only the claims and their citations, never the researcher's reasoning.
- **Scripts:** `System/Sandbox/althistorymap-key-facts/roster.py` (step 1, one-off); `python3 build/build_scenarios.py`; the app's tests; `python3 System/Tools/comment-lint/comment_lint.py`.
- **Temp-skills:** none

## Steps
- [x] Step 1 — Read the rules and the open state. Read the vibe-coding rules, then confirm in `issues.md` that row 5 still names key facts, and in `git status` that no one has edited `System/Apps/AltHistoryMap/` in the last 10 minutes. Do not start while the Sunday run `sunday-althistorymap-wishes` is working in that folder: both edit `GUIDE.md`. [reads: vibe-coding-rules.md, GUIDE.md, app-decisions.md]
- [x] Step 2 — Build the roster. Write a small script that lists, for each source in `build/scenarios/`, every colour used on the `political` layer: index, hex, the areas and markers it covers, and the scenario `note`. Save it as `System/Sandbox/althistorymap-key-facts/roster.json` and print it as a table. Done-check: one row per political colour (about 29 across 8 scenarios, none for `blank-world`). [script, Sandbox]
  - [x] Test in Sandbox — N/A: read-only listing, checked by eye against the scenario notes.
- [x] Step 3 — Name the state behind each colour. A sub-agent reads the roster and writes, per colour, the historical state and year it stands for (for example `mongol-1279` colour 2 = Golden Horde). Apply the "a colour is a country" pre-decision. Done-check: every roster row has a state and year; any colour it cannot place is listed, not guessed. [sub-agent]
- [x] Step 4 — Teach the builder about `countries`. Copy `build/build_scenarios.py`, `tests/test_scenarios.py` and `GUIDE.md` to `System/Sandbox/althistorymap-key-facts/rollback/`. Add `countries` to `TOP_KEYS`; validate it (list, colours in the palette and used on the political layer, no colour twice, only the seven app keys, text limits matching `countrydata.js`); write each record into the header with its set fields only. Write the failing tests first: a source with `countries` round-trips through the real reader; a duplicate colour, an unknown key and an over-long motto each stop the run. Show test output. [script edit, `!VibeCoding`]
  - [x] Test in Sandbox — the new tests run against a temporary output folder, not `app/data/`.
- [x] Step 5 — Research the facts. One sub-agent per historical scenario, in parallel. For each colour: ruler (head of state in that year), government (type), motto (an attested motto or royal slogan of that state), currency (principal coin or unit in that year), demonym. Sources must be primary or scholarly (an edition of the primary text, a university press, a journal, a standard reference such as Encyclopaedia Iranica or the Cambridge histories); Wikipedia is never the only source. Each sub-agent writes `System/Sandbox/althistorymap-key-facts/research/<id>.json` (field, value, citation, locator, confidence) and leaves a field blank when no source supports it. Never invent a page number or quotation: an approximate locator is marked as approximate. [sub-agents, `!HeadlessChromeBrowser` where a page needs a real browser]
- [x] Step 6 — Check every claim independently. One fresh sub-agent per scenario receives only the list of claims and their citations, re-opens each source, and returns **verified**, **unsupported** or **contradicted** for that year, with the passage it relied on. Any field not **verified** is blanked. Done-check: a table of every field and its verdict, with the count blanked per scenario. [sub-agents, `!FactCheck` fail-closed rule]
- [x] Step 7 — Write the verified facts. For each scenario, add the `countries` list to `build/scenarios/<id>.json` and write `build/scenarios/<id>.sources.md` with one line per non-blank field: citation, locator and the verifier's verdict (so the "verified" criterion can be checked by counting lines). Show Luke the full table (scenario, country, five fields, source) as one summary; a disputed row is fixed by editing that source file and rebuilding, and does not hold up the plan. [reads: research output]
  - [x] !Checkpoint — N/A: stays inside `System/Apps/AltHistoryMap/`, nothing outgoing, no Long-Term memory change.
- [x] Step 8 — Rebuild and test. Run `python3 build/build_scenarios.py` for all eight scenarios, add a test that each rebuilt `.ahmap` yields exactly the countries in its source, then run the app's full test command (see `README.md`) and `comment_lint.py` on the changed files. Add the `countries` key to the `build_scenarios.py` row of the cross-file table in `GUIDE.md`, and run `test_guide`. Show the output. [script]
- [x] Step 9 — See it in the app. Start `serve.py`, open `ottoman-1683` and `mongol-1279`, click painted land in View mode, and check that the Key Facts pop-up fields equal the source and that a blank field is blank. Take one screenshot. [`!HeadlessChromeBrowser`]
- [x] Step 10 — Close the issue. Read row 5 in `issues.md`. If it still includes the country names half and `app/countrylabels.js` is not yet wired in, reword it with `!IssuesAndDecisions` to the names half only; otherwise delete the row. Then update the "Not queued" line for AltHistoryMap #5 in `System/Plans/New/_sunday-queue.md` to point at this plan, or remove it. [`!IssuesAndDecisions`]
- [x] Verify — outputs meet every line in **Success criteria**, and the result matches the **Objective**? [pass/fail]

## Final step — Close out (always present)
- [x] Update `status: Completed` in this plan's frontmatter.
- [x] Move the file from `System/Plans/New/` to `System/Plans/Completed/`.
