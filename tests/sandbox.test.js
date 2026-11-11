import test from "node:test";
import assert from "node:assert/strict";
import { createModel, LAND, COAST, RIVER, N, DEFAULT_PALETTE } from "../app/model.js";
import { encodeMap, decodeMap, MapFileError } from "../app/mapfile.js";
import { createActions } from "../app/actions.js";
import { createSandboxGrid, sideFor, BLANK, PAINTED, DETAILS, RIVER_WIDTHS } from "../app/sandboxcells.js";
import { createSandbox } from "../app/sandbox.js";
import { termFor } from "../app/terms.js";
import { fakeDocument, fakeDialog } from "./fakedom.js";

const SIDE = 16;
const grid = (start = "ocean") => createSandboxGrid({ start, side: SIDE });
const paint = (g, x, y, d = 1, erase = false) => {
  g.beginStroke(erase ? "erase" : "paint");
  g.dab(x, y, d);
  return g.endStroke();
};
const river = (g, x0, y0, x1, y1, width = "narrow") => {
  g.beginStroke("river", width);
  g.dab(x0, y0, 1);
  g.drag(x0, y0, x1, y1, 1);
  return g.endStroke();
};
const ring = (g, x0, y0, x1, y1) => {
  g.beginStroke();
  g.drag(x0, y0, x1, y0, 1);
  g.drag(x1, y0, x1, y1, 1);
  g.drag(x1, y1, x0, y1, 1);
  g.drag(x0, y1, x0, y0, 1);
  return g.endStroke();
};

test("detail maps to a side: broad 256 cells, fine 1024, anything else is refused", () => {
  assert.equal(sideFor("broad"), 256);
  assert.equal(sideFor("fine"), 1024);
  assert.deepEqual(Object.keys(DETAILS), ["broad", "fine"]);
  assert.throws(() => sideFor("huge"), RangeError);
  assert.throws(() => createSandboxGrid({ start: "sky", side: 8 }), RangeError);
});

test("a stroke paints a disc, erase puts blank cells back, and an untouched stroke is no step", () => {
  const g = grid();
  assert.equal(paint(g, 5, 5, 3), true);
  assert.equal(g.cells[5 * SIDE + 5], PAINTED);
  assert.equal(paint(g, 5, 5, 1, true), true);
  assert.equal(g.cells[5 * SIDE + 5], BLANK);
  assert.equal(paint(g, 5, 5, 1, true), false);
  assert.equal(paint(g, -5, -5, 1), false);
});

test("a closed ring fills its inside, an open one does not, and erasing a hole is not refilled by the next stroke elsewhere", () => {
  const g = grid();
  ring(g, 3, 3, 9, 9);
  assert.equal(g.cells[6 * SIDE + 6], PAINTED, "inside of a closed ring is filled");
  assert.equal(g.cells[12 * SIDE + 12], BLANK, "outside stays blank");

  const open = grid();
  open.beginStroke();
  open.drag(3, 3, 9, 3, 1);
  open.drag(9, 3, 9, 9, 1);
  open.drag(9, 9, 3, 9, 1);
  open.endStroke();
  assert.equal(open.cells[6 * SIDE + 6], BLANK, "a ring with a gap fills nothing");

  paint(g, 6, 6, 1, true);
  paint(g, 14, 14, 1);
  assert.equal(g.cells[6 * SIDE + 6], BLANK, "a hole erased earlier stays a hole");
});

test("undo and redo step through strokes and a fill together; clear is one undoable step", () => {
  const g = grid();
  ring(g, 3, 3, 9, 9);
  const filled = g.cells.slice();
  assert.equal(g.undo(), true);
  assert.ok(g.cells.every((c) => c === BLANK), "one undo removes the ring and its fill");
  assert.equal(g.redo(), true);
  assert.deepEqual(g.cells, filled);
  assert.equal(g.clear(), true);
  assert.ok(g.cells.every((c) => c === BLANK));
  assert.equal(g.clear(), false);
  g.undo();
  assert.deepEqual(g.cells, filled);
  assert.equal(g.canRedo(), true);
  paint(g, 1, 1);
  assert.equal(g.canRedo(), false, "a new stroke drops the redo steps");
});

test("the painted kind is sea when starting with ocean and land when starting with land; the rest is the other kind", () => {
  const ocean = grid("ocean");
  assert.equal(ocean.landShare(), 1);
  paint(ocean, 8, 8, 5);
  assert.ok(ocean.landShare() < 1 && ocean.landShare() > 0.8);
  const land = grid("land");
  assert.equal(land.landShare(), 0);
  paint(land, 8, 8, 5);
  assert.ok(land.landShare() > 0 && land.landShare() < 0.2);
});

test("toBase makes land where the field is land, smooth coasts, and COAST only on water beside land", () => {
  const g = grid("land");
  ring(g, 3, 3, 12, 12);
  const n = 64;
  const base = g.toBase(n);
  assert.equal(base.length, n * n);
  const at = (x, y) => base[y * n + x];
  assert.equal(at(32, 32) & LAND, LAND, "inside the ring is land");
  assert.equal(at(2, 2) & LAND, 0, "far outside is sea");
  let coast = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const bits = at(x, y);
      assert.equal(bits & RIVER, 0);
      if (bits & COAST) {
        coast++;
        assert.equal(bits & LAND, 0, "coast is a water pixel");
        const beside = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && at(a, b) & LAND);
        assert.ok(beside, "coast has land beside it");
      }
    }
  }
  assert.ok(coast > 0);
});

test("starting with ocean makes the unpainted cells land", () => {
  const g = grid("ocean");
  ring(g, 3, 3, 12, 12);
  const n = 64;
  const base = g.toBase(n);
  assert.equal(base[32 * n + 32] & LAND, 0, "the closed ocean is sea");
  assert.equal(base[2 * n + 2] & LAND, LAND, "the unpainted rest is land");
});

test("a river marks the land under it and nothing on the sea, a wide one marks more, and a click alone is no river", () => {
  assert.deepEqual(Object.keys(RIVER_WIDTHS), ["narrow", "wide"]);
  const n = N;
  const mid = n / 2;
  const riverPixels = (width) => {
    const g = grid("land");
    ring(g, 3, 3, 12, 12);
    assert.equal(river(g, 1, 8, 14, 8, width), true);
    const base = g.toBase(n);
    const row = Math.round((8 + 0.5) * (n / SIDE) - 0.5);
    assert.equal(base[row * n + mid] & (LAND | RIVER), LAND | RIVER, "the river runs through the land and stays land");
    assert.equal(base[row * n + Math.round(n * 0.09)] & (LAND | RIVER), 0, "the part over the sea is dropped");
    assert.equal(base[Math.round(n * 0.3) * n + mid] & (LAND | RIVER), LAND, "land away from the river is dry");
    return base.reduce((count, bits) => count + ((bits & RIVER) !== 0), 0);
  };
  assert.ok(riverPixels("wide") > riverPixels("narrow"));

  const g = grid("land");
  g.beginStroke("river");
  g.dab(5, 5, 1);
  assert.equal(g.endStroke(), false);
  assert.equal(g.rivers().length, 0);
  assert.throws(() => g.beginStroke("flood"), RangeError);
  assert.throws(() => g.beginStroke("river", "huge"), RangeError);
});

test("the eraser cuts a river in two, undo joins it again, and clear removes rivers as one undoable step", () => {
  const g = grid("land");
  river(g, 1, 8, 14, 8);
  assert.equal(g.rivers().length, 1);
  assert.ok(g.cells.every((c) => c === BLANK), "a river paints no ground");
  assert.equal(paint(g, 8, 8, 3, true), true, "erasing over a river is a step even when no cell changes");
  assert.equal(g.rivers().length, 2);
  for (const { points } of g.rivers()) {
    for (let k = 0; k < points.length; k += 2) assert.ok(Math.abs(points[k] - 8) > 1.5, "no point is left under the eraser");
  }
  assert.equal(g.undo(), true);
  assert.equal(g.rivers().length, 1);
  assert.equal(g.redo(), true);
  assert.equal(g.rivers().length, 2);
  assert.equal(g.clear(), true);
  assert.equal(g.rivers().length, 0);
  g.undo();
  assert.equal(g.rivers().length, 2);
});

test("a map with its own base map saves a sixth plane, reopens with it, and a plain map still saves five", async () => {
  const base = new Uint8Array(N * N);
  base[1000] = LAND;
  base[1001] = COAST;
  const planes = Object.fromEntries(["political", "culture", "province", "reserved", "border"].map((name) => [name, new Uint8Array(N * N)]));
  const data = { name: "Mine", origin: null, palette: [...DEFAULT_PALETTE], markers: [], designs: [], crests: [], countries: [], planes };
  const withBase = await decodeMap(await encodeMap({ ...data, base }), []);
  assert.equal(withBase.base[1000], LAND);
  assert.equal(withBase.base[1001], COAST);
  assert.equal(withBase.planes.political.length, N * N);
  const plain = await decodeMap(await encodeMap(data), []);
  assert.equal(plain.base, undefined);
});

test("a base plane with an illegal bit, or a wrong size, is refused on save", async () => {
  const planes = Object.fromEntries(["political", "culture", "province", "reserved", "border"].map((name) => [name, new Uint8Array(N * N)]));
  const data = { name: "Bad", origin: null, palette: [...DEFAULT_PALETTE], markers: [], designs: [], crests: [], countries: [], planes };
  const illegal = new Uint8Array(N * N);
  illegal[5] = 16;
  await assert.rejects(encodeMap({ ...data, base: illegal }), MapFileError);
  await assert.rejects(encodeMap({ ...data, base: new Uint8Array(10) }), MapFileError);
});

test("replace swaps the base in place, startOver opens an empty map over it, and the next plain map restores the standard base", () => {
  const side = 8;
  const standard = new Uint8Array(side * side).fill(LAND);
  const model = createModel(standard, side);
  const empty = () => Object.fromEntries(["political", "culture", "province", "reserved", "border"].map((name) => [name, new Uint8Array(side * side)]));
  const custom = new Uint8Array(side * side);
  model.startOver(custom, "Sea world");
  assert.equal(model.customBase, true);
  assert.equal(model.base, standard, "the array every module holds is the same one");
  assert.equal(model.base[0] & LAND, 0);
  assert.equal(model.name, "Sea world");
  assert.equal(model.snapshot().base, standard);
  model.replace({ name: "Plain", origin: null, palette: [...DEFAULT_PALETTE], markers: [], designs: [], crests: [], planes: empty() });
  assert.equal(model.customBase, false);
  assert.equal(model.base[0] & LAND, LAND, "the standard base is back");
  assert.equal("base" in model.snapshot(), false);
  assert.throws(() => model.replace({ name: "Wrong", origin: null, palette: [], markers: [], designs: [], crests: [], planes: empty(), base: new Uint8Array(3) }), RangeError);
});

test("painting on a Sandbox base keeps to its land: sea there refuses paint", () => {
  const side = 8;
  const model = createModel(new Uint8Array(side * side).fill(LAND), side);
  const custom = new Uint8Array(side * side);
  custom[3 * side + 3] = LAND;
  model.startOver(custom, "One island");
  model.beginStroke({ tool: "paint", layer: "political", colour: 1, size: 1 });
  model.strokeTo(0, 0);
  model.strokeTo(3, 3);
  model.endStroke();
  assert.equal(model.planes.political[0], 0);
  assert.equal(model.planes.political[3 * side + 3], 1);
});

function actionsOver(model, log) {
  return createActions({
    model,
    renderer: { exportPng: async () => ({}), getLook: () => "political" },
    dialogs: { choose: async () => log.choice, askName: async () => "x" },
    say: (text) => log.said.push(text),
    glyphIds: [],
    onChange: () => log.changes++,
    deps: { downloadMap: async (data, name) => { log.saved = data; return name; }, clearRecovery: async () => { log.cleared++; } },
  });
}

test("startOnBase asks about unsaved work and leaves the map alone when the person keeps it; saveBaseMap never touches the open map", async () => {
  const model = createModel(new Uint8Array(N * N).fill(LAND), N);
  const log = { said: [], changes: 0, cleared: 0, choice: "cancel" };
  const actions = actionsOver(model, log);
  model.addColour("#abcdef");
  assert.equal(await actions.startOnBase(new Uint8Array(N * N), "New"), false);
  assert.equal(model.customBase, false);
  log.choice = "discard";
  assert.equal(await actions.startOnBase(new Uint8Array(N * N), "New"), true);
  assert.equal(model.customBase, true);
  assert.equal(model.name, "New");
  assert.equal(log.cleared, 1);

  const before = model.name;
  const base = new Uint8Array(N * N);
  assert.equal(await actions.saveBaseMap(base, "Saved base"), true);
  assert.equal(log.saved.base, base);
  assert.equal(log.saved.markers.length, 0);
  assert.equal(model.name, before);
});

function dialogTest(t, options = {}) {
  t.mock.method(console, "warn", () => {});
  const doc = fakeDocument();
  doc.defaultView.getComputedStyle = () => ({ getPropertyValue: (name) => (name === "--map-sea" ? "#c3d8e6" : name === "--map-land" ? "#f3f1e8" : "#000000") });
  const dialog = fakeDialog(doc);
  const calls = { saved: [], used: [] };
  const sandbox = createSandbox({
    dialog,
    saveBase: async (base, name) => { calls.saved.push({ base, name }); return true; },
    useBase: async (base, name, mode) => { calls.used.push({ base, name, mode }); return options.accept ?? true; },
  });
  const byText = (text) => dialog.find((n) => n.tagName === "button" && n.textContent === text);
  const pointer = (node, type, x, y) => node.dispatch(type, { clientX: x, clientY: y, button: 0, pointerId: 1 });
  return { sandbox, dialog, calls, byText, pointer };
}

test("the page opens on a blank sheet with both create options, the river tools shut until one is chosen, and hover text on every control", (t) => {
  const { sandbox, dialog, byText } = dialogTest(t);
  sandbox.open();
  assert.equal(dialog.open, true);
  assert.match(dialog.className, /\bsb-page\b/);
  const terms = [];
  dialog.walk((n) => { if (n.attrs["data-term"]) terms.push(n.attrs["data-term"]); });
  for (const key of ["sandbox:ocean", "sandbox:land", "sandbox:detail", "sandbox:river", "sandbox:narrow", "sandbox:wide", "sandbox:erase", "sandbox:brush", "sandbox:undo", "sandbox:redo", "sandbox:clear", "sandbox:restart", "sandbox:save", "sandbox:play", "sandbox:edit"]) {
    assert.ok(terms.includes(key), `${key} is on no control`);
    assert.ok(termFor(key), `${key} has no hover text`);
  }
  assert.equal(termFor("sandbox:paint"), null);
  for (const label of ["Create by ocean", "Create by border"]) {
    assert.equal(byText(label).disabled, false);
    assert.equal(byText(label).attrs["aria-pressed"], "false");
  }
  for (const label of ["River", "Narrow", "Wide", "Erase", "Undo", "Clear", "Start over", "Save base map", "Play on it", "Edit it"]) {
    assert.equal(byText(label).disabled, true, `${label} waits for a sheet`);
  }
  assert.match(dialog.find((n) => n.className === "fd-status").textContent, /^Choose Create by ocean or Create by border/);
  const toggle = byText("Detail: Broad");
  assert.ok(toggle);
  toggle.click();
  assert.equal(byText("Detail: Fine").attrs["aria-pressed"], "true");
  byText("Detail: Fine").click();
  assert.ok(byText("Detail: Broad"));
});

test("a create option is the sheet's paint tool; the other one starts a new sheet until something is drawn; Start over returns to the blank sheet", (t) => {
  const { sandbox, dialog, byText, pointer } = dialogTest(t);
  sandbox.open();
  byText("Create by ocean").click();
  assert.equal(byText("Create by ocean").attrs["aria-pressed"], "true");
  assert.equal(byText("Detail: Broad").disabled, true);
  byText("Create by border").click();
  assert.equal(byText("Create by border").attrs["aria-pressed"], "true");
  assert.equal(byText("Create by ocean").attrs["aria-pressed"], "false");

  byText("Wide").click();
  assert.equal(byText("River").attrs["aria-pressed"], "true");
  assert.equal(byText("Create by border").attrs["aria-pressed"], "false");
  const canvas = dialog.find((n) => n.tagName === "canvas" && n.className === "sb-canvas");
  pointer(canvas, "pointerdown", 100, 100);
  pointer(canvas, "pointermove", 200, 120);
  pointer(canvas, "pointerup", 200, 120);
  assert.equal(byText("Undo").disabled, false, "the river is a step");
  assert.equal(byText("Create by ocean").disabled, false, "the other create option stays available");
  assert.match(dialog.find((n) => n.className === "fd-status").textContent, /^Land 0%, sea 100%$/, "a river paints no ground");
  byText("Create by ocean").click();
  assert.equal(byText("Undo").disabled, false, "the first click on the other option keeps the drawing");
  assert.match(dialog.find((n) => n.className === "fd-status").textContent, /^Create by ocean again to discard/);
  byText("Create by ocean").click();
  assert.equal(byText("Create by ocean").attrs["aria-pressed"], "true");
  assert.equal(byText("Undo").disabled, true, "the second click starts a new sheet");

  byText("Start over").click();
  assert.equal(byText("Create by ocean").disabled, false);
  assert.equal(byText("River").disabled, true);
});

test("painting with the pointer fills cells, then Edit it hands the base to useBase and closes the page", async (t) => {
  const { sandbox, dialog, calls, byText, pointer } = dialogTest(t);
  sandbox.open();
  byText("Create by ocean").click();
  const canvas = dialog.find((n) => n.tagName === "canvas" && n.className === "sb-canvas");
  pointer(canvas, "pointerdown", 100, 100);
  pointer(canvas, "pointermove", 200, 120);
  pointer(canvas, "pointerup", 200, 120);
  assert.match(dialog.find((n) => n.className === "fd-status").textContent, /^Land \d+%, sea \d+%$/);
  byText("Edit it").click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls.used.length, 1);
  assert.equal(calls.used[0].mode, "edit");
  assert.equal(calls.used[0].name, "New base map");
  assert.equal(calls.used[0].base.length, N * N);
  assert.equal(dialog.open, false);
});

test("declining the unsaved-work question keeps the page and the drawing; Save base map does not close it", async (t) => {
  const { sandbox, dialog, calls, byText } = dialogTest(t, { accept: false });
  sandbox.open();
  byText("Create by border").click();
  byText("Play on it").click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls.used[0].mode, "view");
  assert.equal(dialog.open, true);
  byText("Save base map").click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls.saved.length, 1);
  assert.equal(dialog.open, true);
});
