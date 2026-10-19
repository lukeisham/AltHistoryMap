# AltHistoryMap — Guide

## Purpose

A zoomable Mercator world map for building alternative histories, with a flag designer and a crest maker. Input: people create imaginary maps, flags and crests. Output: saved imaginary maps, flags and crests. A map is one file holding its paint, markers, flags and crests; a flag or crest also saves as a PNG. Essential functions: painting territory on a 4096 x 4096 grid in three layers (Political, Province, Culture), each shown alone; cities, flags, symbols and labels as markers; flags as palette grids that take a stamped coat of arms (a shield with an animal on each side); an enlarged view of a flag under the pointer; pop-ups defining each heraldic and flag term.

It is a static site, public on GitHub Pages, and it also runs on Luke's Macs through `serve.py`. It reads no other Lukeatron app, store or file, and `app/` must stay deployable on its own.

## Navigation
```
AltHistoryMap/
├── GUIDE.md · README.md · app-decisions.md · issues.md
├── Start AltHistoryMap.command
├── serve.py
├── app/                    served as is; deployable on its own
│   ├── index.html · tokens.css · one CSS file per component
│   ├── *.js                model · layers · render · interface · map file · api
│   │                       flag designer · crest maker · supporters · png export · flag zoom
│   │                       flag blocks · terms · term pop-ups
│   ├── glyphs.js
│   └── data/
│       ├── basemap.bin
│       ├── LUCIDE-LICENSE.txt
│       └── scenarios/      index.json + one .ahmap per listed scenario
├── build/
│   ├── build_basemap.py · build_scenarios.py · build_glyphs.py · raster.py · preview_scenario.py
│   ├── scenarios/          polygon sources, one JSON per scenario
│   └── source/             downloaded Natural Earth and Lucide files, SOURCES.md
└── tests/
```

## Cross-boundary behaviour

Three Lukeatron files point at the app (`System/Apps/ports.json`, `System/Apps/Home/catalog.json`, `System/Tools/appservers/appservers.py`); the app points at none of them.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `build/` scripts | `app/data/`, `app/glyphs.js` | `basemap.bin` (`AHBASE01` + zlib; bits LAND=1 RIVER=2 LAKE=4 COAST=8), `.ahmap` scenario files (gzip; `AHMAP001` + JSON header + five 4096 x 4096 planes: political, culture, province, reserved, border; `reserved` is always zero), `index.json`. Rebuild with `python3 build/build_scenarios.py [id ...]`, `python3 build/build_basemap.py`, `python3 build/build_glyphs.py` | The Python writer and the JavaScript reader (`mapfile.js`, `api.js`, `model.js`) must stay in step; `test_scenarios.py` decodes Python output with the real reader |
| `build/raster.py` | `app/model.js` | The same Mercator formula, 4096 grid, latitude clamp 85.0511 | Scenarios land in the wrong place |
| `build/build_scenarios.py` | `app/flagcells.js` | Starter flag layouts (ported, compared by a test); a scenario source draws a flag as 24 x 16 `rows`, each cell scaled to a 5 x 5 square (`SOURCE_SCALE`) | Scenario flags differ from the designer's starters |
| `app/glyphs.js` | `build_scenarios.py` and `editor.js` read it; `main.js` imports it and hands the ids to `mapfile.js` and the list to `symbols.js` and `render.js` (which builds the library `markers.js` draws from) | Glyph ids; `solid` marks a plain shape (filled in the marker's colour) against a Lucide outline on a disc. `build_glyphs.py` writes both kinds | An unknown id is rejected on read and unseen on the map; a shape drawn as an outline |
| `layers.js` | `state.js`, `render.js`, `recovery.js` import it; `layerbar.js` and `keys.js` reach it through `state.toggleView`; `markers.js` gets the result as `scene.layers` | The allowed views, the look each view or edit layer draws, and which layers' markers show | A saved or typed view the rules reject; a look the renderer has no loop for |
| `markers.js` | `render.js`, `layerbar.js`, `recovery.js` | `scene.cityColour` (`neutral` or `nation`, set by `renderer.setCityColour`, remembered as `cityColour` in `ahm.prefs`); `nation` reads the political plane under the city, or the commonest paint within two pixels when the city sits on a river or lake | A city dot that ignores the choice, or stays ink on a river |
| `model.js` | `render.js`, `mapfile.js`, interface modules | Planes, markers, palette, designs, crests (`MAX_CRESTS`); a marker's `name` is empty when it has no name tag (never for a label) and `tagDx`, `tagDy` are its tag's offset in screen pixels; no stroke or fill writes a river or lake pixel, and `replace` clears them; `onChange` notices `{layer, rect}`, `{markers}`, `{palette}`, `{all}`; `discOffsets` is shared by the brush and its outline | Rendering draws stale pixels; old files stop opening |
| interface modules | `model.js` | Every edit goes through `editor.js`'s `editGate()`, which refuses in View mode | An edit made in View mode |
| `crestcells.js` | `model.js`, `mapfile.js`, `flagcells.js`, `flagdesigner.js`, `crestmaker.js`, `creststrip.js`, `crests.js` | A crest is its choices, not its cells: `shape`, `division`, `ordinary`, `charge`, `supporterLeft`, `supporterRight` (ids from the lists in `crestcells.js`; the supporter ids come from `supporters.js`) and the palette colours `field`, `field2`, `ordinaryColour`, `chargeColour`, `outline`, `supporterLeftColour`, `supporterRightColour` (0 is white). `normaliseCrest` is the one validator; `model.js` calls it on every edit and `mapfile.js` on every read, and it gives a crest saved without supporters `none` on both sides. `renderCrest` makes 58 x 40 cells, `TRANSPARENT` (255) wherever nothing is drawn: the shield is 24 x 28 cells at (17, 11), the two animals fill 20 x 40 cells at each side, and the shield is drawn over them. `flagcells.js` `stampCrest` copies the whole result into a flag's cells, so a stamped flag no longer follows its crest | A crest the reader refuses; a flag stamped with transparent cells; a 255 stored as a colour; a shield that hides an animal's head |
| `supporters.js` | `crestcells.js` | `SUPPORTERS` (animal ids `none`, `lion`, `unicorn`, `horse`, `stag`, `bear`, `wolf`, `eagle`, `dragon`, `griffin`) and `rasterSupporter(id)`, a 20 x 40 mask facing right (`BODY`, `EYE`); `crestcells.js` mirrors it for the right side and paints its rim and eye in the outline colour. The ids are stored in the map file | An id removed from the list makes every crest that names it refuse to open |
| `terms.js` | `termtip.js`, `crestmaker.js`, `flagdesigner.js` | `termFor("<group>:<id>")` gives a name and definition. Groups: `part`, `role`, `shape`, `division`, `ordinary`, `charge`, `supporter` (crest maker, built from the id lists), `tool`, `starter`, `flag` (flag designer). An element with `data-term` gets a pop-up from `bindTermTips(dialog)`, which each dialog calls once, because a modal dialog hides everything outside it | An option with no definition shows no pop-up and logs a warning; `terms.test.js` fails when a listed id has none |
| `flagblocks.js` | `markers.js`, `flagstrip.js` | `flagBlocks(design, palette, white)`: the 120 x 80 design shrunk to 24 x 16 averaged colours, cached per design array and palette. A placed flag (36 pixels wide) and a Flags-list thumbnail draw from it; `flagzoom.js` and the designer draw every cell | A flag drawn with thousands of rectangles per frame, or a thumbnail that differs from the placed flag |
| `FLAG_W`, `FLAG_H`, `LEGACY_FLAG_SCALE` in `model.js` | `mapfile.js`, `flagcells.js`, every flag drawing module | `FLAG_W` x `FLAG_H` (120 x 80) is the flag grid; `LEGACY_FLAG_SCALE` (5) is how many cells an older 24 x 16 flag cell becomes. `mapfile.js` reads a flag of 384 cells and `flagcells.js` `upscaleLegacyFlag` scales it up; it always writes 9600 cells | Old maps and the scenario files stop opening, or open with flags in a corner |
| `mapfile.js` | `model.js` | The header key `crests`, a list of crest choice objects, written on every save and optional on read: a file saved before crests existed has no such key and opens with none. The format number (1) and `AHMAP001` are unchanged | Older maps stop opening; a new map fails in an older copy of the app |
| `flagdesigner.js`, `crestmaker.js` | `main.js` | Their `addColour(hex)` dependency is `editor.addColour`, so a colour picked in either dialog joins the map's palette (and the palette notice redraws everything that shows colours); `getCrests` gives the designer each crest rendered by `renderCrest`; `saveBlob` is `filesave.js` `downloadBlob` | A picked colour that is lost or applied to one dialog only; a Crest tool with no crests |
| `pngexport.js` | `flagdesigner.js`, `crestmaker.js`, `flagzoom.js`, `creststrip.js` | `cellsToPng` draws a cell grid at `FLAG_PNG_CELL` (8) or `CREST_PNG_CELL` (16) pixels per cell, transparent where the cell is `TRANSPARENT`, and gives a PNG blob; file names come from `designs.js` and `crests.js` (`<map name>-flag-<n>.png`, `<map name>-crest-<n>.png`) | A saved picture that is blurred, blank or wrongly named |
| `flagzoom.js` | `stage.js`, `flagstrip.js`, `main.js` | A fixed-position box (`data-role="flag-zoom"` in `index.html`) at the pointer; `stage.js` shows it for a flag marker under the pointer and hides it on leave, press, wheel, key or zoom button, `flagstrip.js` shows it beside a thumbnail | A zoom that stays after the pointer leaves, or shows during a drag |
| `symbols.js`, `flagstrip.js` | `stage.js` | `dragitem.js`: the drag payload type `application/x-althistorymap-item`, a symbol glyph id or a flag design index | A dropped item places nothing |
| `filedrop.js` | `actions.js` | A map file dropped anywhere on the page opens as Open does | The browser navigates to the dropped file |
| `render.js`, `layerimage.js` | the screen | Below 1.5 screen pixels per grid pixel a coarser river overlay is drawn over the layer picture | Rivers vanish when zoomed out |
| `mapfile.js`, `recovery.js` | the browser | Download links, a file picker (started inside the click, before the unsaved-work question), IndexedDB `althistorymap` (store `recovery`, key `current`), `localStorage` key `ahm.prefs` | Save or crash recovery stop working |
| `serve.py` | the browser | Read-only GET and HEAD of `app/` on 127.0.0.1 (port 8801, or the next free one when run in a terminal); local Host header only; a strict Content-Security-Policy; ETag revalidation. Run without a terminal it opens no browser and keeps exactly 8801. `--port N` and `--no-browser` are its only options | A write route would need the request gate; an inline script or a remote file in `app/` is blocked by the policy |
| `Start AltHistoryMap.command` | `serve.py` | Runs `serve.py` from the app folder | The launcher opens nothing |
| `System/Apps/ports.json` | `serve.py`, the launcher | Port 8801 | The launcher and the Home tile open a dead address |
| `System/Tools/appservers/appservers.py` | `serve.py` | Starts it, restarts it when a `.py` is newer | The local copy goes down or serves stale code |
| `System/Apps/Home/catalog.json` | `serve.py` | Launch kind `server`, entry `serve.py`, port 8801 | The Home tile fails to open the app |
| the public repo `lukeisham/AltHistoryMap` | GitHub Pages at `https://lukeisham.github.io/AltHistoryMap/`, and Cloudflare Pages at `https://althistorymap.pages.dev/app/` | A root `index.html` and `.nojekyll`; the site is served from a sub-path, so every URL in `app/` is relative (`data/basemap.bin`, `data/scenarios/`) and none begins with `/` | A root-absolute URL loads nothing on the live site; anything in `app/` that needs Lukeatron paths or a Python server fails there |
| `.github/workflows/publish-althistorymap.yml` | the public repo `lukeisham/AltHistoryMap` | On each push to `main` that changes `System/Apps/AltHistoryMap/`, it runs both test suites, then mirrors the folder into the public repo with the Actions secret `PUBLIC_REPO_TOKEN` (a fine-grained token with Contents write on that repo only). It leaves `issues.md` (private) out and keeps `index.html` and `.nojekyll` (public only). GitHub Pages and Cloudflare Pages (`https://althistorymap.pages.dev/app/`) rebuild from that commit | A missing or expired secret fails the run and the public copy goes stale; a failing test blocks publishing |

The base map is rasterised at build time so the browser loads one small file and never parses geometry; scenarios use the map-file format so the app opens one with the one reader it already has. Styling is split across many CSS files that all read the one `tokens.css` (the HouseStyle token layer, the map-ground tokens and four 0-to-1 numbers the looks read); no other file writes a literal colour, size or duration, and the renderer reads its colours from the same tokens.

Tests run with `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"`.
