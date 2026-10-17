import test from "node:test";
import assert from "node:assert/strict";
import { createModel, LAND, LAYERS } from "../app/model.js";
import { TOOLS_BY_LAYER, TOOL_KEYS, toolForLayer, keyForTool, STROKE_TOOLS, PLACING_TOOLS } from "../app/tools.js";
import { createAppState, keepSelectionsValid } from "../app/state.js";
import { createEditor } from "../app/editor.js";
import { createKeys, isTypingTarget } from "../app/keys.js";
import { bindLayerBar } from "../app/layerbar.js";
import { createStage, intentFor, cursorFor } from "../app/stage.js";
import { ITEM_TYPE } from "../app/dragitem.js";

const SIDE = 16;
const CELL = 10;
const TAG_SPOT = 40;

function listenerBox() {
  const handlers = new Map();
  return {
    handlers,
    addEventListener(type, fn) {
      handlers.set(type, fn);
    },
    fire(type, event = {}) {
      return handlers.get(type)?.({ preventDefault() {}, ...event });
    },
  };
}

function fakeCanvas() {
  return {
    ...listenerBox(),
    dataset: {},
    attrs: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: SIDE * CELL, height: SIDE * CELL }),
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => false,
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    focus() {},
  };
}

// One grid pixel per CELL screen pixels; a marker is hit within CELL of its pixel.
function fakeRenderer(model) {
  return {
    pinching: false,
    viewport: { x: 0, y: 0, k: CELL, kFit: 1 },
    toGrid: (sx, sy) => ({ x: Math.floor(sx / CELL), y: Math.floor(sy / CELL), inside: sx >= 0 && sy >= 0 && sx < SIDE * CELL && sy < SIDE * CELL }),
    hitTest: (sx, sy) => model.markers.find((m) => Math.abs((m.x + 0.5) * CELL - sx) < CELL && Math.abs((m.y + 0.5) * CELL - sy) < CELL) ?? null,
    // A named marker's tag sits TAG_SPOT screen pixels right of its pixel, moved by its offset.
    hitTag: (sx, sy) =>
      model.markers.find((m) => m.name && Math.abs((m.x + 0.5) * CELL + TAG_SPOT + m.tagDx - sx) < 8 && Math.abs((m.y + 0.5) * CELL + m.tagDy - sy) < 8) ?? null,
    previews: [],
    setPreview(fields) {
      this.previews.push(fields);
    },
    readout: () => ({ coord: "c", zoom: "z" }),
    setHover() {},
    setBrush() {},
    setSelected() {},
    zoomAt() {},
    zoomIn() {},
    zoomOut() {},
    zoomHome() {},
    panBy() {},
  };
}

function setup(mode) {
  globalThis.requestAnimationFrame = () => 0;
  const base = new Uint8Array(SIDE * SIDE).fill(LAND);
  const model = createModel(base, SIDE);
  const state = createAppState({ mode, layer: "political", glyph: "crown" });
  const messages = [];
  const say = (text) => messages.push(text);
  const editor = createEditor({ model, state, say });
  const canvas = fakeCanvas();
  const renderer = fakeRenderer(model);
  let asked = 0;
  const nameField = {
    ask: async () => {
      asked++;
      return "Placed";
    },
    cancel() {},
  };
  const markerInfo = { show() {}, hide: () => false, isOpen: () => false, onRename() {}, onCapital() {}, onDelete() {} };
  const designs = { editFlag() {} };
  const keys = createKeys({ state, editor, dismiss: () => false });
  const button = listenerBox();
  const stage = createStage({
    canvas,
    renderer,
    model,
    state,
    editor,
    nameField,
    markerInfo,
    designs,
    say,
    glyphIds: ["crown", "shape-circle"],
    isPanHeld: keys.isPanHeld,
    readout: { coord: {}, zoom: {} },
    zoomButtons: { zoomIn: button, zoomOut: button, home: button },
  });
  return { model, state, editor, canvas, keys, stage, messages, renderer, asked: () => asked };
}

const click = (canvas, x, y, extra = {}) => {
  const event = { pointerId: 1, pointerType: "mouse", button: 0, clientX: x, clientY: y, ...extra };
  canvas.fire("pointerdown", event);
  canvas.fire("pointerup", event);
};

async function driveEveryTool(env) {
  const { canvas, state, model, keys } = env;
  model.addMarker({ type: "city", x: 5, y: 5, name: "Seed", colour: 1 });
  state.set({ selected: model.markers[0].id });
  const seeded = { revision: model.revision, planes: model.planes.political.slice() };
  for (const layer of LAYERS) {
    for (const tool of TOOLS_BY_LAYER[layer]) {
      state.set({ layer, tool });
      click(canvas, 3 * CELL + 1, 3 * CELL + 1);
      canvas.fire("pointerdown", { pointerId: 2, pointerType: "mouse", button: 0, clientX: 31, clientY: 31 });
      canvas.fire("pointermove", { pointerId: 2, clientX: 90, clientY: 90 });
      canvas.fire("pointerup", { pointerId: 2, clientX: 90, clientY: 90 });
      canvas.fire("pointerdown", { pointerId: 3, pointerType: "mouse", button: 0, clientX: 56, clientY: 56 });
      canvas.fire("pointermove", { pointerId: 3, clientX: 100, clientY: 100 });
      canvas.fire("pointerup", { pointerId: 3, clientX: 100, clientY: 100 });
      canvas.fire("dblclick", { clientX: 56, clientY: 56 });
    }
  }
  for (const key of ["Delete", "Backspace", "p", "f", "c", "e"]) keys.onKeyDown({ key, target: { tagName: "CANVAS" }, preventDefault() {} });
  for (const shiftKey of [false, true]) keys.onKeyDown({ key: "z", ctrlKey: true, shiftKey, target: { tagName: "BODY" }, preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return seeded;
}

test("View mode: no pointer or key action changes the map", async () => {
  const env = setup("view");
  const seeded = await driveEveryTool(env);
  assert.equal(env.model.revision, seeded.revision);
  assert.equal(env.model.markers.length, 1);
  assert.equal(env.model.markers[0].name, "Seed");
  assert.deepEqual(env.model.planes.political, seeded.planes);
  assert.equal(env.asked(), 0);
});

test("Edit mode: the same drive does change the map", async () => {
  const env = setup("edit");
  const seeded = await driveEveryTool(env);
  assert.ok(env.model.revision > seeded.revision);
  assert.ok(env.model.planes.political.some((v) => v !== 0));
});

test("every editor operation refuses outside Edit mode", () => {
  const env = setup("view");
  const { editor, model } = env;
  const before = model.revision;
  assert.equal(editor.beginStroke({ x: 1, y: 1 }), false);
  assert.equal(editor.fill({ x: 1, y: 1 }), 0);
  assert.equal(editor.place({ x: 1, y: 1 }, "x"), null);
  assert.equal(editor.addColour("#123456"), null);
  assert.equal(editor.addDesign(new Uint8Array(384)), null);
  assert.equal(editor.undo(), false);
  assert.equal(editor.deleteSelected(), false);
  assert.equal(model.revision, before);
});

test("the tools offered by each layer match the spec, and every tool has one key", () => {
  assert.deepEqual(TOOLS_BY_LAYER.political, ["paint", "erase", "fill", "border", "city", "flag", "label", "symbol"]);
  assert.deepEqual(TOOLS_BY_LAYER.province, ["paint", "erase", "fill", "symbol"]);
  assert.deepEqual(TOOLS_BY_LAYER.culture, ["paint", "erase", "fill", "symbol"]);
  const offered = new Set(Object.values(TOOLS_BY_LAYER).flat());
  assert.deepEqual(new Set(Object.values(TOOL_KEYS)), offered);
  for (const tool of offered) assert.ok(keyForTool(tool), `${tool} has a key`);
  assert.equal(Object.keys(TOOL_KEYS).length, offered.size);
  for (const tool of [...STROKE_TOOLS, ...PLACING_TOOLS, "fill"]) assert.ok(offered.has(tool), tool);
});

test("a layer switch repairs the tool; Escape then picks no tool", () => {
  const state = createAppState({ mode: "edit", layer: "political", glyph: "crown" });
  state.set({ tool: "border", selected: 4 });
  state.set({ layer: "province" });
  assert.equal(state.get().tool, "paint");
  assert.equal(state.get().selected, null);
  state.set({ tool: "symbol" });
  state.set({ layer: "culture" });
  assert.equal(state.get().tool, "symbol");
  assert.equal(toolForLayer("culture", "border"), "paint");
  assert.equal(toolForLayer("culture", null), null);
});

test("keys pick tools that the layer offers, switch layers, and ignore typing", () => {
  const state = createAppState({ mode: "edit", layer: "political", glyph: "crown" });
  const keys = createKeys({ state, editor: { undo: () => false, redo: () => false, deleteSelected: () => false }, dismiss: () => false, say() {} });
  const press = (key, target = { tagName: "BODY" }) => keys.onKeyDown({ key, target, preventDefault() {} });
  for (const [key, tool] of Object.entries(TOOL_KEYS)) {
    state.set({ layer: "political", tool: "paint" });
    press(key.toLowerCase());
    assert.equal(state.get().tool, TOOLS_BY_LAYER.political.includes(tool) ? tool : "paint", key);
  }
  press("2");
  assert.equal(state.get().layer, "province");
  press("e");
  assert.equal(state.get().tool, "erase");
  press("b");
  assert.equal(state.get().tool, "erase", "Border is not offered on Province");
  press("3", { tagName: "INPUT", type: "text" });
  assert.equal(state.get().layer, "province", "typing in a field is left alone");
  assert.equal(isTypingTarget({ tagName: "BUTTON", closest: (s) => (s === "dialog" ? {} : null) }), true);
  assert.equal(isTypingTarget({ tagName: "INPUT", type: "range" }), false);
});

test("a press means pan in View, and follows the tool in Edit", () => {
  assert.equal(intentFor({ mode: "view", tool: "paint" }, false), "pan");
  assert.equal(intentFor({ mode: "edit", tool: "paint" }, true), "paint");
  assert.equal(intentFor({ mode: "edit", tool: "fill" }, false), "fill");
  assert.equal(intentFor({ mode: "edit", tool: "city" }, false), "place");
  assert.equal(intentFor({ mode: "edit", tool: "city" }, true), "move");
  assert.equal(intentFor({ mode: "edit", tool: null }, true), "move");
  assert.equal(cursorFor({ mode: "view", tool: "paint" }, null), "grab");
  assert.equal(cursorFor({ mode: "edit", tool: "paint" }, null), "crosshair");
  assert.equal(cursorFor({ mode: "edit", tool: "flag" }, null), "copy");
  assert.equal(cursorFor({ mode: "edit", tool: "flag" }, "pan"), "grabbing");
});

test("choices outside the map's colours and designs are pulled back", () => {
  const state = createAppState({ mode: "edit", layer: "political", glyph: "crown" });
  state.set({ colour: 9, colour2: 9, design: 3 });
  keepSelectionsValid(state, { palette: ["#000000", "#111111", "#222222"], designs: [] });
  assert.deepEqual([state.get().colour, state.get().colour2, state.get().design], [1, 2, -1]);
});

test("state: a layer is shown alone in View mode, the view is kept in Edit mode, and entering View keeps the edited layer on screen", () => {
  const state = createAppState({ mode: "view", layer: "political", glyph: "crown" });
  assert.deepEqual(state.get().view, ["political"]);
  assert.equal(state.toggleView("province"), "Political hidden: Province never shares a view.");
  assert.deepEqual(state.get().view, ["province"]);
  assert.equal(state.get().layer, "province", "the edited layer follows the view");
  assert.equal(state.toggleView("culture"), "Province hidden: Culture never shares a view.");
  assert.deepEqual(state.get().view, ["culture"]);

  state.set({ layer: "province" });
  assert.deepEqual(state.get().view, ["province"], "a name in View mode shows that layer alone");

  state.set({ view: ["political"], layer: "political" });
  state.set({ mode: "edit" });
  state.set({ layer: "culture" });
  assert.deepEqual(state.get().view, ["political"], "Edit mode leaves the view alone");
  assert.equal(state.toggleView("province"), "", "eyes do nothing in Edit mode");
  state.set({ mode: "view" });
  assert.deepEqual(state.get().view, ["culture"], "back in View, the edited layer is on screen");
});

test("state: the selection is kept while every layer stays on screen and cleared when one leaves", () => {
  const state = createAppState({ mode: "view", layer: "political", glyph: "crown" });
  state.set({ selected: 7 });
  state.toggleView("political");
  assert.equal(state.get().selected, 7, "Political is still on screen");
  state.toggleView("province");
  assert.equal(state.get().selected, null, "Political left the screen, and a city with it");
});

test("keys: Shift with a digit toggles that layer's eye in View mode and does nothing in Edit mode", () => {
  const state = createAppState({ mode: "view", layer: "political", glyph: "crown" });
  const said = [];
  const keys = createKeys({ state, editor: { undo: () => false, redo: () => false, deleteSelected: () => false }, dismiss: () => false, say: (t) => said.push(t) });
  const press = (event) => keys.onKeyDown({ target: { tagName: "BODY" }, preventDefault() {}, ...event });
  press({ key: "!", code: "Digit1", shiftKey: true });
  assert.deepEqual(state.get().view, ["political"], "the last layer stays on");
  press({ key: "@", code: "Digit2", shiftKey: true });
  assert.deepEqual(state.get().view, ["province"]);
  press({ key: "#", code: "Digit3", shiftKey: true });
  assert.deepEqual(state.get().view, ["culture"]);
  assert.deepEqual(said.at(-1), "Province hidden: Culture never shares a view.");
  press({ key: "1" });
  assert.deepEqual(state.get().view, ["political"], "a plain digit shows that layer alone");
  state.set({ mode: "edit" });
  press({ key: "@", code: "Digit2", shiftKey: true });
  assert.deepEqual(state.get().view, ["political"]);
});

function fakeElement() {
  return { ...listenerBox(), dataset: {}, attrs: {}, title: "", disabled: false, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
}

test("layer bar: eyes and names follow the state, and an eye that drops a layer says so", () => {
  const state = createAppState({ mode: "view", layer: "political", glyph: "crown" });
  const chips = {};
  const eyes = {};
  const names = {};
  for (const layer of LAYERS) {
    chips[layer] = fakeElement();
    eyes[layer] = fakeElement();
    names[layer] = fakeElement();
  }
  const extra = { undo: fakeElement(), redo: fakeElement() };
  const root = {
    querySelector(selector) {
      const chip = /^\[data-chip="(\w+)"\]$/.exec(selector);
      if (chip) return chips[chip[1]];
      const inner = /^\[data-chip="(\w+)"\] \[data-(layer|eye)\]$/.exec(selector);
      if (inner) return (inner[2] === "eye" ? eyes : names)[inner[1]];
      return selector.includes("undo") ? extra.undo : extra.redo;
    },
  };
  const said = [];
  bindLayerBar({ root, state, model: { canUndo: () => false, canRedo: () => false, onChange() {} }, editor: { undo() {}, redo() {} }, say: (t) => said.push(t) });

  assert.equal(eyes.political.attrs["aria-disabled"], "true", "the only layer on cannot be hidden, and keeps focus");
  assert.equal(eyes.political.title, "At least one layer stays on");
  assert.equal(chips.culture.dataset.on, "false");
  eyes.culture.fire("click");
  assert.equal(said.at(-1), "Political hidden: Culture never shares a view.");
  assert.equal(chips.culture.dataset.on, "true");
  assert.equal(eyes.political.attrs["aria-pressed"], "false");
  assert.equal("aria-pressed" in names.culture.attrs, false, "View-mode names are not toggles");

  state.set({ mode: "edit" });
  assert.equal(chips.culture.dataset.edit, "true");
  assert.equal(names.culture.attrs["aria-pressed"], "true");
  names.province.fire("click");
  assert.equal(state.get().layer, "province");
  assert.equal(chips.province.dataset.edit, "true");
});

test("state: the first state repairs the tool, and keeps an edited layer that the saved view lacks", () => {
  const edit = createAppState({ mode: "edit", layer: "province", glyph: "crown" });
  assert.equal(edit.get().tool, "paint");
  const narrow = createAppState({ mode: "view", layer: "culture", view: ["political"], glyph: "crown" });
  assert.equal(narrow.get().layer, "culture");
  assert.deepEqual(narrow.get().view, ["culture"]);
});

const press = (canvas, id, x, y) => canvas.fire("pointerdown", { pointerId: id, pointerType: "mouse", button: 0, clientX: x, clientY: y });
const moveTo = (canvas, id, x, y) => canvas.fire("pointermove", { pointerId: id, clientX: x, clientY: y });
const release = (canvas, id, x, y) => canvas.fire("pointerup", { pointerId: id, clientX: x, clientY: y });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a press on a name tag drags the tag, and a press on a marker drags the marker", () => {
  assert.equal(intentFor({ mode: "edit", tool: null }, false, true), "tag");
  assert.equal(intentFor({ mode: "edit", tool: "city" }, false, true), "tag");
  assert.equal(intentFor({ mode: "edit", tool: "city" }, true, true), "move");
  assert.equal(intentFor({ mode: "edit", tool: "paint" }, false, true), "paint");
  assert.equal(intentFor({ mode: "view", tool: null }, false, true), "pan");
  assert.equal(cursorFor({ mode: "edit", tool: null }, "tag"), "grabbing");
});

test("dragging a marker shows it under the pointer, then moves it in one undo step", () => {
  const env = setup("edit");
  env.state.set({ tool: null });
  env.model.addMarker({ type: "city", x: 5, y: 5, name: "Seed", colour: 1 });
  const revision = env.model.revision;
  press(env.canvas, 1, 57, 52);
  moveTo(env.canvas, 1, 87, 82);
  assert.deepEqual(env.renderer.previews.at(-1), { id: 1, x: 8, y: 8 }, "the grab point stays under the pointer");
  assert.equal(env.model.markers[0].x, 5, "nothing is recorded while the pointer is down");
  release(env.canvas, 1, 87, 82);
  assert.equal(env.renderer.previews.at(-1), null);
  assert.deepEqual([env.model.markers[0].x, env.model.markers[0].y], [8, 8]);
  assert.equal(env.model.revision, revision + 1);
  env.model.undo();
  assert.deepEqual([env.model.markers[0].x, env.model.markers[0].y], [5, 5]);
});

test("dragging a name tag changes only its offset, in one undo step", () => {
  const env = setup("edit");
  env.state.set({ tool: null });
  env.model.addMarker({ type: "city", x: 5, y: 5, name: "Seed", colour: 1 });
  const revision = env.model.revision;
  const tagX = 5.5 * CELL + TAG_SPOT;
  press(env.canvas, 1, tagX, 55);
  moveTo(env.canvas, 1, tagX + 20, 65);
  assert.deepEqual(env.renderer.previews.at(-1), { id: 1, tagDx: 20, tagDy: 10 });
  release(env.canvas, 1, tagX + 20, 65);
  const [marker] = env.model.markers;
  assert.deepEqual([marker.x, marker.y, marker.tagDx, marker.tagDy], [5, 5, 20, 10]);
  assert.equal(env.model.revision, revision + 1);
  env.model.undo();
  assert.deepEqual([marker.tagDx, marker.tagDy], [0, 0]);
});

test("View mode: a name tag cannot be dragged", () => {
  const env = setup("view");
  env.model.addMarker({ type: "city", x: 5, y: 5, name: "Seed", colour: 1 });
  const tagX = 5.5 * CELL + TAG_SPOT;
  press(env.canvas, 1, tagX, 55);
  moveTo(env.canvas, 1, tagX + 20, 65);
  release(env.canvas, 1, tagX + 20, 65);
  assert.equal(env.model.markers[0].tagDx, 0);
  assert.deepEqual(env.renderer.previews, []);
});

test("with Name tag off a city or symbol is placed unnamed and no name is asked; a label still asks", async () => {
  const env = setup("edit");
  env.state.set({ nameTag: false, tool: "city" });
  click(env.canvas, 31, 31);
  await settle();
  env.state.set({ tool: "symbol" });
  click(env.canvas, 71, 71);
  await settle();
  assert.deepEqual(env.model.markers.map((m) => [m.type, m.name]), [["city", ""], ["symbol", ""]]);
  assert.equal(env.asked(), 0);
  env.state.set({ tool: "label" });
  click(env.canvas, 111, 111);
  await settle();
  assert.equal(env.asked(), 1);
  assert.equal(env.model.markers.at(-1).name, "Placed");
});

test("with Name tag on the name is asked as before", async () => {
  const env = setup("edit");
  env.state.set({ tool: "city" });
  click(env.canvas, 31, 31);
  await settle();
  assert.equal(env.asked(), 1);
  assert.equal(env.model.markers[0].name, "Placed");
});

function dropOf(item, x, y) {
  return {
    clientX: x,
    clientY: y,
    dataTransfer: { types: [ITEM_TYPE], getData: () => JSON.stringify(item), dropEffect: "" },
  };
}

test("dropping a symbol or shape from the panel places it at the drop; a bad item or View mode places nothing", async () => {
  const env = setup("edit");
  env.canvas.fire("drop", dropOf({ kind: "symbol", glyph: "shape-circle" }, 61, 41));
  await settle();
  assert.equal(env.state.get().tool, "symbol");
  assert.equal(env.state.get().glyph, "shape-circle");
  assert.equal(env.asked(), 1, "the name is asked while Name tag is on");
  assert.deepEqual([env.model.markers[0].glyph, env.model.markers[0].x, env.model.markers[0].y], ["shape-circle", 6, 4]);

  env.canvas.fire("drop", dropOf({ kind: "symbol", glyph: "not-a-glyph" }, 61, 41));
  env.canvas.fire("drop", dropOf({ kind: "flag", design: 7 }, 61, 41));
  await settle();
  assert.equal(env.model.markers.length, 1);

  const view = setup("view");
  view.canvas.fire("drop", dropOf({ kind: "symbol", glyph: "crown" }, 61, 41));
  await settle();
  assert.equal(view.model.markers.length, 0);
});

test("dropping a flag design places a flag with that design, unnamed when Name tag is off", async () => {
  const env = setup("edit");
  env.model.addDesign(new Uint8Array(384).fill(1));
  env.state.set({ nameTag: false });
  env.canvas.fire("drop", dropOf({ kind: "flag", design: 0 }, 91, 91));
  await settle();
  const [flag] = env.model.markers;
  assert.deepEqual([flag.type, flag.design, flag.name, flag.x, flag.y], ["flag", 0, "", 9, 9]);
  assert.equal(env.asked(), 0);
});

test("dragover accepts a panel item only in Edit mode", () => {
  let prevented = false;
  const over = () => ({ preventDefault: () => (prevented = true), dataTransfer: { types: [ITEM_TYPE], dropEffect: "" } });
  const view = setup("view");
  view.canvas.fire("dragover", over());
  assert.equal(prevented, false);
  const edit = setup("edit");
  edit.canvas.fire("dragover", over());
  assert.equal(prevented, true);
});
