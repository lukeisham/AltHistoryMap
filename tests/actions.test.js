import test from "node:test";
import assert from "node:assert/strict";
import { createModel, LAND, PLANE_NAMES, DEFAULT_PALETTE } from "../app/model.js";
import { MapFileError } from "../app/mapfile.js";
import { createActions } from "../app/actions.js";
import { yearLabel, orderScenarios, bindScenarios } from "../app/scenarios.js";

const SIDE = 8;

function mapData(name) {
  const planes = Object.fromEntries(PLANE_NAMES.map((plane) => [plane, new Uint8Array(SIDE * SIDE)]));
  return { name, origin: null, palette: [...DEFAULT_PALETTE], markers: [], designs: [], planes };
}

function setup({ choice = "cancel", deps = {} } = {}) {
  const model = createModel(new Uint8Array(SIDE * SIDE).fill(LAND), SIDE);
  const log = { said: [], picked: 0, read: 0, cleared: 0, changes: 0 };
  const realDeps = {
    downloadMap: async () => "My map",
    pickMapFile: async () => {
      log.picked++;
      return {};
    },
    readMapFile: async () => {
      log.read++;
      return mapData("Opened");
    },
    decodeMap: async () => mapData("Scenario"),
    clearRecovery: async () => {
      log.cleared++;
    },
    loadScenarioBlob: async () => ({}),
    saveBlob() {},
    ...deps,
  };
  const actions = createActions({
    model,
    renderer: { exportPng: async () => ({}), getLook: () => "political" },
    dialogs: { choose: async () => choice, askName: async () => "Renamed" },
    say: (text) => log.said.push(text),
    glyphIds: [],
    onChange: () => log.changes++,
    deps: realDeps,
  });
  return { model, actions, log };
}

const edit = (model) => model.addColour("#abcdef");

test("unsaved work: the picker opens first; Cancel then keeps the map and Discard goes on", async () => {
  const kept = setup({ choice: "cancel" });
  edit(kept.model);
  await kept.actions.open();
  assert.equal(kept.log.picked, 1);
  assert.equal(kept.log.read, 0);
  assert.equal(kept.model.name, "Untitled map");

  const discarded = setup({ choice: "discard" });
  edit(discarded.model);
  await discarded.actions.open();
  assert.equal(discarded.log.picked, 1);
  assert.equal(discarded.model.name, "Opened");
  assert.equal(discarded.model.isDirty(), false);
  assert.equal(discarded.log.cleared, 1, "the recovery copy of the discarded work is cleared");
});

test("a bad file is reported in plain words and leaves the map untouched", async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const bad = setup({
      deps: {
        readMapFile: async () => {
          throw new MapFileError("This file is damaged or cut short");
        },
      },
    });
    await bad.actions.open();
    assert.deepEqual(bad.log.said, ["This file is damaged or cut short"]);
    assert.equal(bad.model.name, "Untitled map");
  } finally {
    console.warn = warn;
  }
});

test("save marks the map saved; a restored copy stays unsaved until saved", async () => {
  const { model, actions, log } = setup();
  edit(model);
  assert.equal(actions.isDirty(), true);
  assert.equal(await actions.save(), true);
  assert.equal(actions.isDirty(), false);
  assert.match(log.said.at(-1), /Saved as My map\.ahmap/);

  await actions.restore({});
  assert.equal(model.isDirty(), false);
  assert.equal(actions.isDirty(), true);
  await actions.save();
  assert.equal(actions.isDirty(), false);
});

test("a scenario opens as an editable copy and shows its note", async () => {
  const { model, actions, log } = setup();
  await actions.openScenario({ id: "roman-117", title: "Roman Empire AD 117", note: "Approximate sketch." });
  assert.equal(model.name, "Roman Empire AD 117 (copy)");
  assert.equal(model.origin, "roman-117");
  assert.equal(log.said.at(-1), "Approximate sketch.");
});

test("scenario menu: Blank world first, and a year is added only when the title lacks it", () => {
  const ids = orderScenarios([{ id: "han-100" }, { id: "blank-world" }, { id: "roman-117" }]).map((s) => s.id);
  assert.deepEqual(ids, ["blank-world", "han-100", "roman-117"]);
  assert.equal(yearLabel({ title: "Han China AD 100", year: 100 }), "");
  assert.equal(yearLabel({ title: "Mongols", year: 1279 }), "AD 1279");
  assert.equal(yearLabel({ title: "Persia", year: -500 }), "500 BC");
  assert.equal(yearLabel({ title: "Blank world", year: null }), "");
});

test("a dropped file opens through the same unsaved-work question, without the picker", async () => {
  const dropped = setup({ choice: "discard" });
  edit(dropped.model);
  await dropped.actions.openFile({});
  assert.equal(dropped.log.picked, 0);
  assert.equal(dropped.model.name, "Opened");

  const kept = setup({ choice: "cancel" });
  edit(kept.model);
  await kept.actions.openFile({});
  assert.equal(kept.log.read, 0);
  assert.equal(kept.model.name, "Untitled map");
});

function fakeSelect() {
  const doc = {
    createElement: () => ({ value: "", textContent: "" }),
  };
  const handlers = new Map();
  return {
    ownerDocument: doc,
    options: [],
    value: "",
    disabled: false,
    replaceChildren(...nodes) {
      this.options = nodes;
    },
    addEventListener: (type, fn) => handlers.set(type, fn),
    choose(value) {
      this.value = value;
      handlers.get("change")();
    },
  };
}

test("scenario menu: a prompt first, then the scenarios; choosing one opens it and the prompt returns", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => [{ id: "han-100", title: "Han China AD 100", year: 100 }, { id: "blank-world", title: "Blank world", year: null }, { id: "mongols", title: "Mongols", year: 1279 }],
  }));
  const select = fakeSelect();
  const opened = [];
  await bindScenarios({ container: select, actions: { openScenario: (entry) => opened.push(entry.id) }, say() {} });
  assert.deepEqual(select.options.map((o) => o.textContent), ["Choose a scenario", "Blank world", "Han China AD 100", "Mongols (AD 1279)"]);
  select.choose("han-100");
  assert.deepEqual(opened, ["han-100"]);
  assert.equal(select.value, "", "the same scenario can be chosen again");
  select.choose("");
  assert.deepEqual(opened, ["han-100"], "the prompt opens nothing");
});
