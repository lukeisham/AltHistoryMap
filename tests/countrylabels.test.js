import test from "node:test";
import assert from "node:assert/strict";
import { findRegions, drawCountryNames } from "../app/countrylabels.js";

const SIDE = 40;

// A plane with colour 1 filling x 5..24, y 5..14 (20 wide, 10 high), colour 2 a 2 x 2 patch at (30, 30) and a stray pixel of colour 1 at (35, 35).
function plane() {
  const political = new Uint8Array(SIDE * SIDE);
  for (let y = 5; y < 15; y++) for (let x = 5; x < 25; x++) political[y * SIDE + x] = 1;
  for (let y = 30; y < 32; y++) for (let x = 30; x < 32; x++) political[y * SIDE + x] = 2;
  political[35 * SIDE + 35] = 1;
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
  assert.deepEqual(regions.map((r) => r.colour).sort(), [1, 2], "unpainted ground has no region, and a stray pixel gets none");
});

test("findRegions gives a colour in two separate areas one region in each, sized to its own area", () => {
  const political = new Uint8Array(SIDE * SIDE);
  for (let x = 0; x < 6; x++) political[2 * SIDE + x] = 1;
  for (let x = 10; x < 30; x++) political[20 * SIDE + x] = 1;
  const regions = findRegions(political, SIDE).map((r) => [r.colour, r.x, r.y, r.width, r.height]);
  assert.deepEqual(regions, [[1, 3, 2, 6, 1], [1, 20, 20, 20, 1]]);
});

test("findRegions joins areas only side to side: a diagonal touch is two areas, a column joining two blocks is one", () => {
  const diagonal = new Uint8Array(SIDE * SIDE);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) diagonal[y * SIDE + x] = 1;
  for (let y = 3; y < 6; y++) for (let x = 3; x < 6; x++) diagonal[y * SIDE + x] = 1;
  assert.equal(findRegions(diagonal, SIDE).length, 2);
  const joined = new Uint8Array(SIDE * SIDE);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) joined[y * SIDE + x] = 1;
  for (let y = 3; y < 8; y++) joined[y * SIDE + 1] = 1;
  for (let y = 8; y < 11; y++) for (let x = 0; x < 3; x++) joined[y * SIDE + x] = 1;
  assert.equal(findRegions(joined, SIDE).length, 1);
});

test("findRegions names palette colours that look the same once, as the first of them", () => {
  const political = new Uint8Array(SIDE * SIDE);
  for (let y = 5; y < 10; y++) {
    for (let x = 5; x < 10; x++) political[y * SIDE + x] = 1;
    for (let x = 10; x < 15; x++) political[y * SIDE + x] = 2;
  }
  const representative = Uint8Array.from({ length: 256 }, (_, i) => (i === 2 ? 1 : i));
  assert.deepEqual(findRegions(political, SIDE).map((r) => r.colour).sort(), [1, 2]);
  const merged = findRegions(political, SIDE, representative);
  assert.deepEqual(merged.map((r) => [r.colour, r.width]), [[1, 10]]);
});

test("a colour with two separate areas has its name drawn in both, and in only one when it has one area", () => {
  const split = new Uint8Array(SIDE * SIDE);
  for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) split[y * SIDE + x] = 1;
  for (let y = 20; y < 30; y++) for (let x = 20; x < 36; x++) split[y * SIDE + x] = 1;
  const two = fakeContext();
  drawCountryNames(two.ctx, sceneOf(split, { vp: { x: 0, y: 0, k: 4, kFit: 1 } }));
  assert.deepEqual(two.drawn.map((d) => d.text), ["Red", "Red"]);
  assert.ok(two.drawn[1].size > two.drawn[0].size, "the larger area gets the larger name");
  const one = fakeContext();
  drawCountryNames(one.ctx, sceneOf(plane()));
  assert.equal(one.drawn.filter((d) => d.text === "Red").length, 1);
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
