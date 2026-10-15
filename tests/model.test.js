import test from "node:test";
import assert from "node:assert/strict";
import { createModel, LAND, RIVER, LAKE, FIGHTING, PLANE_NAMES, project, unproject, pixelAt, N } from "../app/model.js";

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

test("conflict claim, fighting and erase use the right planes", () => {
  const m = smallModel();
  m.beginStroke({ tool: "claim", layer: "conflict", colour: 1, colour2: 2 });
  m.strokeTo(3, 3);
  m.endStroke();
  assert.deepEqual([at(m, "claimA", 3, 3), at(m, "claimB", 3, 3)], [1, 2]);
  m.beginStroke({ tool: "fighting", layer: "conflict" });
  m.strokeTo(3, 3);
  m.endStroke();
  assert.deepEqual([at(m, "claimA", 3, 3), at(m, "claimB", 3, 3)], [FIGHTING, 0]);
  m.beginStroke({ tool: "erase", layer: "conflict" });
  m.strokeTo(3, 3);
  m.endStroke();
  assert.deepEqual([at(m, "claimA", 3, 3), at(m, "claimB", 3, 3)], [0, 0]);
  assert.equal(m.beginStroke({ tool: "claim", layer: "culture", colour: 1, colour2: 2 }), false);
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

  const cells = new Uint8Array(384).fill(1);
  const d = m.addDesign(cells);
  const flag = m.addMarker({ type: "flag", x: 1, y: 1, name: "Flag", colour: 1, design: d });
  const next = new Uint8Array(384).fill(2);
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
  m.replace({ name: "x", origin: null, palette: ["#000000"], markers: [], designs: [], planes: m.planes });
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
  for (const [tool, layer] of [["paint", "political"], ["border", "political"], ["claim", "conflict"], ["fighting", "conflict"], ["paint", "culture"]]) {
    assert.ok(m.beginStroke({ tool, layer, colour: 1, colour2: 2, size: 5 }));
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

test("a fill crosses a river to both banks without colouring it, and a fill started on one does nothing", () => {
  const m = riverModel();
  assert.equal(m.fill("political", 20, 5, 1), 0);
  const changed = m.fill("political", 5, 5, 1);
  assert.equal(changed, 31 * SIDE - 1, "every dry land pixel west of the sea, the river and the lake pixel left out");
  assert.equal(at(m, "political", 25, 5), 1);
  assert.equal(at(m, "political", 20, 5), 0);
  assert.equal(at(m, "political", 40, 5), 0, "the fill still stops at the sea");
  m.undo();
  assert.equal(at(m, "political", 25, 5), 0);
});

test("a map loaded with paint on rivers and lakes has that paint cleared", () => {
  const m = riverModel();
  const planes = Object.fromEntries(PLANE_NAMES.map((name) => [name, new Uint8Array(SIDE * SIDE).fill(3)]));
  m.replace({ name: "Old", origin: null, palette: [...m.palette], markers: [], designs: [], planes });
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
