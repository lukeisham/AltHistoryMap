import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createModel, LAND, N, PLANE_NAMES } from "../app/model.js";
import { encodeMap, decodeMap, asScenarioCopy, MapFileError, MAGIC } from "../app/mapfile.js";

const GLYPHS = ["sword", "crown"];
const sameBytes = (a, b) => Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.length), Buffer.from(b.buffer, b.byteOffset, b.length)) === 0;

function fullModel() {
  return createModel(new Uint8Array(N * N).fill(LAND), N);
}

// A deterministic scatter of blobs standing in for a typical hand-painted map.
function paintTypicalMap(model) {
  let seed = 12345;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let s = 0; s < 150; s++) {
    model.beginStroke({ tool: "paint", layer: "political", colour: 1 + (s % 8), size: 14 });
    let x = next() * (N - 300) + 100;
    let y = next() * (N - 300) + 100;
    for (let k = 0; k < 30; k++) {
      model.strokeTo(x, y);
      x += (next() - 0.4) * 40;
      y += (next() - 0.4) * 40;
    }
    model.endStroke();
  }
  model.beginStroke({ tool: "paint", layer: "culture", colour: 3, size: 12 });
  for (let k = 0; k < 40; k++) model.strokeTo(500 + k * 20, 900 + (k % 5) * 30);
  model.endStroke();
  model.beginStroke({ tool: "paint", layer: "province", colour: 2, size: 6 });
  for (let k = 0; k < 20; k++) model.strokeTo(1200 + k * 10, 1200);
  model.endStroke();
  model.beginStroke({ tool: "border", layer: "political" });
  for (let k = 0; k < 60; k++) model.strokeTo(800 + k, 800 + k);
  model.endStroke();
}

function populate(model) {
  paintTypicalMap(model);
  model.name = "Test world";
  model.addColour("#123456");
  const design = model.addDesign(Uint8Array.from({ length: 384 }, (_, i) => i % 3));
  model.addMarker({ type: "city", x: 10, y: 20, name: "Roma", colour: 1 });
  model.addMarker({ type: "flag", x: 30, y: 40, name: "Banner", colour: 2, design });
  model.addMarker({ type: "label", x: 50, y: 60, name: "Mare Nostrum", colour: 3 });
  model.addMarker({ type: "city", x: 90, y: 100, name: "", colour: 1, tagDx: -12, tagDy: 7 });
  model.addMarker({ type: "symbol", x: 70, y: 80, name: "Siege", colour: 4, glyph: "sword", layer: "province" });
}

const zeroPlane = new Uint8Array(N * N);

function validHeader(over = {}) {
  return {
    format: 1,
    name: "Crafted",
    origin: null,
    palette: ["#aa0000", "#00aa00"],
    markers: [],
    flags: [],
    savedWith: "test",
    ...over,
  };
}

// Builds a gzip file byte by byte so a test can break exactly one rule.
async function craft({ magic = MAGIC, header = validHeader(), planes = {}, tail = [], lengthDelta = 0 } = {}) {
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, headerBytes.length + lengthDelta, false);
  const parts = PLANE_NAMES.map((name) => planes[name] ?? zeroPlane);
  const raw = new Blob([new TextEncoder().encode(magic), length, headerBytes, ...parts, new Uint8Array(tail)]);
  return new Response(raw.stream().pipeThrough(new CompressionStream("gzip"))).blob();
}

function planeWith(index, value) {
  const plane = new Uint8Array(N * N);
  plane[index] = value;
  return plane;
}

async function assertRejected(blob, pattern) {
  await assert.rejects(decodeMap(blob, GLYPHS), (error) => error instanceof MapFileError && pattern.test(error.message));
}

test("AC-1: save then open restores planes, palette, markers and designs exactly", async (t) => {
  const model = fullModel();
  populate(model);
  const before = model.snapshot();

  let started = performance.now();
  const blob = await encodeMap(before);
  const encodeMs = performance.now() - started;
  started = performance.now();
  const after = await decodeMap(blob, GLYPHS);
  const decodeMs = performance.now() - started;
  t.diagnostic(`encode ${encodeMs.toFixed(0)} ms, decode ${decodeMs.toFixed(0)} ms, file ${blob.size} bytes`);

  assert.equal(after.name, "Test world");
  assert.equal(after.origin, null);
  assert.deepEqual(after.palette, before.palette);
  assert.deepEqual(after.markers, before.markers);
  assert.deepEqual(after.designs, before.designs);
  assert.ok(after.designs.every((d) => d instanceof Uint8Array && d.length === 384));
  for (const name of PLANE_NAMES) assert.ok(sameBytes(after.planes[name], before.planes[name]), `plane ${name}`);
  assert.equal(after.planes.political.buffer, after.planes.border.buffer, "planes share one buffer");
  assert.ok(after.planes.province.some((v) => v === 2), "province paint survives");

  const target = fullModel();
  target.replace(after);
  assert.equal(target.isDirty(), false);
  assert.equal(target.addMarker({ type: "city", x: 1, y: 1, name: "Next", colour: 1 }).id, 6);
});

test("AC-3: a typical sparse map is under 1 MB", async (t) => {
  const model = fullModel();
  const empty = await encodeMap(model.snapshot());
  paintTypicalMap(model);
  const painted = await encodeMap(model.snapshot());
  t.diagnostic(`empty ${empty.size} bytes, lightly painted ${painted.size} bytes`);
  assert.ok(painted.size < 1_000_000, `painted map is ${painted.size} bytes`);
  assert.ok(empty.size < painted.size);
});

test("AC-2: a truncated file is rejected", async () => {
  const blob = await encodeMap(fullModel().snapshot());
  await assertRejected(blob.slice(0, Math.floor(blob.size / 2)), /damaged or cut short/);
});

test("AC-2: a wrong magic is rejected", async () => {
  await assertRejected(await craft({ magic: "AHMAP999" }), /not an AltHistoryMap file/);
});

test("AC-2: a bad colour is rejected", async () => {
  await assertRejected(await craft({ header: validHeader({ palette: ["#aa0000", "red"] }) }), /colour in this file is not valid/);
  await assertRejected(await craft({ header: validHeader({ palette: ["#AA0000"] }) }), /colour in this file is not valid/);
});

test("AC-2: an out-of-grid marker is rejected", async () => {
  const marker = { id: 1, type: "city", x: N, y: 5, name: "Edge", colour: 1, glyph: "", design: -1, layer: "political" };
  await assertRejected(await craft({ header: validHeader({ markers: [marker] }) }), /outside the map/);
});

test("a rejected file returns nothing at all", async () => {
  let result = "unset";
  try {
    result = await decodeMap(await craft({ magic: "AHMAP999" }), GLYPHS);
  } catch {
    result = undefined;
  }
  assert.equal(result, undefined);
});

test("bytes that are not gzip are rejected as not ours", async () => {
  await assertRejected(new Blob(["hello, this is plain text"]), /not an AltHistoryMap file/);
  await assertRejected(new Uint8Array([1]), /not an AltHistoryMap file/);
});

test("lengths must add up exactly", async () => {
  await assertRejected(await craft({ tail: [0] }), /damaged or cut short/);
  await assertRejected(await craft({ lengthDelta: 1 }), /damaged or cut short/);
});

test("illegal plane values are rejected, legal extremes accepted", async () => {
  await assertRejected(await craft({ planes: { political: planeWith(100, 3) } }), /colour in this file's map/);
  await assertRejected(await craft({ planes: { reserved: planeWith(100, 255) } }), /colour in this file's map/);
  await assertRejected(await craft({ planes: { border: planeWith(100, 2) } }), /borders/);
  const ok = await decodeMap(await craft({ planes: { province: planeWith(7, 2), political: planeWith(8, 2), border: planeWith(9, 1) } }), GLYPHS);
  assert.equal(ok.planes.province[7], 2);
});

test("an older file's fighting and second claimant are cleared; its Conflict markers move to Province", async () => {
  const old = await decodeMap(
    await craft({
      planes: { province: planeWith(7, 255), reserved: planeWith(8, 1) },
      header: validHeader({ markers: [{ id: 1, type: "symbol", x: 1, y: 1, name: "Siege", colour: 1, glyph: "sword", design: -1, layer: "conflict" }] }),
    }),
    GLYPHS,
  );
  assert.equal(old.planes.province[7], 0);
  assert.equal(old.planes.reserved[8], 0);
  assert.equal(old.markers[0].layer, "province");
});

test("a capital and its nation survive a save; a capital that is not a city is refused", async () => {
  const city = { id: 1, type: "city", x: 1, y: 1, name: "A", colour: 1, glyph: "", design: -1, layer: "political", capital: true, nation: 2 };
  const kept = await decodeMap(await craft({ header: validHeader({ markers: [city] }) }), GLYPHS);
  assert.deepEqual([kept.markers[0].capital, kept.markers[0].nation], [true, 2]);
  await assertRejected(await craft({ header: validHeader({ markers: [{ ...city, type: "label" }] }) }), /capital but is not a city/);
  await assertRejected(await craft({ header: validHeader({ markers: [{ ...city, nation: 99 }] }) }), /nation colour/);
});

test("marker rules: glyph, duplicate id, layer, colour, flag design", async () => {
  const base = { id: 1, type: "city", x: 1, y: 1, name: "A", colour: 1, glyph: "", design: -1, layer: "political" };
  const withMarkers = (markers, extra = {}) => craft({ header: validHeader({ markers, ...extra }) });
  await assertRejected(await withMarkers([{ ...base, type: "symbol", glyph: "nope", layer: "province" }]), /symbol that is not known/);
  await assertRejected(await withMarkers([base, { ...base }]), /repeated number/);
  await assertRejected(await withMarkers([{ ...base, layer: "culture" }]), /layer it cannot be on/);
  await assertRejected(await withMarkers([{ ...base, colour: 3 }]), /colour that is not valid/);
  await assertRejected(await withMarkers([{ ...base, type: "label", name: "" }]), /name that is not valid/);
  await assertRejected(await withMarkers([{ ...base, name: "x".repeat(61) }]), /name that is not valid/);
  await assertRejected(await withMarkers([{ ...base, tagDx: 5000 }]), /name tag that is out of place/);
  await assertRejected(await withMarkers([{ ...base, tagDy: 1.5 }]), /name tag that is out of place/);
  const unnamed = await decodeMap(await withMarkers([{ ...base, name: "", tagDx: -12, tagDy: 7 }]), GLYPHS);
  assert.deepEqual([unnamed.markers[0].name, unnamed.markers[0].tagDx, unnamed.markers[0].tagDy], ["", -12, 7]);
  const older = await decodeMap(await withMarkers([base]), GLYPHS);
  assert.deepEqual([older.markers[0].tagDx, older.markers[0].tagDy], [0, 0], "a file saved before name tags moved still opens");
  await assertRejected(await withMarkers([{ ...base, type: "flag", design: 0 }]), /flag design that is not in the file/);
  const good = await decodeMap(await withMarkers([{ ...base, type: "flag", design: 0 }], { flags: [new Array(384).fill(1)] }), GLYPHS);
  assert.equal(good.markers[0].design, 0);
  assert.equal(good.designs[0][5], 1);
});

test("flag design and palette limits", async () => {
  await assertRejected(await craft({ header: validHeader({ flags: [new Array(383).fill(0)] }) }), /flag design/);
  await assertRejected(await craft({ header: validHeader({ flags: [new Array(384).fill(3)] }) }), /flag design/);
  await assertRejected(await craft({ header: validHeader({ palette: new Array(255).fill("#000000") }) }), /colour list/);
  await assertRejected(await craft({ header: validHeader({ format: 2 }) }), /different version/);
});

test("a missing name becomes Untitled map; an over-long name is rejected", async () => {
  const header = validHeader();
  delete header.name;
  assert.equal((await decodeMap(await craft({ header }), GLYPHS)).name, "Untitled map");
  await assertRejected(await craft({ header: validHeader({ name: "x".repeat(61) }) }), /map name/);
});

test("encodeMap refuses a map it could not reopen, and trims an over-long name", async () => {
  const snap = fullModel().snapshot();
  await assert.rejects(encodeMap({ ...snap, planes: { ...snap.planes, border: new Uint8Array(10) } }), MapFileError);
  await assert.rejects(encodeMap({ ...snap, palette: ["nope"] }), /cannot be saved/);
  const back = await decodeMap(await encodeMap({ ...snap, name: "n".repeat(100) }), GLYPHS);
  assert.equal(back.name.length, 60);
});

test("asScenarioCopy renames and tags without touching the original", () => {
  const original = { name: "Bundled", origin: null, palette: [], markers: [], designs: [], planes: {} };
  const copy = asScenarioCopy(original, { id: "rome-117", title: "Rome at its height" });
  assert.equal(copy.name, "Rome at its height (copy)");
  assert.equal(copy.origin, "rome-117");
  assert.equal(original.name, "Bundled");
  assert.equal(original.origin, null);
  assert.ok(asScenarioCopy(original, { id: "x", title: "t".repeat(90) }).name.length <= 60);
});

const FIXTURE = fileURLToPath(new URL("../app/data/scenarios/blank-world.ahmap", import.meta.url));
test("cross-language: the Python-written blank world opens", { skip: !existsSync(FIXTURE) && "blank-world.ahmap not built yet" }, async () => {
  const data = await decodeMap(new Blob([await readFile(FIXTURE)]), GLYPHS);
  assert.equal(data.planes.political.length, N * N);
  assert.ok(Array.isArray(data.palette));
});
