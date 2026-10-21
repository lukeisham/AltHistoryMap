---
plan: "sunday-althistorymap-wishes"
context: [Lukeatron]
secondary_contexts: [Teaching]
created: 2026-10-20
status: Completed
major_because: "multi-step; edits several files across an app"
project: ""
rows: ["AltHistoryMap#3:91113ec9", "AltHistoryMap#4:0c1f2543", "AltHistoryMap#5:c52095f5"]
queue_week: 2026-10-25
review: "APPROVED 2026-10-20 — inline !ReviewPlan: alignment (Lukeatron charter, Sunday-night purpose), efficiency (checks by script, edits by sub-agent), measurability (every step has a Done-check, a Verify step precedes close-out)"
skills_used: [!AppIssues, !VibeCoding, !HouseStyle]
---

# Plan — AltHistoryMap: shield-only stamp, supporter facing and holding, country names on the map

## Objective
AltHistoryMap's flag designer can stamp a shield alone, the crest maker's supporters can face outward and hold or stand on a compartment and motto ribbon, and each country's name is drawn on the map.

## Success criteria (measurable)
- each of the three features works in the running app and is covered by tests
- the app's tests are green and `GUIDE.md` describes each new cross-file behaviour
- row 5 keeps only its second half, the key facts in the bundled scenarios
- Every row this plan names is deleted from its `issues.md` through `!AppIssues`, or is listed in `_sunday-queue.md` as carried with the exact reason.
- The Lukeatron charter baseline holds: the thing works (shown by the output of its checks), it matches the house style of its siblings, and no core skill, checkpoint, template or `CLAUDE.md` file changed.

## Resources
- **Memory to read:** `Memory/Long-Term/Coding/vibe-coding-rules.md` in full before the first edit; `GUIDE.md` and `app-decisions.md` of each app named below.
- **Capability skills:** none
- **Domain skills (Skillbank):** `!AppIssues` (delete a row once it is verified closed), `!VibeCoding` (always on)
- **Sub-agents:** one per issue step that needs judgement about the code; each gets only its step block, the vibe-coding rules and the app folder.
- **Scripts:** `python3 System/Tools/sunday-night/check_jsdoc.py <folder>` (JS-4 check), `python3 System/Tools/comment-lint/comment_lint.py` (CORE-2), the app's own tests
- **Temp-skills:** none

## Run rules (read first)
- No questions. Anything not answered below is carried to the next Sunday, never asked. Luke's answers are the **Pre-decision** lines.
- Edit only inside: `System/Apps/AltHistoryMap/`, their tests, `GUIDE.md` and `app-decisions.md`. Standing permissions are in `history.log` under scope `!SundayNight`.
- Before each edit copy the files to `System/Sandbox/sunday-althistorymap-wishes/` for rollback. Before each step re-run its **Verify open** command: if it no longer holds, the row is solved: delete it and move on.
- AG-1: change only what the step names; a defect found but not named becomes a `bug` row via `!AppIssues`. AG-2: show test output. AG-4: never loosen a test. A step that fails twice is restored from its copies and carried with the exact failure.
- A file edited by someone else in the last 10 minutes (`git status`, mtime) means the step is carried with reason "file busy".
- After the last step: `python3 System/Tools/gitsync/gitsync.py --before-commit`, commit only this plan's files, then push to `origin main` (permission logged).

## Steps
- [x] AltHistoryMap #3 (wish) — "A shield-only stamp for the flag designer, so a small emblem fits the middle of a flag without its supporters"
  - Verify open: read the stamp code in `app/flagdesigner.js`, `app/flagblocks.js` and `app/flagcells.js`: no shield-only stamp option exists (the crest maker's own shield does not count)
  - Change: Read `GUIDE.md`, `app/flagdesigner.js`, `app/crests.js` and the stamp code first. Add a shield-only variant of each coat of arms to the stamp tool, chosen by a small control beside the stamp picker (follow `!HouseStyle` and neighbouring controls), saved and loaded with the flag.
  - Pre-decision: Luke chose to build it (2026-10-19).
  - Done-check: a test stamps the shield-only variant and the saved flag round-trips; the app's tests are green
  - Then: `python3 System/Tools/comment-lint/comment_lint.py` on the changed files, the app tests, then delete the row via `!AppIssues`
- [x] AltHistoryMap #4 (wish) — "Supporters can face outward, and can hold or stand on a compartment and motto ribbon"
  - Verify open: read `app/supporters.js`, `app/crestcells.js` and `app/crestmaker.js`: `grep -rli compartment app` finds nothing; build only the parts still missing among facing outward, a compartment and a motto ribbon, and say which already existed
  - Change: Read the crest maker (`app/crestmaker.js`, `app/crestcells.js`, `app/crests.js`). Add: a facing option (inward or outward) per supporter; an optional compartment the supporters stand on; an optional motto ribbon they hold. Saved and loaded with the crest, and old saved crests still load unchanged.
  - Pre-decision: Luke chose to build it (2026-10-19).
  - Done-check: tests: a crest with the new options round-trips; an old crest file still loads; the app's tests are green
  - Then: `python3 System/Tools/comment-lint/comment_lint.py` on the changed files, the app tests, then delete the row via `!AppIssues`
- [x] AltHistoryMap #5 (first half) (wish) — "Country names drawn on the map, and the bundled scenarios filled in with their countries' key facts"
  - Verify open: read the map renderer: no code draws a country's name as text on the map (`countryName` in `app/countries.js` is a data field, not a drawn label)
  - Change: Read `app/countries.js` and the map renderer. Draw each country's name over its Political region, sized to the region and hidden when the region is too small, with a toggle like the other layer controls. Do NOT write key facts into scenarios. When this half passes, reword row 5 with `!AppIssues` to "The bundled scenarios filled in with their countries' key facts".
  - Pre-decision: Luke chose country names only; the key-facts content stays open (2026-10-19).
  - Done-check: tests cover label placement and the hide rule; the app's tests are green; the row text now names only the key facts
  - Then: `python3 System/Tools/comment-lint/comment_lint.py` on the changed files, the app tests, then delete the row via `!AppIssues`
- [x] Verify — every line in **Success criteria** holds and the result matches the **Objective**? [pass/fail]

## Final step — Close out
- [x] Update `status: Completed` in this plan's frontmatter. Skip if any step is carried: the unticked steps stay here for next Sunday.
- [x] Move the file from `System/Plans/New/` to `System/Plans/Completed/`.
