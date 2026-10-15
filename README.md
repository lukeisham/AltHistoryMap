# AltHistoryMap

A zoomable world map for building alternative histories. Luke founds cities, plants flags and paints territory on a Mercator map, or starts from one of nine ready-made empire sketches and changes it. Three layers (Political, Conflict, Culture) show alone or together in View mode, in the five combinations `app/layers.js` allows; Political and Culture never share a view. It is a static web app: nothing is sent anywhere, and a map is one file that Save downloads and Open loads.

## Launch / restart
- The app-server supervisor keeps it running on `http://127.0.0.1:8801`; double-click `Start AltHistoryMap.command` to start it by hand.
- To rebuild the data after editing a scenario source: `python3 build/build_scenarios.py [id ...]`. The base map and glyphs: `python3 build/build_basemap.py`, `python3 build/build_glyphs.py`.
- Tests: `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"`.

## Navigation
```
AltHistoryMap/
├── README.md
├── app-decisions.md
├── wishlist.md
├── Start AltHistoryMap.command
├── serve.py
├── app/                    served as is; deployable on its own
│   ├── index.html · tokens.css · one CSS file per component
│   ├── *.js                model · layers · render · interface · map file · api
│   ├── glyphs.js
│   └── data/
│       ├── basemap.bin
│       ├── LUCIDE-LICENSE.txt
│       └── scenarios/      index.json + nine .ahmap
├── build/
│   ├── build_basemap.py · build_scenarios.py · build_glyphs.py · raster.py · preview_scenario.py
│   ├── scenarios/          polygon sources, one JSON per scenario
│   └── source/             downloaded Natural Earth and Lucide files, SOURCES.md
└── tests/
```

## Cross-app behaviour
Standalone: it reads no other Lukeatron app, store or file. Three Lukeatron files point at it.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `build/` scripts | `app/data/`, `app/glyphs.js` | `basemap.bin` (`AHBASE01` + zlib; bits LAND=1 RIVER=2 LAKE=4 COAST=8), `.ahmap` scenario files (gzip; `AHMAP001` + JSON header + five 4096 x 4096 planes: political, culture, claimA, claimB, border), `index.json` | The Python writer and the JavaScript reader (`mapfile.js`, `api.js`, `model.js`) must stay in step; `test_scenarios.py` decodes Python output with the real reader |
| `build/raster.py` | `app/model.js` | The same Mercator formula, 4096 grid, latitude clamp 85.0511 | Scenarios land in the wrong place |
| `build/build_scenarios.py` | `app/flagcells.js` | Starter flag layouts (ported, compared by a test) | Scenario flags differ from the designer's starters |
| `app/glyphs.js` | `build_scenarios.py`, `mapfile.js`, `symbols.js`, `markers.js` | Glyph ids; `solid` marks a plain shape (filled in the marker's colour) against a Lucide outline on a disc. `build_glyphs.py` writes both kinds | An unknown id is rejected on read and unseen on the map; a shape drawn as an outline |
| `layers.js` | `state.js`, `layerbar.js`, `keys.js`, `render.js`, `markers.js`, `recovery.js` | The allowed views, the look each view or edit layer draws, and which layers' markers show | A saved or typed view the rules reject; a look the renderer has no loop for |
| `model.js` | `render.js`, `mapfile.js`, interface modules | Planes, markers, palette, designs; a marker's `name` is empty when it has no name tag (never for a label) and `tagDx`, `tagDy` are its tag's offset in screen pixels; no stroke or fill writes a river or lake pixel, and `replace` clears them; `onChange` notices `{layer, rect}`, `{markers}`, `{palette}`, `{all}`; `discOffsets` is shared by the brush and its outline | Rendering draws stale pixels; old files stop opening |
| interface modules | `model.js` | Every edit goes through `editor.js`'s `editGate()`, which refuses in View mode | An edit made in View mode |
| `symbols.js`, `flagstrip.js` | `stage.js` | `dragitem.js`: the drag payload type `application/x-althistorymap-item`, a symbol glyph id or a flag design index | A dropped item places nothing |
| `filedrop.js` | `actions.js` | A map file dropped anywhere on the page opens as Open does | The browser navigates to the dropped file |
| `render.js`, `layerimage.js` | the screen | Below 1.5 screen pixels per grid pixel a coarser river overlay is drawn over the layer picture | Rivers vanish when zoomed out |
| `mapfile.js`, `recovery.js` | the browser | Download links, a file picker (started inside the click, before the unsaved-work question), IndexedDB `althistorymap` (store `recovery`, key `current`), `localStorage` key `ahm.prefs` | Save or crash recovery stop working |
| `serve.py` | the browser | Read-only GET and HEAD of `app/` on port 8801 | A write route would need the request gate |
| `System/Apps/ports.json` | `serve.py`, the launcher | Port 8801 | The launcher and the Home tile open a dead address |
| `System/Tools/appservers/appservers.py` | `serve.py` | Starts it, restarts it when a `.py` is newer | The local copy goes down or serves stale code |
| `System/Apps/Home/catalog.json` | `serve.py` | Launch kind `server`, entry `serve.py`, port 8801 | The Home tile fails to open the app |
| the host (any static server) | the browser | The `app/` folder as is | Nothing in `app/` may depend on Lukeatron paths or a Python server |

The base map is rasterised at build time so the browser loads one small file and never parses geometry; scenarios use the map-file format so the app opens one with the one reader it already has. Styling is split across many CSS files that all read the one `tokens.css` (the HouseStyle token layer, the map-ground tokens and four 0-to-1 numbers the looks read); no other file writes a literal colour, size or duration, and the renderer reads its colours from the same tokens.

## Decisions and exceptions
See `app-decisions.md` for what Luke has approved, any decision he explicitly flagged, and any granted Vibe-Coding rule exceptions. Not copied here.
