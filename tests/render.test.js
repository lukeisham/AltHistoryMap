import test from "node:test";
import assert from "node:assert/strict";
import { createModel, LAND, RIVER, LAKE, COAST } from "../app/model.js";
import { createRenderer, pixelColour, clampViewport, fadeFactor, pngFileName } from "../app/render.js";
import { makeSource, parseColour, packColour, readTheme, mixColour, riverScale, riverMask, createRiverOverview } from "../app/layerimage.js";
import { fitScale, homeViewport, zoomViewport, resizeViewport, readoutText, brushOutline } from "../app/viewport.js";
import { markerVisible, cityAlpha, hitMarker, hitTag, drawMarkers, cityDotColour, createGlyphLibrary } from "../app/markers.js";

const SIDE = 16;
const TOKENS = {
  "--map-sea": "#101010",
  "--map-land": "#202020",
  "--map-coast": "#303030",
  "--map-water": "#404040",
  "--border": "#000001",
  "--ink": "#fafafa",
  "--flag-white": "#ffffff",
  "--font-map": "Georgia, serif",
  "--culture-tint": "0.5",
  "--culture-blend": "0.5",
  "--political-fade": "0.5",
};
const SEA = parseColour(TOKENS["--map-sea"]);
const LAND_C = parseColour(TOKENS["--map-land"]);
const COAST_C = parseColour(TOKENS["--map-coast"]);
const WATER_C = parseColour(TOKENS["--map-water"]);
const BORDER_C = parseColour(TOKENS["--border"]);
const WHITE_C = packColour(255, 255, 255);
const BLACK_C = packColour(0, 0, 0);

const fakeStyle = (tokens = TOKENS) => ({ getPropertyValue: (name) => tokens[name] ?? "" });

// A 16 x 16 map: land everywhere except a sea column at x = 8, plus one river pixel at (2, 2),
// one lake pixel at (3, 3), and a coast pixel at (8, 5).
function smallModel() {
  const base = new Uint8Array(SIDE * SIDE).fill(LAND);
  for (let y = 0; y < SIDE; y++) base[y * SIDE + 8] = 0;
  base[2 * SIDE + 2] = LAND | RIVER;
  base[3 * SIDE + 3] = LAKE;
  base[5 * SIDE + 8] = COAST;
  return createModel(base, SIDE);
}

function sourceOf(model) {
  return makeSource(model, readTheme(fakeStyle()));
}

const idx = (x, y) => y * SIDE + x;

test("political: ground, painted colour, and border over paint", () => {
  const m = smallModel();
  m.planes.political[idx(1, 1)] = 2;
  m.planes.political[idx(4, 4)] = 3;
  m.planes.border[idx(4, 4)] = 1;
  const src = sourceOf(m);
  const at = (x, y) => pixelColour("political", src, idx(x, y), x, y);
  assert.equal(at(0, 0), LAND_C);
  assert.equal(at(8, 0), SEA);
  assert.equal(at(8, 5), COAST_C);
  assert.equal(at(2, 2), WATER_C);
  assert.equal(at(3, 3), WATER_C);
  assert.equal(at(1, 1), parseColour(m.palette[1]));
  assert.equal(at(4, 4), BORDER_C);
});

// A 4 x 4 block of land (x 4-7, y 8-11) painted with one province colour.
function provinceBlock(m, colour) {
  for (let y = 8; y < 12; y++) for (let x = 4; x < 8; x++) m.planes.province[idx(x, y)] = colour;
}

test("province: the Political colour, outlined in black where the neighbour is another province", () => {
  const m = smallModel();
  for (let y = 8; y < 12; y++) for (let x = 4; x < 8; x++) m.planes.political[idx(x, y)] = 1;
  provinceBlock(m, 2);
  const src = sourceOf(m);
  const fill = parseColour(m.palette[0]);
  for (let y = 8; y < 12; y++) {
    for (let x = 4; x < 8; x++) {
      const edge = x === 4 || x === 7 || y === 8 || y === 11;
      assert.equal(pixelColour("province", src, idx(x, y), x, y), edge ? BLACK_C : fill, `(${x},${y})`);
    }
  }
  assert.equal(pixelColour("province", src, idx(3, 9), 3, 9), LAND_C, "bare land outside is not outlined");
});

test("province: the province colour is not drawn; the Political colour and borders show through", () => {
  const m = smallModel();
  provinceBlock(m, 2);
  m.planes.political[idx(5, 9)] = 3;
  m.planes.political[idx(6, 9)] = 1;
  m.planes.border[idx(6, 10)] = 1;
  const src = sourceOf(m);
  assert.equal(pixelColour("province", src, idx(5, 9), 5, 9), parseColour(m.palette[2]), "Political colour inside the block");
  assert.equal(pixelColour("province", src, idx(6, 9), 6, 9), parseColour(m.palette[0]));
  assert.equal(pixelColour("province", src, idx(6, 10), 6, 10), BORDER_C, "a Political border shows");
  assert.equal(pixelColour("province", src, idx(4, 8), 4, 8), BLACK_C, "the outline wins at the block's edge");
  assert.equal(pixelColour("province", src, idx(0, 0), 0, 0), pixelColour("political", src, idx(0, 0), 0, 0));
});

test("province: two neighbouring provinces share a black line; the map edge is not an outline", () => {
  const m = smallModel();
  for (const x of [1, 2, 3]) m.planes.province[idx(x, 1)] = 1;
  m.planes.province[idx(2, 2)] = 1;
  m.planes.province[idx(2, 3)] = 1;
  m.planes.province[idx(4, 1)] = 2;
  const src = sourceOf(m);
  assert.equal(pixelColour("province", src, idx(3, 1), 3, 1), BLACK_C, "next to another province");
  assert.equal(pixelColour("province", src, idx(4, 1), 4, 1), BLACK_C);
  const c = smallModel();
  for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x++) c.planes.province[idx(x, y)] = 1;
  assert.equal(pixelColour("province", sourceOf(c), idx(0, 0), 0, 0), pixelColour("political", sourceOf(c), idx(0, 0), 0, 0));
});

test("culture: a solid pale tint of the culture colour, ground elsewhere", () => {
  const m = smallModel();
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) m.planes.culture[idx(x, y)] = 4;
  const src = sourceOf(m);
  const tint = mixColour(parseColour(m.palette[3]), WHITE_C, 0.5);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) assert.equal(pixelColour("culture", src, idx(x, y), x, y), tint);
  assert.equal(pixelColour("culture", src, idx(7, 7), 7, 7), LAND_C);
});

test("only the layers on screen show: political paint and provinces are absent on culture", () => {
  const m = smallModel();
  m.planes.political[idx(1, 1)] = 2;
  m.planes.province[idx(1, 3)] = 1;
  const src = sourceOf(m);
  assert.equal(pixelColour("culture", src, idx(1, 1), 1, 1), LAND_C);
  assert.equal(pixelColour("culture", src, idx(1, 3), 1, 3), LAND_C, "a province pixel is invisible on Culture");
  assert.equal(pixelColour("political", src, idx(1, 3), 1, 3), LAND_C, "and on Political");
});

test("editCulture: political faded toward the land, culture laid over it", () => {
  const m = smallModel();
  m.planes.political[idx(1, 1)] = 2;
  m.planes.political[idx(2, 1)] = 2;
  m.planes.border[idx(3, 1)] = 1;
  m.planes.culture[idx(2, 1)] = 4;
  m.planes.culture[idx(5, 5)] = 4;
  const src = sourceOf(m);
  const fadedFill = mixColour(LAND_C, parseColour(m.palette[1]), 0.5);
  const culture = parseColour(m.palette[3]);
  assert.equal(pixelColour("editCulture", src, idx(1, 1), 1, 1), fadedFill);
  assert.equal(pixelColour("editCulture", src, idx(3, 1), 3, 1), mixColour(LAND_C, BORDER_C, 0.5));
  assert.equal(pixelColour("editCulture", src, idx(2, 1), 2, 1), mixColour(fadedFill, culture, 0.5));
  assert.equal(pixelColour("editCulture", src, idx(5, 5), 5, 5), mixColour(LAND_C, culture, 0.5));
  assert.equal(pixelColour("editCulture", src, idx(0, 0), 0, 0), LAND_C);
});

test("colours parse and a missing token warns and falls back", () => {
  assert.equal(parseColour("#fff"), packColour(255, 255, 255));
  assert.equal(parseColour("rgb(1, 2, 3)"), packColour(1, 2, 3));
  assert.equal(parseColour("oklch(0.5 0.1 20)"), null);
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const theme = readTheme(fakeStyle({ ...TOKENS, "--map-sea": "", "--font-map": "" }));
    assert.equal(theme.packed.sea, 0xff808080);
    assert.equal(theme.font, "serif");
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /--map-sea/);
});

test("look numbers are read from tokens; a missing or out-of-range one warns and becomes one half", () => {
  assert.equal(readTheme(fakeStyle({ ...TOKENS, "--culture-tint": "0.25" })).numbers.cultureTint, 0.25);
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const theme = readTheme(fakeStyle({ ...TOKENS, "--culture-blend": "", "--political-fade": "2" }));
    assert.equal(theme.numbers.cultureBlend, 0.5);
    assert.equal(theme.numbers.politicalFade, 0.5);
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 2);
});

test("clampViewport: centres a small world, pins a large one, limits zoom", () => {
  const n = 4096;
  const wide = { w: 1000, h: 600 };
  const fit = fitScale(wide, n);
  assert.equal(fit, 600 / n);
  const home = homeViewport(wide, n);
  assert.equal(home.k, fit);
  assert.ok(Math.abs(home.x - (1000 - 600) / 2) < 1e-9 && Math.abs(home.y) < 1e-9);

  assert.equal(clampViewport({ x: 0, y: 0, k: 0.001 }, wide, n).k, fit);
  assert.equal(clampViewport({ x: 0, y: 0, k: 400 }, wide, n).k, 40);

  const zoomed = clampViewport({ x: 500, y: 500, k: 2 }, wide, n);
  assert.equal(zoomed.x, 0);
  assert.equal(zoomed.y, 0);
  const far = clampViewport({ x: -1e9, y: -1e9, k: 2 }, wide, n);
  assert.equal(far.x, 1000 - n * 2);
  assert.equal(far.y, 600 - n * 2);
});

test("zoomViewport keeps the point under the pointer; resize keeps the centre", () => {
  const n = 4096;
  const stage = { w: 800, h: 800 };
  const start = clampViewport({ x: -3000, y: -2000, k: 4 }, stage, n);
  const grid = { x: (300 - start.x) / start.k, y: (200 - start.y) / start.k };
  const after = zoomViewport(start, 2, 300, 200, stage, n);
  assert.equal(after.k, 8);
  assert.ok(Math.abs(300 - (after.x + grid.x * after.k)) < 1e-9);
  assert.ok(Math.abs(200 - (after.y + grid.y * after.k)) < 1e-9);

  const bigger = { w: 1200, h: 900 };
  const resized = resizeViewport(after, stage, bigger, n);
  const before = { x: (400 - after.x) / after.k, y: (400 - after.y) / after.k };
  assert.ok(Math.abs(before.x - (600 - resized.x) / resized.k) < 1e-9);
  assert.ok(Math.abs(before.y - (450 - resized.y) / resized.k) < 1e-9);

  const home = homeViewport(stage, n);
  assert.equal(resizeViewport(home, stage, bigger, n).k, fitScale(bigger, n));
});

test("fadeFactor ramps from 0 to 1 between its bounds", () => {
  assert.equal(fadeFactor(1, 1.4, 2.6), 0);
  assert.equal(fadeFactor(2, 1.4, 2.6), 0.5);
  assert.equal(fadeFactor(9, 1.4, 2.6), 1);
});

test("pngFileName strips path characters and names the layers on screen", () => {
  assert.equal(pngFileName("Roman Empire AD 117", "province"), "Roman Empire AD 117-province.png");
  assert.equal(pngFileName("Rome", "editCulture"), "Rome-culture.png");
  assert.equal(pngFileName('a/b:c*"d', "culture"), "abcd-culture.png");
  assert.equal(pngFileName("  ", "political"), "map-political.png");
});

test("readoutText formats position and zoom", () => {
  const vp = { k: 2.4 * 0.5, kFit: 0.5 };
  const { coord, zoom } = readoutText({ x: 2150, y: 1170 }, vp, 4096);
  assert.match(coord, /^\d+\.\dN \d+\.\dE {2}x 2150, y 1170$/);
  assert.equal(zoom, "2.4x");
  assert.equal(readoutText(null, { k: 20, kFit: 0.5 }, 4096).coord, "—");
  assert.equal(readoutText(null, { k: 20, kFit: 0.5 }, 4096).zoom, "single pixels");
});

test("brushOutline traces the painted cells", () => {
  assert.equal(brushOutline(1).length, 4);
  assert.equal(brushOutline(3).length, 12);
});

test("markers show with their own layer on screen; the hit test uses the same rule and distance", () => {
  const city = { id: 1, type: "city", x: 10, y: 10, layer: "political" };
  const symbol = { id: 2, type: "symbol", x: 10, y: 10, layer: "culture" };
  assert.equal(markerVisible(city, ["political"]), true);
  assert.equal(markerVisible(city, ["province"]), false);
  assert.equal(markerVisible(symbol, ["culture"]), true);
  assert.equal(markerVisible(symbol, ["political"]), false);

  const vp = { x: 0, y: 0, k: 10, kFit: 1 };
  assert.equal(hitMarker([city, symbol], ["political"], vp, 105, 105)?.id, 1);
  assert.equal(hitMarker([city, symbol], ["culture"], vp, 105, 105)?.id, 2);
  assert.equal(hitMarker([city, symbol], ["political"], vp, 105 + 15, 105), null);
});

test("zoom bands: fully out shows no city, a little in shows capitals, further in shows every city", () => {
  const capital = { type: "city", capital: true };
  const town = { type: "city" };
  assert.equal(cityAlpha(capital, 1), 0);
  assert.equal(cityAlpha(town, 1), 0);
  assert.equal(cityAlpha(capital, 2), 1);
  assert.equal(cityAlpha(town, 2), 0);
  assert.equal(cityAlpha(town, 3.4), 1);

  const placed = { id: 1, type: "city", x: 10, y: 10, layer: "political" };
  const out = { x: 0, y: 0, k: 1, kFit: 1 };
  assert.equal(hitMarker([placed], ["political"], out, 10, 10), null);
});

// ---- createRenderer against hand-built fakes ----

function fakeContext(log) {
  const state = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  };
  return new Proxy(state, {
    get: (target, prop) => (prop in target ? target[prop] : (...args) => log.push([prop, ...args])),
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  });
}

function installFakes() {
  const saved = {};
  const set = (name, value) => {
    saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  };
  const frames = [];
  const offscreen = [];
  const observers = [];
  set("requestAnimationFrame", (fn) => frames.push(fn));
  set("cancelAnimationFrame", () => frames.splice(0));
  set("getComputedStyle", () => fakeStyle());
  set("devicePixelRatio", 2);
  set("Path2D", class {});
  set(
    "ResizeObserver",
    class {
      constructor(fn) {
        this.fn = fn;
        observers.push(this);
      }
      observe() {}
      disconnect() {}
    },
  );
  set(
    "OffscreenCanvas",
    class {
      constructor(width, height) {
        this.width = width;
        this.height = height;
        this.log = [];
        this.ctx = fakeContext(this.log);
        offscreen.push(this);
      }
      getContext() {
        return this.ctx;
      }
      convertToBlob({ type }) {
        return Promise.resolve({ type, size: this.width * this.height });
      }
    },
  );
  return {
    frames,
    offscreen,
    observers,
    flush() {
      while (frames.length) frames.shift()();
    },
    restore() {
      for (const [name, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

function fakeCanvas(width, height) {
  const log = [];
  const handlers = new Map();
  return {
    log,
    handlers,
    width: 0,
    height: 0,
    style: {},
    parentElement: { clientWidth: width, clientHeight: height },
    getContext: () => fakeContext(log),
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener: (type, fn) => handlers.set(type, fn),
    removeEventListener: (type) => handlers.delete(type),
  };
}

test("createRenderer draws, follows model changes, zooms and exports", async () => {
  const fakes = installFakes();
  try {
    const model = smallModel();
    const canvas = fakeCanvas(160, 160);
    const renderer = createRenderer({ canvas, model, glyphs: [] });
    const layerLog = fakes.offscreen[0].log;

    assert.equal(canvas.width, 320);
    assert.equal(renderer.viewport.k, renderer.viewport.kFit);
    assert.equal(renderer.viewport.kFit, 10);
    fakes.flush();
    assert.equal(layerLog.filter(([name]) => name === "putImageData").length, 1);
    assert.equal(canvas.log.some(([name]) => name === "drawImage"), true);
    assert.equal(canvas.log.some(([name]) => name === "stroke"), false, "no grid below 14 screen pixels per grid pixel");

    canvas.log.length = 0;
    layerLog.length = 0;
    model.beginStroke({ tool: "paint", layer: "political", colour: 1, size: 1 });
    model.strokeTo(2, 3);
    model.endStroke();
    assert.equal(fakes.frames.length, 1, "a model change schedules exactly one frame");
    fakes.flush();
    const put = layerLog.filter(([name]) => name === "putImageData");
    assert.equal(put.length, 1);
    assert.deepEqual(put[0].slice(4), [2, 3, 1, 1], "only the edited rectangle is uploaded");
    assert.equal(canvas.log.some(([name]) => name === "drawImage"), true);

    layerLog.length = 0;
    model.beginStroke({ tool: "paint", layer: "political", colour: 1, size: 1 });
    model.strokeTo(6, 6);
    fakes.flush();
    assert.equal(layerLog.filter(([name]) => name === "putImageData").length, 1, "a stroke shows its colour before it ends");
    model.endStroke();
    fakes.flush();

    layerLog.length = 0;
    renderer.setLook("province");
    fakes.flush();
    layerLog.length = 0;
    model.beginStroke({ tool: "paint", layer: "province", colour: 1, size: 1 });
    model.strokeTo(5, 6);
    model.endStroke();
    fakes.flush();
    assert.deepEqual(layerLog.filter(([name]) => name === "putImageData")[0].slice(4), [4, 5, 3, 3], "a province edit repaints its neighbours' outlines");

    layerLog.length = 0;
    renderer.setLook("culture");
    fakes.flush();
    assert.equal(renderer.getLook(), "culture");
    assert.equal(layerLog.find(([name]) => name === "putImageData").length, 4, "a look change repaints the whole picture");

    layerLog.length = 0;
    model.beginStroke({ tool: "paint", layer: "political", colour: 1, size: 1 });
    model.strokeTo(4, 4);
    model.endStroke();
    fakes.flush();
    assert.equal(layerLog.filter(([name]) => name === "putImageData").length, 0, "a political edit does not touch the culture look");

    renderer.setLook("editCulture");
    fakes.flush();
    layerLog.length = 0;
    model.beginStroke({ tool: "paint", layer: "political", colour: 2, size: 1 });
    model.strokeTo(5, 5);
    model.endStroke();
    fakes.flush();
    assert.equal(layerLog.filter(([name]) => name === "putImageData").length, 1, "Political shows through editCulture, so its edits repaint");

    const before = renderer.viewport;
    renderer.zoomAt(2, 100, 100);
    assert.equal(renderer.viewport.k, before.k * 2);
    assert.deepEqual(renderer.toGrid(100, 100).inside, true);
    renderer.zoomHome();
    assert.equal(renderer.viewport.k, renderer.viewport.kFit);

    let prevented = false;
    canvas.handlers.get("wheel")({ preventDefault: () => (prevented = true), deltaY: -100, deltaMode: 0, ctrlKey: false, clientX: 80, clientY: 80 });
    assert.equal(prevented, true);
    assert.ok(renderer.viewport.k > renderer.viewport.kFit);

    const blob = await renderer.exportPng();
    assert.equal(blob.type, "image/png");
    assert.equal(blob.size, 320 * 320);
    const exportLog = fakes.offscreen.at(-1).log;
    assert.equal(exportLog.some(([name]) => name === "drawImage"), true);
    assert.equal(exportLog.some(([name]) => name === "stroke"), false, "export has no grid or outlines");

    renderer.destroy();
    assert.equal(canvas.handlers.size, 0);
  } finally {
    fakes.restore();
  }
});

test("each look draws only the markers of its layers, with names fading in on zoom", () => {
  const fakes = installFakes();
  try {
    const model = smallModel();
    model.addMarker({ type: "city", x: 2, y: 2, name: "Rome", colour: 1 });
    model.addMarker({ type: "flag", x: 4, y: 4, name: "Flag", colour: 2 });
    model.addMarker({ type: "symbol", x: 6, y: 6, name: "Crown", colour: 3, glyph: "star", layer: "culture" });
    const canvas = fakeCanvas(160, 160);
    const renderer = createRenderer({ canvas, model, glyphs: [{ id: "star", label: "Star", path: "M0 0" }] });
    fakes.flush();
    const names = () => canvas.log.filter(([n]) => n === "fillText").map(([, text]) => text);
    const count = (name) => canvas.log.filter(([n]) => n === name).length;

    assert.equal(count("arc"), 0, "no city dot at world view");
    assert.deepEqual(names(), [], "names are hidden at world view");
    assert.equal(count("stroke"), 1, "flag pole only; no city, no symbol on Political");

    canvas.log.length = 0;
    renderer.zoomAt(6, 10, 10);
    fakes.flush();
    assert.deepEqual(names().sort(), ["Flag", "Rome"].sort(), "city and flag names appear once zoomed in");

    canvas.log.length = 0;
    renderer.setLook("culture");
    fakes.flush();
    assert.equal(count("fillRect"), 1, "only the sea fill: no flag cloth on Culture");
    assert.equal(count("stroke") >= 2, true, "the symbol disc ring and its glyph");
    assert.equal(renderer.hitTest(0, 0), null);
    renderer.destroy();
  } finally {
    fakes.restore();
  }
});

// ---- shapes, name tags, rivers ----

function recordingContext() {
  const log = [];
  const ctx = new Proxy({}, {
    get: (target, prop) => (prop in target ? target[prop] : (...args) => log.push([prop, ...args])),
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  });
  return { ctx, log };
}

function markerScene(markers, extra = {}) {
  return {
    layers: ["political"],
    vp: { x: 0, y: 0, k: 40, kFit: 1 },
    stage: { w: 800, h: 800 },
    markers,
    designs: [],
    palette: ["#ff0000"],
    theme: readTheme(fakeStyle()),
    glyphs: createGlyphLibrary([
      { id: "shape-square", label: "Square", path: "M0 0", solid: true },
      { id: "star", label: "Star", path: "M0 0" },
    ]),
    ...extra,
  };
}

const withPath2D = (run) => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "Path2D");
  globalThis.Path2D = class {};
  try {
    run();
  } finally {
    if (saved) Object.defineProperty(globalThis, "Path2D", saved);
    else delete globalThis.Path2D;
  }
};

test("a solid shape is filled in the marker colour with no disc; an outline symbol keeps its disc", () => {
  withPath2D(() => {
    const shape = { id: 1, type: "symbol", x: 2, y: 2, name: "", colour: 1, glyph: "shape-square", layer: "political", tagDx: 0, tagDy: 0 };
    const disc = { ...shape, id: 2, x: 6, glyph: "star" };
    const drawn = recordingContext();
    drawMarkers(drawn.ctx, markerScene([shape]));
    assert.equal(drawn.log.filter(([name]) => name === "fill").length, 1);
    assert.equal(drawn.log.filter(([name]) => name === "arc").length, 0, "no disc behind a shape");
    const discDrawn = recordingContext();
    drawMarkers(discDrawn.ctx, markerScene([disc]));
    assert.equal(discDrawn.log.filter(([name]) => name === "arc").length, 1);
  });
});

test("a colony is a triangle with the city dot, and a capital is still a bullseye", () => {
  const colony = { id: 1, type: "city", x: 2, y: 2, name: "", colour: 1, tagDx: 0, tagDy: 0, layer: "political", colony: true };
  const drawn = recordingContext();
  drawMarkers(drawn.ctx, markerScene([colony]));
  assert.equal(drawn.log.filter(([name]) => name === "lineTo").length, 2, "a triangle: one moveTo and two lineTo");
  assert.equal(drawn.log.filter(([name]) => name === "arc").length, 1, "only the centre dot");
  const capital = recordingContext();
  drawMarkers(capital.ctx, markerScene([{ ...colony, colony: false, capital: true }]));
  assert.equal(capital.log.filter(([name]) => name === "lineTo").length, 0);
});

test("a city is a bullseye: an ink ring on a pale centre with an ink dot, whatever its stored colour", () => {
  withPath2D(() => {
    const theme = readTheme(fakeStyle());
    const city = { id: 1, type: "city", x: 2, y: 2, name: "", colour: 1, tagDx: 0, tagDy: 0, layer: "political" };
    const drawn = recordingContext();
    drawMarkers(drawn.ctx, markerScene([city]));
    const arcs = drawn.log.filter(([name]) => name === "arc");
    assert.deepEqual(arcs.map((a) => a[3]), [6, 2.6], "ring then dot");
    assert.equal(drawn.ctx.fillStyle, theme.css.ink, "the dot is ink and never the stored colour");
    assert.equal(drawn.ctx.strokeStyle, theme.css.ink);
  });
});

test("cityDotColour: ink by default, the political colour under the city when matching the nation, ink on unclaimed land", () => {
  const theme = readTheme(fakeStyle());
  const political = new Uint8Array(SIDE * SIDE);
  political[idx(3, 4)] = 2;
  const scene = { theme, palette: ["#ff0000", "#00ff00"], political, n: SIDE };
  const at = (x, y) => ({ x, y });
  assert.equal(cityDotColour({ ...scene, cityColour: "neutral" }, at(3, 4)), theme.css.ink);
  assert.equal(cityDotColour(scene, at(3, 4)), theme.css.ink, "no choice made is neutral");
  assert.equal(cityDotColour({ ...scene, cityColour: "nation" }, at(3, 4)), "#00ff00");
  assert.equal(cityDotColour({ ...scene, cityColour: "nation" }, at(12, 12)), theme.css.ink, "no paint within reach");
  assert.equal(cityDotColour({ ...scene, cityColour: "nation" }, at(4, 4)), "#00ff00", "a river pixel takes the paint beside it");
  political[idx(5, 4)] = 1;
  political[idx(5, 5)] = 1;
  assert.equal(cityDotColour({ ...scene, cityColour: "nation" }, at(4, 4)), "#ff0000", "the commonest neighbour wins, nearest ring first");
  assert.equal(cityDotColour({ ...scene, cityColour: "nation" }, at(0, 0)), theme.css.ink, "a corner with no paint near");
  assert.doesNotThrow(() => cityDotColour({ ...scene, cityColour: "nation" }, at(SIDE - 1, SIDE - 1)), "the map edge");
  political[idx(1, 1)] = 9;
  assert.equal(cityDotColour({ ...scene, cityColour: "nation" }, at(1, 1)), theme.css.ink, "a colour the palette lacks");
});

test("a name tag is drawn at its offset, and a marker with no name draws no tag", () => {
  withPath2D(() => {
    const base = { type: "city", x: 2, y: 2, colour: 1, glyph: "", design: -1, layer: "political" };
    const named = { ...base, id: 1, name: "Roma", tagDx: 15, tagDy: -6 };
    const plain = { ...base, id: 2, x: 8, name: "", tagDx: 0, tagDy: 0 };
    const drawn = recordingContext();
    drawMarkers(drawn.ctx, markerScene([named, plain]));
    const texts = drawn.log.filter(([name]) => name === "fillText");
    assert.equal(texts.length, 1);
    const sx = 2.5 * 40;
    assert.deepEqual(texts[0].slice(1), ["Roma", sx + 6 + 4 + 15, sx - 6]);
  });
});

test("a marker being dragged is drawn at its preview position", () => {
  withPath2D(() => {
    const city = { id: 1, type: "city", x: 2, y: 2, name: "", colour: 1, tagDx: 0, tagDy: 0 };
    const drawn = recordingContext();
    drawMarkers(drawn.ctx, markerScene([city], { preview: { id: 1, x: 5, y: 6 } }));
    const arc = drawn.log.find(([name]) => name === "arc");
    assert.deepEqual(arc.slice(1, 3), [5.5 * 40, 6.5 * 40]);
  });
});

test("hitTag finds the tag under a point, honours the offset, and ignores tags that are not showing", () => {
  const city = { id: 1, type: "city", x: 2, y: 2, name: "Roma", tagDx: 0, tagDy: 0, layer: "political" };
  const moved = { ...city, id: 2, tagDx: 100, tagDy: 30 };
  const label = { id: 3, type: "label", x: 2, y: 2, name: "Sea", tagDx: 0, tagDy: 0, layer: "political" };
  const measure = () => 50;
  const vp = { x: 0, y: 0, k: 40, kFit: 1 };
  const y = 2.5 * 40;
  assert.equal(hitTag([city, label], ["political"], vp, 130, y, measure)?.id, 1);
  assert.equal(hitTag([city, label], ["political"], vp, 200, y, measure), null);
  assert.equal(hitTag([moved], ["political"], vp, 230, y + 30, measure)?.id, 2);
  assert.equal(hitTag([city], ["province"], vp, 130, y, measure), null, "a hidden layer's tags cannot be grabbed");
  assert.equal(hitTag([city], ["political"], { ...vp, k: 1 }, 130, y, measure), null, "a tag that has faded out cannot be grabbed");
});

test("river overview: the level follows the zoom, a block holds any river pixel, and a level repaints only when its colour changes", () => {
  assert.equal(riverScale(2), 1);
  assert.equal(riverScale(1), 2);
  assert.equal(riverScale(0.5), 4);
  assert.equal(riverScale(0.15), 8);

  const base = new Uint8Array(SIDE * SIDE).fill(LAND);
  base[5 * SIDE + 6] = LAND | RIVER;
  const mask = riverMask(base, SIDE, 4);
  assert.equal(mask.length, 16);
  assert.deepEqual([...mask].map((v, i) => (v ? i : -1)).filter((i) => i >= 0), [1 * 4 + 1]);

  const fakes = installFakes();
  try {
    const overview = createRiverOverview(SIDE, base);
    assert.equal(overview.levelFor(2, WATER_C), null);
    const level = overview.levelFor(0.5, WATER_C);
    assert.equal(level.scale, 4);
    assert.equal(level.canvas.width, 4);
    const puts = () => fakes.offscreen[0].log.filter(([name]) => name === "putImageData").length;
    assert.equal(puts(), 1);
    overview.levelFor(0.5, WATER_C);
    assert.equal(puts(), 1);
    overview.levelFor(0.5, SEA);
    assert.equal(puts(), 2);
  } finally {
    fakes.restore();
  }
});

test("zoomed out, the frame draws the river overview over the layer picture", () => {
  const fakes = installFakes();
  try {
    const model = smallModel();
    const canvas = fakeCanvas(SIDE, SIDE);
    createRenderer({ canvas, model, glyphs: [] });
    fakes.flush();
    assert.equal(canvas.log.filter(([name]) => name === "drawImage").length, 2, "layer picture and river overview");

    const wide = fakeCanvas(160, 160);
    createRenderer({ canvas: wide, model, glyphs: [] });
    fakes.flush();
    assert.equal(wide.log.filter(([name]) => name === "drawImage").length, 1, "wide enough that a river pixel is already visible");
  } finally {
    fakes.restore();
  }
});
