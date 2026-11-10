# AltHistoryMap · render — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

Every picture of the map: the layer pictures, markers, flags and country names. **Input:** the model, its change notices, a viewport, the theme read from `tokens.css`, and the screen's look settings. **Output:** frames on the canvas, hit-testing of markers, and a PNG of the whole map. **Essential functions:** `createRenderer`, `drawMarkers`, `hitMarker`, `findRegions`, `drawCountryNames` and `flagBlocks`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── render.js
├── layerimage.js
├── markers.js
├── countrylabels.js
└── flagblocks.js
```

## Cross-module behaviour

**Contracts.** The rows are this module's edge.

| From | To | What crosses | What breaks if it changes |
|---|---|---|---|
| `markers.js` | `render.js`, `layerbar.js`, `recovery.js` | `scene.cityColour` (`neutral` or `nation`, set by `renderer.setCityColour`, remembered as `cityColour` in `ahm.prefs`); `nation` reads the political plane under the city, or the commonest paint within two pixels when the city sits on a river or lake. `ZOOM_FADES` in `viewport.js` holds the five zoom levels as fade pairs of `z`, the zoom divided by the fit-to-screen zoom: flags 1.2 to 1.6, country names 2.0 to 2.6, capitals 3.0 to 3.6, any other city (a colony is one) 4.2 to 5.0; fully zoomed out only the country colours show. A symbol shows with the capitals: `symbolAlpha(z)` fades it by the capitals pair and its name tag with it. `cityAlpha(marker, z)`, `symbolAlpha(z)` and `drawFlag` fade by these, a flag's name tag fades with the flag, and `drawMarkers` and `hitMarker` both use them, so a hidden city, symbol or flag cannot be clicked. A colony is a city marker with `colony` true, drawn as a triangle; the Colony tool in `tools.js` (key `O`, straight after City) places one through `editor.js` `place`, and the marker popover's Make city (`markerinfo.js`, `editor.setColony`) clears the flag, after which it is an ordinary city | A city dot that ignores the choice, or stays ink on a river; a city or flag that shows when zoomed out or answers a click while hidden |
| `flagblocks.js` | `markers.js`, `flagstrip.js` | `flagBlocks(design, palette, white)`: the 120 x 80 design shrunk to 24 x 16 averaged colours, cached per design array and palette. A placed flag (36 pixels wide) and a Flags-list thumbnail draw from it; `flagzoom.js` and the designer draw every cell | A flag drawn with thousands of rectangles per frame, or a thumbnail that differs from the placed flag |
| `countrylabels.js` | `render.js` | `findRegions(political, n, representative)` finds, for each separate area of a painted Political colour (four-way connected on a grid of about 1024 samples a side; an area under four samples gets none), the middle of that area's longest horizontal run and the room around it, and marks the colour's largest area (`largest`). `regionSearch` is that search as a generator that yields after each row and slice, and `findRegions` runs it to the end; `render.js` drives `regionSearch` in slices. `representative` is `representativeColours(palette)` from `layerimage.js`, which `render.js` passes so palette colours that look the same are one colour and one name; `render.js` keeps the result (none is drawn until the search ends) until a notice of kind `all`, `palette` or a Political `rect` arrives (the `render.js` frame row says when it is found again), and puts it in the scene as `scene.countryRegions` only when the look is `political` and the choice is on. `drawCountryNames` draws each name (`countryName` from `countrydata.js`, so a blank name shows the colour's own) between the Political picture and the markers, sized to the room, faded in by `ZOOM_FADES.countryName` and left out below 10 screen pixels. A colour's largest area is named from the names level, its other areas only from the capitals level, and a colour with no area big enough gets one `tiny` region at its first pixel, named at the smallest size from single-pixel zoom (`SINGLE_PIXEL_K` in `viewport.js`), so every painted country is named; every name is straight. The choice is `countryNames` in the screen store, set by the button `data-action="country-names"` in `layerbar.js`, passed to the renderer by `renderer.setCountryNames` in `main.js`, and remembered in `ahm.prefs`; it is on by default | A name drawn over rivers or exclaves; a colour's small areas named at world zoom; names that show at world zoom; a choice that is forgotten on reload |
| `render.js`, `layerimage.js` | the screen | `makeSource` builds `shown`, the palette the Political and Province looks read: a country with a `relation` shows its colour mixed toward white by its `RELATIONS` share, and every other look and the palette itself keep the plain colour; `render.js` rebuilds the picture on a `countries` notice. Below 1.5 screen pixels per grid pixel a coarser river overlay is drawn over the layer picture. `makeSource` draws a pixel with the RIVER bit in the river colour and every other water pixel, a lake included, in the sea colour, with COAST pixels in the coast colour | Rivers vanish when zoomed out; a lake drawn in the river colour |
| `render.js` | `layerimage.js` | An `all` notice calls `reset` on the river overview, so rivers of a map's own base map are read again instead of the cached picture of the previous one | Rivers of the old coastline drawn over a new map |
| `render.js` | the browser's frame | A frame costs 16 ms or less (60 frames a second). `scheduleFrame` drops a request while one waits, so there is one frame per animation tick. A paint recolours only the changed rectangle (`dirty`, merged by `unionRect`, uploaded by `layerImage.update`). A whole-plane recolour (`all`, `palette`, `countries` notice or a look change) is not done in one frame: `startRebuild` begins it and each frame calls `stepRebuild(deadline)`, which colours bands of `ROWS_PER_CHECK` rows and uploads just those rows until `FRAME_WORK_MS` (6 ms) of the frame has passed; an edit made meanwhile waits in `dirty` and is painted over the finished picture. Name regions are found on first use and after an `all` or `palette` notice, by `regionSearch` in slices within what is left of `FRAME_WORK_MS`, so a frame that has not finished the search draws no names and asks for another frame; after a Political paint they are found once, `REGIONS_SETTLE_MS` (150 ms) after the last paint notice, and the previous regions stay on screen until then. `exportPng` finishes both at once. `findRegions` takes 600 ms or less on a busy 4096 plane, and no slice of `regionSearch` takes more than 12 ms | Lag in pan, zoom or painting; a search per frame during a stroke; tested by `render.test.js` and `performance.test.js` |
| `countrylabels.js`, `markers.js` | `render.js` frame | The plane is read on a grid of about 1024 samples a side (`SAMPLES_PER_SIDE`). Anything off the stage is skipped before it is measured or drawn: names by 40 pixels (`CULL_MARGIN` in `countrylabels.js`), markers by 120 pixels (`CULL_MARGIN` in `markers.js`). A view too far out for names measures and draws none. `drawCountryNames` measures a name once per context, font and text (`widthPerSizeOf`, at most 1000 kept), and a later frame reuses the width | Text measured for names that are off the stage or not yet shown; tested by `performance.test.js` |
| `layerimage.js`, `render.js` | the canvas | A whole-plane `putImageData` runs only on an `all` or `palette` notice (a map opened, a scenario chosen, a colour changed); a stroke uploads just its clipped rectangle. Opening a map therefore starts the whole-plane recolour, which the `render.js` frame row spreads over frames by bands, and the name-region search comes after it, in slices | A dropped frame at open or scenario switch; a whole-plane upload during a stroke |
| `performance.test.js` | `render.js`, `countrylabels.js`, `markers.js` | The frame budget (16 ms or less) is held by tests on pan, zoom and paint. `render.test.js` opens a full 4096 map through the renderer and fails when it is coloured in one frame, when a frame passes 60 ms, or when the uploaded bands do not cover every row once; `performance.test.js` fails when a `regionSearch` slice passes 12 ms | A slow load that no test catches |

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `BLOCK_COLS` | countryfacts, flagdesigner |
| `BLOCK_ROWS` | countryfacts, flagdesigner |
| `createRenderer` | main |
| `flagBlocks` | flagdesigner |
| `pngFileName` | saving |
| `readTheme` | main, sandbox |
| `shownColourIndex` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| countrydata | `RELATIONS`, `SAME_COLOUR_TOLERANCE`, `countryName` |
| layers | `LOOKS`, `layersDrawn`, `layersOnScreen` |
| model | `COAST`, `FLAG_H`, `FLAG_W`, `LAKE`, `LAND`, `LEGACY_FLAG_SCALE`, `RIVER` |
| viewport | `BUTTON_ZOOM`, `KEY_PAN`, `SINGLE_PIXEL_K`, `ZOOM_FADES`, `brushOutline`, `fadeFactor`, `homeViewport`, `panViewport`, `readoutText`, `resizeViewport`, `screenToGrid`, `zoomViewport` |
