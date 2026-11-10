# AltHistoryMap — Guide

For AI agents. People start at `README.md`. Each module has its own guide, listed in `modules.json`.

## Purpose

A zoomable Mercator world map for building alternative histories, with a flag designer and a crest maker. It is a static site played online or run locally with `serve.py`, and it reads no other Lukeatron app, store or file. **Input:** people create imaginary maps, flags and crests, start from a ready-made scenario map, or paint a new base map from scratch in the Sandbox. **Output:** saved maps, each one file holding paint, markers, flags, crests and countries (and its own base map, if made in the Sandbox), and flags and crests as PNG. **Essential functions:** painting territory in three layers (Political, Province, Culture); markers shown by zoom level; country names over their land; countries with key facts and relationships; crash recovery of unsaved work. A frame costs 16 milliseconds or less.

## Contents

1. [Navigation](#navigation)
2. [Cross-app behaviour](#cross-app-behaviour)

## Navigation

```
AltHistoryMap/
├── GUIDE.md · README.md · app-decisions.md · issues.md · modules.json
├── guides/                 one guide per module; modules.json lists them
├── plans/                  plan documents for changes to the app
├── Start AltHistoryMap.command
├── serve.py                module server, with the launcher above
├── app/                    served as is; deployable on its own; flat, with each file in one module
│   ├── data/               basemap.bin · LUCIDE-LICENSE.txt · scenarios/ (index.json + one .ahmap per listed scenario)
│   ├── map state           model · countrydata · crestcells · flagcells · mapfile
│   ├── drawing             render · viewport · layers
│   ├── designers           crestmaker · flagdesigner · sandbox · pngexport · dialogs
│   ├── countries           countryfacts · relations
│   ├── interface           controls · editor · stage · palette · dragitem
│   ├── files and start-up  loading · scenarios · saving · main · style
│   └── glyphs.js           in module editor; written by build/build_glyphs.py
├── build/                  build module: build_basemap.py · build_scenarios.py · build_glyphs.py · raster.py · preview_scenario.py
│   ├── scenarios/          polygon sources, one JSON per scenario
│   └── source/             downloaded Natural Earth and Lucide files, SOURCES.md
└── tests/                  JavaScript and Python tests; fixtures/ holds saved maps from earlier versions that compat.test.js opens
```

## Cross-app behaviour

Three Lukeatron files point at the app (`System/Apps/ports.json`, `System/Apps/Home/catalog.json`, `System/Tools/appservers/appservers.py`); the app points at none of them. The rows below are the app's edge; every row about one module's edge is in that module's guide.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `serve.py` | the browser | Read-only GET and HEAD of `app/` on 127.0.0.1 (port 8801, or the next free one when run in a terminal); local Host header only; a strict Content-Security-Policy; ETag revalidation. Run without a terminal it opens no browser and keeps exactly 8801. `--port N` and `--no-browser` are its only options | A write route would need the request gate; an inline script or a remote file in `app/` is blocked by the policy |
| `Start AltHistoryMap.command` | `serve.py` | Runs `serve.py` from the app folder | The launcher opens nothing |
| `System/Apps/ports.json` | `serve.py`, the launcher | Port 8801 | The launcher and the Home tile open a dead address |
| `System/Tools/appservers/appservers.py` | `serve.py` | Starts it, restarts it when a `.py` is newer | The local copy goes down or serves stale code |
| `System/Apps/Home/catalog.json` | `serve.py` | Launch kind `server`, entry `serve.py`, port 8801 | The Home tile fails to open the app |
| the public repo `lukeisham/AltHistoryMap` | GitHub Pages at `https://lukeisham.github.io/AltHistoryMap/`, and Cloudflare Pages at `https://althistorymap.pages.dev/app/` | A root `index.html` and `.nojekyll`; the site is served from a sub-path, so every URL in `app/` is relative (`data/basemap.bin`, `data/scenarios/`) and none begins with `/` | A root-absolute URL loads nothing on the live site; anything in `app/` that needs Lukeatron paths or a Python server fails there |
| `.github/workflows/publish-althistorymap.yml` | the public repo `lukeisham/AltHistoryMap` | On each push to `main` that changes `System/Apps/AltHistoryMap/`, it runs both test suites, then mirrors the folder into the public repo with the Actions secret `PUBLIC_REPO_TOKEN` (a fine-grained token with Contents write on that repo only). It leaves `issues.md` (private) out and keeps `index.html` and `.nojekyll` (public only). GitHub Pages and Cloudflare Pages (`https://althistorymap.pages.dev/app/`) rebuild from that commit | A missing or expired secret fails the run and the public copy goes stale; a failing test blocks publishing |

Tests run with `node --test tests/*.test.js` and `python3 -m unittest discover -s tests -p "test_*.py"`.
