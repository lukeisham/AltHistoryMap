# AltHistoryMap — Decisions

## Approvals

What Luke has signed off. A draft and an approved document look identical on disk — this table is
the only difference. A decision that deliberately reverses an earlier one also goes here, so a
later agent does not "restore" the old behaviour.

| Date | Approved | Version / scope |
|---|---|---|
| 2026-10-13 | PRD approved | PRD v1.0 |
| 2026-10-13 | Symbols added to the PRD, approved | PRD v1.1 |
| 2026-10-13 | Flag designer added to the PRD, approved | PRD v1.2 |
| 2026-10-14 | Design closed; specs approved | PRD v1.2 |
| 2026-10-14 | Layer rules approved: layers can show together in View mode, Culture never with Political, Edit mode on Culture fades Political. Reverses the PRD's one layer at a time; the PRD is not edited, the render and interface specs carry the change | PRD v1.2 + specs |
| 2026-10-14 | Plain shapes (square, circle, triangle, diamond, pentagon, hexagon, star, cross) added to the symbol picker, drawn filled in the chosen colour. Extends Key decision 3: the shapes are hand-written paths, not Lucide | app change |
| 2026-10-17 | Conflict layer replaced by a Province layer: its own paint, drawn at full strength with black outlines round the coloured areas, with Political hidden. Reverses the Conflict hatching and the Political + Conflict and Culture + Conflict views | app change |
| 2026-10-17 | Rivers are walls to a fill (reverses Key decision 4's crossing rule); a stroke shows its colour as the brush moves; the rename field opens below the marker popover; a city can be made a capital | app change |
| 2026-10-14 | App confirmed working; PRD and specs no longer required | `_build/prd.md` + `_build/specs/` |
| 2026-10-14 | Build accepted; build docs retired | `_build/` |

## Key decisions

Only an important decision (CORE-4): one a future agent, reading only the code and README, would
likely undo or do differently. Each gets its reason; the reason is the point. Append it the moment
it is made. A minor or easily guessed choice belongs in the commit message.

| # | Decision | Reason | Rejected alternative |
|---|---|---|---|
| 1 | Territory is a 4096 x 4096 pixel grid in Mercator; the base map has coastlines, main rivers and major lakes only, no country outlines | Luke wants pixel-by-pixel painting at the closest zoom, so territory cannot follow country shapes. 4096 gives about 80 pixels from Rome to Carthage; 2048 is too coarse for cities and 8192 is too heavy | Equirectangular grid (even pixel area, less familiar look); 8192 x 8192; painting by country or region |
| 2 | Fully static web app, put online as a public site; no server, no accounts. Save downloads a map file and Open loads one | Luke wants it online. Free to host, nothing to run, no one else's data to hold, within the vibe-coding rules (SR-2). A map is one self-contained file | Shareable links (needs a hosted map store and a new dependency); accounts and cloud saves (heaviest, far outside the rules) |
| 3 | Symbols are a preset set of Lucide glyphs plus eight plain shapes, on all three layers; no other custom glyphs | Luke asked for a simple preset set and not to reinvent the wheel; Lucide is on the house approved list and is plain SVG, so no dependency | Phosphor; drawing custom glyphs; Political layer only |
| 4 | Painting, filling and borders work on dry land only: never on the sea, rivers or lakes; naval power is shown with symbols. A river is a wall to a fill: it is neither coloured nor crossed. A map loaded with paint on water has that paint cleared | Fill on sea would flood the oceans, and the PRD limits borders to land. Luke wants rivers and lakes always readable, so territory never covers them | Painting on sea; letting territory cover rivers; a river stopping a fill |
| 5 | View mode offers three views, each alone: Political, Province, Culture. Culture (in Edit mode) draws the political colours faded beneath it. Province shows only its own paint at full strength, each area outlined in black | Political fills every pixel it covers, so culture and provinces could only show as a pattern that hides part of the fill and averages into noise at world view. Fading Political and laying one layer over it keeps both readable | Speckle, dot lattice, grid, pinstripe, tint, seam, studs and rim patterns over full-strength Political; combined views |
| 6 | A name tag is part of a marker but moves on its own: `tagDx`, `tagDy` are screen-pixel offsets from the default spot, and an empty name means no tag | Luke wants symbols and cities placed with or without a name tag and wants tags dragged apart from their markers. Screen pixels keep a tag beside its marker at every zoom; a name that cannot be empty would force a tag | A tag offset in grid pixels (drifts away when zoomed); a separate "show name" flag (a hidden name nobody can see) |
| 7 | `serve.py` is the one way to run the app locally, for Luke and for anyone who downloads the repo. In a terminal it opens the browser and steps to the next free port; with no terminal (supervisor) it opens nothing and keeps port 8801. It sends a strict Content-Security-Policy and refuses foreign Host headers | The app cannot run from `file://` (module scripts), so a person needs a server; Python 3 is the one prerequisite most machines have. The supervisor and Home tile depend on 8801, so only an interactive run may move | An Electron or Node wrapper (a download and a dependency); GitHub Pages as the only route (needs a network) |
| 8 | A city is drawn as an ink bullseye whatever its stored colour; its centre dot takes the political colour under it only when the viewer turns on "Cities by nation" (a remembered viewer preference, never saved in the map file) | Luke wants cities distinctly cities and not colour-coded to the political layer by default; symbols and flags stay palette-coloured, so a neutral ring-and-dot mark tells them apart at a glance. Paint never covers rivers, so a river city looks to its neighbours for the colour | A coloured disc per city (looks like a symbol); storing the nation on each city (goes stale when territory is repainted) |
| 9 | A capital is a city with `capital` and `nation` (the political colour it stands for, read when it was made a capital). It turns back into a city when its own pixel and all four sides have lost that colour; the change is part of the edit that caused it, so undo restores it | Luke wants a capital to belong to its nation: repainting the land around it ends the claim without a separate step. Reading the colour once means repainting a neighbour does not matter, only losing the whole surround | A capital that never reverts; a check against the whole nation's area |

## Rule exceptions

Deliberate breaks from `Memory/Long-Term/Coding/vibe-coding-rules.md`, each granted by Luke after
being asked with the rule ID and a reason. Code that matches a row here is intentional — do not
"fix" it.

| Rule ID | Where it applies | Reason | Granted |
|---|---|---|---|
| !HouseStyle ground contract (dark override) | `app/tokens.css`: light only, no `prefers-color-scheme` or `data-theme` dark blocks | Luke does not want dark mode on this app | 2026-10-15 |