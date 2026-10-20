import test from "node:test";
import assert from "node:assert/strict";
import { findRegions, drawCountryNames } from "../app/countrylabels.js";

const SIDE = 40;

// A plane with colour 1 filling x 5..24, y 5..14 (20 wide, 10 high) and colour 2 a single pixel at (30, 30).
function plane() {
  const political = new Uint8Array(SIDE * SIDE);
  for (let y = 5; y < 15; y++) for (let x = 5; x < 25; x++) political[y * SIDE + x] = 1;
  political[30 * SIDE + 30] = 2;
  return political;
}

// A context that records every text drawn and the size of the font it was drawn at; a character is 0.5 of the font size wide.
function fakeContext() {
  const drawn = [];
  const ctx = {
    font: "",
    measureText: (text) => ({ width: text.length * 0.5 * Number.parseFloat(ctx.font) }),
    strokeText() {},
    fillText: (text, x, y) => drawn.push({ text, x, y, size: Number.parseFloat(ctx.font) }),
  };
  return { ctx, drawn };
}

function sceneOf(political, over = {}) {
  return {
    vp: { x: 0, y: 0, k: 10, kFit: 1 },
    stage: { w: 1000, h: 1000 },
    theme: { font: "serif", css: { land: "#fff", ink: "#000" } },
    palette: ["#d02020", "#2e8b3d"],
    countries: [],
    countryRegions: findRegions(political, SIDE),
    ...over,
  };
}

test("findRegions puts a colour's name in the middle of its longest row, with the room around it", () => {
  const regions = findRegions(plane(), SIDE);
  const one = regions.find((r) => r.colour === 1);
  assert.deepEqual([one.x, one.width, one.height], [15, 20, 10]);
  assert.ok(one.y >= 5 && one.y < 15);
  assert.deepEqual(regions.map((r) => r.colour).sort(), [1, 2], "unpainted ground has no region");
});

test("findRegions follows the longest run when a colour has two pieces", () => {
  const political = new Uint8Array(SIDE * SIDE);
  for (let x = 0; x < 6; x++) political[2 * SIDE + x] = 1;
  for (let x = 10; x < 30; x++) political[20 * SIDE + x] = 1;
  const [region] = findRegions(political, SIDE);
  assert.deepEqual([region.x, region.y, region.width, region.height], [20, 20, 20, 1]);
});

test("a name is drawn over its region, sized to fit the room, using the colour's own name when the country has none", () => {
  const { ctx, drawn } = fakeContext();
  drawCountryNames(ctx, sceneOf(plane()));
  const big = drawn.find((d) => d.text === "Red");
  assert.ok(big, "colour 1 is named for its swatch");
  assert.ok(Math.abs(big.x - 150) < 1, "centred across its 20 pixel run");
  assert.ok(big.size <= 30, "never larger than the maximum");
  assert.ok(big.size <= 0.5 * 10 * 10 + 1e-9, "no taller than half the region");
});

test("a country's own name is drawn instead of the colour's", () => {
  const { ctx, drawn } = fakeContext();
  drawCountryNames(ctx, sceneOf(plane(), { countries: [{ colour: 1, name: "Aurea" }] }));
  assert.deepEqual(drawn.map((d) => d.text), ["Aurea"]);
});

test("a name that would be too small is hidden, and zooming in brings it back", () => {
  const far = fakeContext();
  drawCountryNames(far.ctx, sceneOf(plane(), { vp: { x: 0, y: 0, k: 0.5, kFit: 1 } }));
  assert.deepEqual(far.drawn, [], "a 20 pixel region at half a screen pixel per pixel has no room");
  const near = fakeContext();
  drawCountryNames(near.ctx, sceneOf(plane()));
  assert.deepEqual(near.drawn.map((d) => d.text), ["Red"], "the one pixel region is too small at ten screen pixels per pixel");
  const close = fakeContext();
  drawCountryNames(close.ctx, sceneOf(plane(), { vp: { x: -1000, y: -400, k: 100, kFit: 1 }, stage: { w: 3000, h: 3500 } }));
  assert.deepEqual(close.drawn.map((d) => d.text).sort(), ["Green", "Red"], "at a hundred screen pixels per pixel the single pixel has room");
});

test("a name outside the stage, and a colour the palette lacks, are skipped", () => {
  const off = fakeContext();
  drawCountryNames(off.ctx, sceneOf(plane(), { vp: { x: -5000, y: 0, k: 10, kFit: 1 } }));
  assert.deepEqual(off.drawn, []);
  const missing = fakeContext();
  drawCountryNames(missing.ctx, sceneOf(plane(), { palette: [] }));
  assert.deepEqual(missing.drawn, []);
});
