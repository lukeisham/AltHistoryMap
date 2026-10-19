# AltHistoryMap — Guide

## Purpose

A zoomable Mercator world map for building alternative histories. Territory is painted on a 4096 x 4096 pixel grid; cities, flags, symbols and labels are markers on top. Three layers (Political, Province, Culture) each show alone, and Edit mode on Culture draws the political colours faded beneath it. Province is the Political view with a black line wherever the Province paint changes; the Province paint itself is never coloured in. Cities are ink bullseyes (a capital wears a second ring); the **Cities by nation** button colours each city's dot by the political colour under it. A map is one file: Save downloads it, Open loads it.

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
| `build/build_scenarios.py` | `app/flagcells.js` | Starter flag layouts (ported, compared by a test) | Scenario flags differ from the designer's starters |
| `app/glyphs.js` | `build_scenarios.py` and `editor.js` read it; `main.js` imports it and hands the ids to `mapfile.js` and the list to `symbols.js` and `render.js` (which builds the library `markers.js` draws from) | Glyph ids; `solid` marks a plain shape (filled in the marker's colour) against a Lucide outline on a disc. `build_glyphs.py` writes both kinds | An unknown id is rejected on read and unseen on the map; a shape drawn as an outline |
| `layers.js` | `state.js`, `render.js`, `recovery.js` import it; `layerbar.js` and `keys.js` reach it through `state.toggleView`; `markers.js` gets the result as `scene.layers` | The allowed views, the look each view or edit layer draws, and which layers' markers show | A saved or typed view the rules reject; a look the renderer has no loop for |
| `markers.js` | `render.js`, `layerbar.js`, `recovery.js` | `scene.cityColour` (`neutral` or `nation`, set by `renderer.setCityColour`, remembered as `cityColour` in `ahm.prefs`); `nation` reads the political plane under the city, or the commonest paint within two pixels when the city sits on a river or lake | A city dot that ignores the choice, or stays ink on a river |
| `model.js` | `render.js`, `mapfile.js`, interface modules | Planes, markers, palette, designs; a marker's `name` is empty when it has no name tag (never for a label) and `tagDx`, `tagDy` are its tag's offset in screen pixels; no stroke or fill writes a river or lake pixel, and `replace` clears them; `onChange` notices `{layer, rect}`, `{markers}`, `{palette}`, `{all}`; `discOffsets` is shared by the brush and its outline | Rendering draws stale pixels; old files stop opening |
| interface modules | `model.js` | Every edit goes through `editor.js`'s `editGate()`, which refuses in View mode | An edit made in View mode |
| `symbols.js`, `flagstrip.js` | `stage.js` | `dragitem.js`: the drag payload type `application/x-althistorymap-item`, a symbol glyph id or a flag design index | A dropped item places nothing |
| `filedrop.js` | `actions.js` | A map file dropped anywhere on the page opens as Open does | The browser navigates to the dropped file |
| `render.js`, `layerimage.js` | the screen | Below 1.5 screen pixels per grid pixel a coarser river overlay is drawn over the layer picture | Rivers vanish when zoomed out |
| `mapfile.js`, `recovery.js` | the browser | Download links, a file picker (started inside the click, before the unsaved-work question), IndexedDB `althistorymap` (store `recovery`, key `current`), `localStorage` key `ahm.prefs` | Save or crash recovery stop working |
| `serve.py` | the browser | Read-only GET and HEAD of `app/` on 127.0.0.1 (port 8801, or the next free one when run in a terminal); local Host header only; a strict Content-Security-Policy; ETag revalidation. Run without a terminal it opens no browser and keeps exactly 8801. `--port N` and `--no-browser` are its only options | A write route would need the request gate; an inline script or a remote file in `app/` is blocked by the policy |
| `Start AltHistoryMap.command` | `serve.py` | Runs `serve.py` from the app folder | The launcher opens nothing |
| `System/Apps/ports.json` | `serve.py`, the launcher | Port 8801 | The launcher and the Home tile open a dead address |
| `System/Tools/appservers/appservers.py` | `serve.py` | Starts it, restarts it when a `.py` is newer | The local copy goes down or serves stale code |
| `System/Apps/Home/catalog.json` | `serve.py` | Launch kind `server`, entry `serve.py`, port 8801 | The Home tile fails to open the app |
| the public repo `lukeisham/AltHistoryMap` | GitHub Pages at `https://lukeisham.github.io/AltHistoryMap/` | A root `index.html` and `.nojekyll`; the site is served from a sub-path, so every URL in `app/` is relative (`data/basemap.bin`, `data/scenarios/`) and none begins with `/` | A root-absolute URL loads nothing on the live site; anything in `app/` that needs Lukeatron paths or a Python server fails there |

The base map is rasterised at build time so the browser loads one small file and never parses geometry; scenarios use the map-file format so the app opens one with the one reader it already has. Styling is split across many CSS files that all read the one `tokens.css` (the HouseStyle token layer, the map-ground tokens and four 0-to-1 numbers the looks read); no other file writes a literal colour, size or duration, and the renderer reads its colours from the same tokens.

Tests run with `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"`.
