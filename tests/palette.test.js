import test from "node:test";
import assert from "node:assert/strict";
import { bindPalette } from "../app/palette.js";
import { ITEM_TYPE } from "../app/dragitem.js";
import { createStore } from "../app/state.js";
import { fakeDocument } from "./fakedom.js";

function setup({ mode = "edit" } = {}) {
  const doc = fakeDocument();
  const container = doc.createElement("div");
  const calls = { opened: [], dropped: [] };
  const listeners = [];
  const model = {
    palette: ["#b5473b", "#c98b2b", "#5c8a4d"],
    designs: [{}],
    crests: [{}, {}],
    countries: [{ colour: 2, name: "Orlam" }],
    onChange: (fn) => listeners.push(fn),
  };
  const state = createStore({ colour: 1, colour2: 2 });
  const editor = { addColour: () => 4, editGate: () => mode === "edit" };
  const countries = { open: (colour) => calls.opened.push(colour), dropOnColour: (colour, item) => calls.dropped.push([colour, item]) };
  bindPalette({ container, colourInput: doc.createElement("input"), state, model, editor, countries, glyphIds: ["crown"], shownColourIndex: (hex) => (hex === "#d9c9b3" ? 1 : null), say() {} });
  const swatches = container.findAll((n) => n.className === "swatch");
  return { swatches, calls, state, model, notify: (notice) => listeners.forEach((fn) => fn(notice)) };
}

const dropOf = (item) => {
  let prevented = false;
  return { event: { preventDefault: () => (prevented = true), dataTransfer: { types: [ITEM_TYPE], getData: () => JSON.stringify(item) } }, prevented: () => prevented };
};

test("a click sets the colour and a double-click opens that colour's key facts", () => {
  const t = setup();
  t.swatches[1].dispatch("click", { shiftKey: false });
  assert.equal(t.state.get().colour, 2);
  t.swatches[2].dispatch("dblclick");
  assert.deepEqual(t.calls.opened, [3]);
});

test("a crest or flag design dropped on a swatch is handed to its country; a symbol or an unknown crest is not", () => {
  const t = setup();
  const crest = dropOf({ kind: "crest", crest: 1 });
  t.swatches[0].dispatch("drop", crest.event);
  t.swatches[2].dispatch("drop", dropOf({ kind: "flag", design: 0 }).event);
  t.swatches[1].dispatch("drop", dropOf({ kind: "symbol", glyph: "crown" }).event);
  t.swatches[1].dispatch("drop", dropOf({ kind: "crest", crest: 9 }).event);
  assert.equal(crest.prevented(), true);
  assert.deepEqual(t.calls.dropped, [[1, { kind: "crest", crest: 1 }], [3, { kind: "flag", design: 0 }]]);
});

test("a swatch accepts a drag only in Edit mode", () => {
  const edit = dropOf({ kind: "crest", crest: 0 });
  setup().swatches[0].dispatch("dragover", edit.event);
  assert.equal(edit.prevented(), true);
  const view = dropOf({ kind: "crest", crest: 0 });
  setup({ mode: "view" }).swatches[0].dispatch("dragover", view.event);
  assert.equal(view.prevented(), false);
});

test("a swatch's hover text is its country's name, the colour's own name when unnamed, and follows a rename", () => {
  const t = setup();
  assert.equal(t.swatches[1].title, "Orlam");
  assert.notEqual(t.swatches[0].title, "#b5473b");
  assert.ok(t.swatches[0].title.length > 0);
  t.model.countries = [{ colour: 1, name: "Veyra" }];
  t.notify({ history: true, countries: true });
  assert.equal(t.swatches[0].title, "Veyra");
  assert.notEqual(t.swatches[1].title, "Orlam");
});

test("a colour taken from the map's screen colours picks the country it came from instead of adding one", () => {
  const doc = fakeDocument();
  const container = doc.createElement("div");
  const colourInput = doc.createElement("input");
  const added = [];
  const state = createStore({ colour: 3, colour2: 2 });
  const model = { palette: ["#b5473b"], designs: [], crests: [], countries: [], onChange() {} };
  const editor = { addColour: (hex) => (added.push(hex), 2), editGate: () => true };
  bindPalette({ container, colourInput, state, model, editor, countries: {}, glyphIds: [], shownColourIndex: (hex) => (hex === "#e1c1b5" ? 1 : null), say() {} });
  colourInput.value = "#e1c1b5";
  colourInput.dispatch("change");
  assert.equal(state.get().colour, 1);
  assert.deepEqual(added, []);
  colourInput.value = "#123456";
  colourInput.dispatch("change");
  assert.deepEqual(added, ["#123456"]);
});
