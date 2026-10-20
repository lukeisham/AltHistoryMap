import test from "node:test";
import assert from "node:assert/strict";
import { createModel, LAND, RIVER, LAKE, PLANE_NAMES, MAX_CRESTS, FLAG_W, FLAG_H, project, unproject, pixelAt, N } from "../app/model.js";

const SIDE = 64;

// A 64 x 64 world: land everywhere except a sea column at x = 32.
function smallModel() {
  const base = new Uint8Array(SIDE * SIDE).fill(LAND);
  for (let y = 0; y < SIDE; y++) base[y * SIDE + 32] = 0;
  return createModel(base, SIDE);
}

const at = (m, plane, x, y) => m.planes[plane][y * SIDE + x];

test("projection round-trips and puts Rome in the right place", () => {
  const p = project(12.5, 41.9);
  const back = unproject(p.x, p.y);
  assert.ok(Math.abs(back.lon - 12.5) < 1e-9 && Math.abs(back.lat - 41.9) < 1e-9);
  assert.deepEqual(pixelAt(-180, 90), { x: 0, y: 0 });
  assert.equal(pixelAt(179.999, -90).y, N - 1);
});

test("paint one pixel, undo restores it, redo reapplies it", () => {
  const m = smallModel();
  m.beginStroke({ tool: "paint", layer: "political", colour: 1, size: 1 });
  m.strokeTo(10, 10);
  assert.equal(m.endStroke(), true);
  assert.equal(at(m, "political", 10, 10), 1);
  assert.equal(m.planes.political.reduce((a, v) => a + (v ? 1 : 0), 0), 1);
  assert.equal(m.isDirty(), true);
  m.undo();
  assert.equal(at(m, "political", 10, 10), 0);
  m.redo();
  assert.equal(at(m, "political", 10, 10), 1);
});

test("a drag leaves no gap and sea is never painted", () => {
  const m = smallModel();
  m.beginStroke({ tool: "paint", layer: "culture", colour: 2, size: 1 });
  m.strokeTo(5, 5);
  m.strokeTo(60, 40);
  m.endStroke();
  let count = 0;
  for (let i = 0; i < m.planes.culture.length; i++) if (m.planes.culture[i]) count++;
  assert.ok(count >= 55);
  for (let y = 0; y < SIDE; y++) assert.equal(at(m, "culture", 32, y), 0);
});

test("fill stops at a different value and never crosses water", () => {
  const m = smallModel();
  m.beginStroke({ tool: "paint", layer: "political", colour: 3, size: 1 });
  m.strokeTo(10, 0);
  m.strokeTo(10, 63);
  m.endStroke();
  const changed = m.fill("political", 5, 5, 1);
  assert.equal(changed, 10 * SIDE);
  assert.equal(at(m, "political", 5, 5), 1);
  assert.equal(at(m, "political", 10, 5), 3);
  assert.equal(at(m, "political", 20, 5), 0);
  assert.equal(at(m, "political", 40, 5), 0);
});

test("a sea start does nothing and symbols can still sit at sea", () => {
  const m = smallModel();
  assert.equal(m.fill("political", 32, 5, 1), 0);
  const marker = m.addMarker({ type: "symbol", x: 32, y: 5, name: "Fleet", colour: 1, glyph: "anchor", layer: "political" });
  assert.equal(marker.x, 32);
});

test("a stroke announces its pixels as it goes, and closing it only announces the history", () => {
  const m = smallModel();
  const notices = [];
  m.onChange((notice) => notices.push(notice));
  m.beginStroke({ tool: "paint", layer: "political", colour: 1 });
  m.strokeTo(3, 3);
  assert.deepEqual(notices, [{ layer: "political", rect: { x0: 3, y0: 3, x1: 3, y1: 3 }, markers: false }], "colour is announced before the stroke ends");
  m.strokeTo(6, 3);
  assert.deepEqual(notices.at(-1).rect, { x0: 3, y0: 3, x1: 6, y1: 3 }, "each move announces only the pixels it touched");
  m.endStroke();
  assert.deepEqual(notices.at(-1), { layer: "political", history: true });
  assert.equal(m.canUndo(), true);
});

function paintBlock(m, x0, y0, x1, y1, colour) {
  m.beginStroke({ tool: "paint", layer: "political", colour, size: 1 });
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.strokeTo(x, y);
  m.endStroke();
}

test("a capital remembers the nation around it and goes back to a city when every side changes", () => {
  const m = smallModel();
  paintBlock(m, 9, 9, 13, 13, 1);
  const rome = m.addMarker({ type: "city", x: 11, y: 11, name: "Rome", colour: 1, capital: true });
  assert.deepEqual([rome.capital, rome.nation], [true, 1]);
  assert.equal(m.addMarker({ type: "flag", x: 2, y: 2, name: "F", colour: 1, capital: true }).capital, false, "only a city can be a capital");

  paintBlock(m, 11, 10, 11, 10, 2);
  assert.equal(rome.capital, true, "one side changed");
  paintBlock(m, 10, 11, 12, 11, 2);
  assert.equal(rome.capital, true, "the pixel below it still has the nation's colour");
  paintBlock(m, 11, 12, 11, 12, 2);
  assert.equal(rome.capital, false, "its pixel and all four sides changed");
  assert.equal(m.undo(), true);
  assert.equal(rome.capital, true, "undoing the paint makes it a capital again");
  m.redo();
  assert.equal(rome.capital, false);
});

test("a fill that recolours a capital's surroundings turns it back into a city, and undo restores it", () => {
  const m = smallModel();
  m.fill("political", 5, 5, 1);
  const city = m.addMarker({ type: "city", x: 5, y: 5, name: "A", colour: 1, capital: true });
  assert.equal(city.nation, 1);
  m.fill("political", 5, 5, 2);
  assert.equal(city.capital, false);
  m.undo();
  assert.equal(city.capital, true);
});

test("a capital can be set and cleared as an edit, and moving one re-reads its nation", () => {
  const m = smallModel();
  paintBlock(m, 2, 2, 4, 4, 1);
  paintBlock(m, 12, 2, 14, 4, 3);
  const city = m.addMarker({ type: "city", x: 3, y: 3, name: "A", colour: 1 });
  assert.equal(m.editMarker(city.id, { capital: true }), true);
  assert.deepEqual([city.capital, city.nation], [true, 1]);
  m.moveMarker(city.id, 13, 3);
  assert.deepEqual([city.capital, city.nation], [true, 3]);
  m.undo();
  assert.deepEqual([city.x, city.nation], [3, 1]);
  m.editMarker(city.id, { capital: false });
  assert.equal(city.capital, false);
});

test("province paint, fill and erase use the province plane and leave the others alone", () => {
  const m = smallModel();
  m.planes.political[3 * SIDE + 3] = 4;
  m.beginStroke({ tool: "paint", layer: "province", colour: 2 });
  m.strokeTo(3, 3);
  m.endStroke();
  assert.deepEqual([at(m, "province", 3, 3), at(m, "political", 3, 3), at(m, "culture", 3, 3)], [2, 4, 0]);
  assert.ok(m.fill("province", 5, 5, 3) > 0);
  assert.equal(at(m, "province", 6, 6), 3);
  m.beginStroke({ tool: "erase", layer: "province" });
  m.strokeTo(3, 3);
  m.endStroke();
  assert.deepEqual([at(m, "province", 3, 3), at(m, "political", 3, 3)], [0, 4], "erasing a province keeps Political");
  assert.equal(m.beginStroke({ tool: "border", layer: "province" }), false);
  assert.equal(m.beginStroke({ tool: "claim", layer: "province", colour: 1 }), false);
});

test("markers: add, move, edit, delete, undo; flag designs update every flag", () => {
  const m = smallModel();
  const city = m.addMarker({ type: "city", x: 4, y: 4, name: "Rome", colour: 1 });
  m.moveMarker(city.id, 6, 7);
  m.editMarker(city.id, { name: "Roma" });
  assert.deepEqual([city.x, city.y, city.name], [6, 7, "Roma"]);
  m.undo();
  m.undo();
  assert.deepEqual([city.x, city.y, city.name], [4, 4, "Rome"]);
  m.redo();
  m.deleteMarker(city.id);
  assert.equal(m.markers.length, 0);
  m.undo();
  assert.equal(m.markers.length, 1);

  const cells = new Uint8Array(FLAG_W * FLAG_H).fill(1);
  const d = m.addDesign(cells);
  const flag = m.addMarker({ type: "flag", x: 1, y: 1, name: "Flag", colour: 1, design: d });
  const next = new Uint8Array(FLAG_W * FLAG_H).fill(2);
  m.updateDesign(d, next);
  assert.equal(m.designs[flag.design][0], 2);
});

test("palette is add-only and undoable; history is capped; replace clears dirty", () => {
  const m = smallModel();
  assert.equal(m.addColour("#112233"), 9);
  assert.equal(m.addColour("#112233"), 9);
  assert.equal(m.addColour("nope"), null);
  m.undo();
  assert.equal(m.palette.length, 8);
  for (let i = 0; i < 120; i++) {
    m.beginStroke({ tool: "paint", layer: "political", colour: 1 });
    m.strokeTo(i % 30, Math.floor(i / 30));
    m.endStroke();
  }
  let undone = 0;
  while (m.undo()) undone++;
  assert.equal(undone, 100);
  m.replace({ name: "x", origin: null, palette: ["#000000"], markers: [], designs: [], crests: [], planes: m.planes });
  assert.equal(m.isDirty(), false);
  assert.equal(m.canUndo(), false);
});

// Land everywhere except a sea column at x = 32, a river down x = 20 and a lake pixel at (10, 10).
function riverModel() {
  const base = new Uint8Array(SIDE * SIDE).fill(LAND);
  for (let y = 0; y < SIDE; y++) {
    base[y * SIDE + 32] = 0;
    base[y * SIDE + 20] = LAND | RIVER;
  }
  base[10 * SIDE + 10] = LAKE;
  return createModel(base, SIDE);
}

test("rivers and lakes are never painted by any stroke tool", () => {
  const m = riverModel();
  for (const [tool, layer] of [["paint", "political"], ["border", "political"], ["paint", "province"], ["paint", "culture"]]) {
    assert.ok(m.beginStroke({ tool, layer, colour: 1, size: 5 }));
    m.strokeTo(10, 10);
    m.strokeTo(20, 5);
    m.strokeTo(25, 5);
    m.endStroke();
  }
  for (const plane of PLANE_NAMES) {
    for (let y = 0; y < SIDE; y++) assert.equal(at(m, plane, 20, y), 0, `${plane} on the river`);
    assert.equal(at(m, plane, 10, 10), 0, `${plane} on the lake`);
  }
  assert.equal(at(m, "political", 22, 5), 1, "dry land beside the river is painted");
});

test("a river is a wall to a fill: neither coloured nor crossed, and a fill started on one does nothing", () => {
  const m = riverModel();
  assert.equal(m.fill("political", 20, 5, 1), 0);
  const changed = m.fill("political", 5, 5, 1);
  assert.equal(changed, 20 * SIDE - 1, "every dry land pixel west of the river, the lake pixel left out");
  assert.equal(at(m, "political", 19, 5), 1);
  assert.equal(at(m, "political", 20, 5), 0);
  assert.equal(at(m, "political", 25, 5), 0, "the far bank is not reached");
  assert.equal(m.fill("political", 25, 5, 2), 11 * SIDE, "the far bank fills on its own, up to the sea");
  assert.equal(at(m, "political", 19, 5), 1, "and does not spill back across");
  m.undo();
  m.undo();
  assert.equal(at(m, "political", 5, 5), 0);
});

test("a map loaded with paint on rivers and lakes has that paint cleared", () => {
  const m = riverModel();
  const planes = Object.fromEntries(PLANE_NAMES.map((name) => [name, new Uint8Array(SIDE * SIDE).fill(3)]));
  m.replace({ name: "Old", origin: null, palette: [...m.palette], markers: [], designs: [], crests: [], planes });
  for (const plane of PLANE_NAMES) {
    assert.equal(at(m, plane, 20, 7), 0);
    assert.equal(at(m, plane, 10, 10), 0);
    assert.equal(at(m, plane, 5, 5), 3, "dry land keeps its paint");
  }
});

test("name tags: a city or symbol may have no name, a label may not; the offset moves, undoes and is bounded", () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const m = smallModel();
    const city = m.addMarker({ type: "city", x: 4, y: 4, name: "  ", colour: 1 });
    assert.equal(city.name, "");
    assert.deepEqual([city.tagDx, city.tagDy], [0, 0]);
    assert.equal(m.addMarker({ type: "label", x: 4, y: 4, name: "", colour: 1 }), null);
    assert.equal(m.editMarker(city.id, { name: "Roma" }), true);
    assert.equal(m.editMarker(city.id, { tagDx: 14, tagDy: -9 }), true);
    assert.deepEqual([city.name, city.tagDx, city.tagDy], ["Roma", 14, -9]);
    m.undo();
    assert.deepEqual([city.tagDx, city.tagDy], [0, 0]);
    assert.equal(m.editMarker(city.id, { tagDx: 99999 }), false);
    assert.equal(m.editMarker(city.id, { tagDx: 1.5 }), false);
  } finally {
    console.warn = warn;
  }
});

const CREST = { shape: "heater", division: "pale", ordinary: "cross", charge: "star", field: 1, field2: 2, ordinaryColour: 3, chargeColour: 4, outline: 5, supporterLeft: "lion", supporterRight: "unicorn", supporterLeftColour: 2, supporterRightColour: 1 };

test("crests: add, update, undo and redo; a colour outside the palette or an unknown choice is refused; the library is capped", () => {
  const m = smallModel();
  assert.equal(m.addCrest(CREST), 0);
  assert.deepEqual(
    m.crests[0],
    { ...CREST, supporterLeftFacing: "inward", supporterRightFacing: "inward", compartment: "none", ribbon: "none", compartmentColour: 4, ribbonColour: 4 },
    "a crest without the newer parts is filled in with none and the charge colour",
  );
  assert.equal(m.addCrest({ ...CREST, field: 99 }), null);
  assert.equal(m.addCrest({ ...CREST, charge: "dragon" }), null);
  assert.equal(m.crests.length, 1);

  assert.equal(m.updateCrest(0, { ...CREST, shape: "oval" }), true);
  assert.equal(m.crests[0].shape, "oval");
  assert.equal(m.updateCrest(5, CREST), false);
  m.undo();
  assert.equal(m.crests[0].shape, "heater");
  m.undo();
  assert.equal(m.crests.length, 0);
  m.redo();
  assert.equal(m.crests.length, 1);
  assert.equal(m.isDirty(), true, "adding a crest is an unsaved change");

  const full = smallModel();
  for (let i = 0; i < MAX_CRESTS; i++) full.addCrest(CREST);
  assert.equal(full.addCrest(CREST), null);
});

test("replace and snapshot carry the crests", () => {
  const m = smallModel();
  m.addCrest(CREST);
  const copy = m.snapshot();
  assert.equal(copy.crests, m.crests);
  const other = smallModel();
  other.replace({ ...copy, crests: [] });
  assert.equal(other.crests.length, 0);
});

test("countries: setting facts is one undo step, a country left empty is removed, and a bad colour, alignment or index is refused", () => {
  const m = smallModel();
  m.addCrest(CREST);
  assert.equal(m.setCountry(3, { name: "Aurea", alignment: "lawful-good", crest: 0 }), true);
  assert.deepEqual(m.countries, [{ colour: 3, name: "Aurea", ruler: "", government: "", motto: "", currency: "", demonym: "", alignment: "lawful-good", flag: -1, crest: 0 }]);
  assert.equal(m.setCountry(1, { ruler: "Queen Ona" }), true);
  assert.deepEqual(m.countries.map((c) => c.colour), [1, 3], "kept in colour order");

  assert.equal(m.setCountry(9, { name: "No such colour" }), false);
  assert.equal(m.setCountry(3, { alignment: "good-ish" }), false);
  assert.equal(m.setCountry(3, { crest: 4 }), false);
  assert.equal(m.setCountry(3, { flag: 0 }), false, "no flag designs yet");

  m.undo();
  assert.deepEqual(m.countries.map((c) => c.colour), [3]);
  m.redo();
  assert.equal(m.countries.length, 2);
  assert.equal(m.setCountry(1, { ruler: "" }), true);
  assert.deepEqual(m.countries.map((c) => c.colour), [3], "nothing set, so the country is removed");
  m.undo();
  assert.equal(m.countries.find((c) => c.colour === 1).ruler, "Queen Ona");
});

test("setting the facts a country already has pushes no undo step; replace and snapshot carry countries", () => {
  const m = smallModel();
  m.setCountry(2, { name: "Bora" });
  const revision = m.revision;
  assert.equal(m.setCountry(2, { name: "Bora" }), true);
  assert.equal(m.revision, revision);
  const copy = m.snapshot();
  assert.equal(copy.countries, m.countries);
  const other = smallModel();
  other.replace({ ...copy, countries: copy.countries });
  assert.equal(other.countries[0].name, "Bora");
  other.replace({ ...copy, countries: undefined });
  assert.deepEqual(other.countries, []);
});
