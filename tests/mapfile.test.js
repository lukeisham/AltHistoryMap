import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createModel, LAND, N, PLANE_NAMES, FLAG_W, FLAG_H } from "../app/model.js";
import { stampCrest } from "../app/flagcells.js";
import { defaultCrest, renderShieldOnly } from "../app/crestcells.js";
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
  const design = model.addDesign(Uint8Array.from({ length: FLAG_W * FLAG_H }, (_, i) => i % 3));
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
  assert.ok(after.designs.every((d) => d instanceof Uint8Array && d.length === FLAG_W * FLAG_H));
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

test("a file saved when Province had its own colour opens unchanged: its province paint and Political paint are both kept", async () => {
  const old = await decodeMap(await craft({ planes: { province: planeWith(7, 2), political: planeWith(7, 1) } }), GLYPHS);
  assert.deepEqual([old.planes.province[7], old.planes.political[7]], [2, 1]);
});

test("a capital and its nation survive a save; a capital that is not a city is refused", async () => {
  const city = { id: 1, type: "city", x: 1, y: 1, name: "A", colour: 1, glyph: "", design: -1, layer: "political", capital: true, nation: 2 };
  const kept = await decodeMap(await craft({ header: validHeader({ markers: [city] }) }), GLYPHS);
  assert.deepEqual([kept.markers[0].capital, kept.markers[0].nation], [true, 2]);
  await assertRejected(await craft({ header: validHeader({ markers: [{ ...city, type: "label" }] }) }), /capital but is not a city/);
  await assertRejected(await craft({ header: validHeader({ markers: [{ ...city, nation: 99 }] }) }), /nation colour/);
});

test("a colony survives a save; it must be a city and cannot also be a capital; an older file reads with no colonies", async () => {
  const city = { id: 1, type: "city", x: 1, y: 1, name: "A", colour: 1, glyph: "", design: -1, layer: "political", colony: true };
  const kept = await decodeMap(await craft({ header: validHeader({ markers: [city] }) }), GLYPHS);
  assert.equal(kept.markers[0].colony, true);
  const old = await decodeMap(await craft({ header: validHeader({ markers: [{ ...city, colony: undefined }] }) }), GLYPHS);
  assert.equal(old.markers[0].colony, false);
  await assertRejected(await craft({ header: validHeader({ markers: [{ ...city, type: "label" }] }) }), /colony but is not a city/);
  await assertRejected(await craft({ header: validHeader({ markers: [{ ...city, capital: true }] }) }), /also a capital/);
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
  const good = await decodeMap(await withMarkers([{ ...base, type: "flag", design: 0 }], { flags: [new Array(FLAG_W * FLAG_H).fill(1)] }), GLYPHS);
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

const CREST = { shape: "french", division: "quarterly", ordinary: "bordure", charge: "crown", field: 1, field2: 2, ordinaryColour: 3, chargeColour: 4, outline: 5 };

test("a flag stamped with a shield only saves and opens with the same cells", async () => {
  const flag = stampCrest(new Uint8Array(FLAG_W * FLAG_H).fill(1), renderShieldOnly({ ...defaultCrest(2, 3), ...CREST, supporterLeft: "lion", supporterRight: "lion" }), FLAG_W / 2, FLAG_H / 2);
  const model = fullModel();
  model.addDesign(flag);
  const after = await decodeMap(await encodeMap(model.snapshot()), GLYPHS);
  assert.deepEqual(Array.from(after.designs[0]), Array.from(flag));
  assert.ok(flag.some((v) => v !== 1), "the shield changed the flag");
});

test("crests survive a save and open, in order, and the model takes them back", async () => {
  const model = fullModel();
  model.addCrest(CREST);
  model.addCrest({ ...CREST, shape: "oval", charge: "none" });
  const after = await decodeMap(await encodeMap(model.snapshot()), GLYPHS);
  assert.deepEqual(after.crests, model.crests);
  const target = fullModel();
  target.replace(after);
  assert.deepEqual(target.crests, model.crests);
});

test("a map saved before crests existed opens with none, and saves again with an empty list", async () => {
  const header = validHeader();
  assert.equal("crests" in header, false);
  const old = await decodeMap(await craft({ header }), GLYPHS);
  assert.deepEqual(old.crests, []);
  const again = await decodeMap(await encodeMap({ ...old }), GLYPHS);
  assert.deepEqual(again.crests, []);
  assert.deepEqual(again.palette, old.palette);
});

test("a file with flag designs and markers but no crests key keeps all of them", async () => {
  const cells = Array.from({ length: FLAG_W * FLAG_H }, (_, i) => i % 3);
  const header = validHeader({
    flags: [cells],
    markers: [{ id: 1, type: "flag", x: 5, y: 5, name: "Old banner", colour: 1, design: 0, layer: "political" }],
  });
  const data = await decodeMap(await craft({ header }), GLYPHS);
  assert.deepEqual(Array.from(data.designs[0]), cells);
  assert.equal(data.markers[0].name, "Old banner");
  assert.deepEqual(data.crests, []);
});

test("a flag saved at 24 x 16 opens scaled up to the current grid, colours in place", async () => {
  const old = Array.from({ length: 24 * 16 }, (_, i) => (i === 0 ? 2 : i === 24 * 16 - 1 ? 1 : 0));
  const data = await decodeMap(await craft({ header: validHeader({ flags: [old] }) }), GLYPHS);
  const [design] = data.designs;
  assert.equal(design.length, FLAG_W * FLAG_H);
  assert.deepEqual([design[0], design[4 * FLAG_W + 4], design[5], design[FLAG_W * FLAG_H - 1]], [2, 2, 0, 1]);
  assert.equal(design.filter((v) => v === 2).length, 25);
});

test("a flag design of any other size is refused", async () => {
  await assertRejected(await craft({ header: validHeader({ flags: [new Array(500).fill(1)] }) }), /flag design/);
});

test("a bad crest is refused: unknown part, colour outside the palette, wrong type, too many", async () => {
  const bad = async (crests) => assertRejected(await craft({ header: validHeader({ crests }) }), /crest/i);
  await bad([{ ...CREST, field: 1, field2: 3 }]);
  await bad([{ ...CREST, charge: "dragon" }]);
  await bad([{ ...CREST, shape: 4 }]);
  await bad("heater");
  await bad(Array.from({ length: 33 }, () => ({ ...CREST, field: 1, field2: 2, ordinaryColour: 1, chargeColour: 2, outline: 1 })));
});

test("every bundled scenario still opens, with its flags, no crests and countries that link nothing", async () => {
  const folder = fileURLToPath(new URL("../app/data/scenarios/", import.meta.url));
  const files = (await readdir(folder)).filter((name) => name.endsWith(".ahmap"));
  assert.ok(files.length >= 4, "the scenario scan found the bundled maps");
  for (const name of files) {
    const data = await decodeMap(new Blob([await readFile(folder + name)]), ["sword", "crown"].concat(await glyphIdsFromApp()));
    assert.deepEqual(data.crests, [], name);
    assert.ok(data.countries.every((country) => country.flag === -1 && country.crest === -1 && country.alignment === ""), name);
    const model = fullModel();
    model.replace(data);
    assert.equal(model.isDirty(), false, name);
  }
});

async function glyphIdsFromApp() {
  const { GLYPHS: all } = await import("../app/glyphs.js");
  return all.map((glyph) => glyph.id);
}

const COUNTRY = { colour: 2, name: "Aurea", ruler: "Queen Ona", government: "Monarchy", motto: "Lex et Ordo", currency: "Mark", demonym: "Aurean", alignment: "chaotic-neutral", flag: -1, crest: 0 };

test("countries survive a save and open, and the model takes them back", async () => {
  const model = fullModel();
  model.addCrest(CREST);
  model.setCountry(COUNTRY.colour, COUNTRY);
  const after = await decodeMap(await encodeMap(model.snapshot()), GLYPHS);
  assert.deepEqual(after.countries, model.countries);
  const target = fullModel();
  target.replace(after);
  assert.deepEqual(target.countries, model.countries);
});

test("a map saved before countries existed opens with none", async () => {
  assert.equal("countries" in validHeader(), false);
  const old = await decodeMap(await craft({ header: validHeader() }), GLYPHS);
  assert.deepEqual(old.countries, []);
});

test("a bad country is refused: unknown alignment, colour outside the palette, a crest the map lacks, a colour listed twice", async () => {
  const bad = async (countries) => assertRejected(await craft({ header: validHeader({ countries }) }), /countr/i);
  const blank = { colour: 1, name: "", ruler: "", government: "", motto: "", currency: "", demonym: "", alignment: "", flag: -1, crest: -1 };
  await bad([{ ...blank, alignment: "evil-lawful" }]);
  await bad([{ ...blank, colour: 3 }]);
  await bad([{ ...blank, crest: 0 }]);
  await bad([blank, blank]);
  await bad("not a list");
  const fine = await decodeMap(await craft({ header: validHeader({ countries: [{ ...blank, name: "Fine" }] }) }), GLYPHS);
  assert.equal(fine.countries[0].name, "Fine");
});

test("a relationship survives a save and open, a map without one shows none, and a loop in a file is refused", async () => {
  const model = fullModel();
  model.setCountry(2, { relation: "colony", overlord: 3 });
  const after = await decodeMap(await encodeMap(model.snapshot()), GLYPHS);
  assert.deepEqual(after.countries, model.countries);
  assert.deepEqual([after.countries[0].relation, after.countries[0].overlord], ["colony", 3]);
  const plain = fullModel();
  plain.setCountry(2, { name: "Aurea" });
  const unrelated = await decodeMap(await encodeMap(plain.snapshot()), GLYPHS);
  assert.equal("relation" in unrelated.countries[0] || "overlord" in unrelated.countries[0], false);
  const blank = { colour: 1, name: "", ruler: "", government: "", motto: "", currency: "", demonym: "", alignment: "", flag: -1, crest: -1 };
  const loop = [{ ...blank, colour: 1, relation: "client", overlord: 2 }, { ...blank, colour: 2, relation: "client", overlord: 1 }];
  await assertRejected(await craft({ header: validHeader({ countries: loop }) }), /answers to itself/);
});
