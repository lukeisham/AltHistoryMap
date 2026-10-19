import test from "node:test";
import assert from "node:assert/strict";
import { createCrests } from "../app/crests.js";
import { MAX_CRESTS } from "../app/model.js";

function setup({ mode = "edit", made = {} } = {}) {
  const calls = { opened: [], added: [], updated: [], said: [], state: [] };
  const model = { name: "My: map", palette: ["#ffffff", "#101010", "#ff0000"], crests: [] };
  const maker = { open: async (start) => (calls.opened.push(start), made.next ?? null) };
  const state = { get: () => ({ colour: 3, colour2: 4 }), set: (patch) => calls.state.push(patch) };
  const editor = {
    editGate: () => mode === "edit",
    addCrest: (crest) => (calls.added.push(crest), model.crests.push(crest) - 1),
    updateCrest: (index, crest) => (calls.updated.push([index, crest]), true),
  };
  return { crests: createCrests({ maker, model, state, editor, say: (text) => calls.said.push(text) }), calls, model };
}

test("a new crest starts from the chosen colours, is added to the map and picked", async () => {
  const t = setup({ made: { next: { shape: "oval" } } });
  await t.crests.create();
  assert.equal(t.calls.opened[0].crest.field, 3);
  assert.equal(t.calls.opened[0].crest.field2, 4);
  assert.equal(t.calls.opened[0].crest.outline, 2, "the outline starts as the darkest palette colour");
  assert.equal(t.calls.opened[0].fileName, "My map-crest.png");
  assert.deepEqual(t.calls.added, [{ shape: "oval" }]);
  assert.deepEqual(t.calls.state, [{ crest: 0 }]);
});

test("backing out adds nothing; View mode and a full library never open the maker", async () => {
  const backed = setup();
  await backed.crests.create();
  assert.equal(backed.calls.added.length, 0);

  const viewing = setup({ mode: "view" });
  await viewing.crests.create();
  await viewing.crests.edit(0);
  assert.equal(viewing.calls.opened.length, 0);

  const full = setup();
  full.model.crests = Array.from({ length: MAX_CRESTS }, () => ({}));
  await full.crests.create();
  assert.equal(full.calls.opened.length, 0);
  assert.match(full.calls.said[0], /crest list is full/);
});

test("editing opens the saved crest under its numbered file name and saves the answer over it", async () => {
  const t = setup({ made: { next: { shape: "french" } } });
  t.model.crests = [{ shape: "heater" }, { shape: "oval" }];
  await t.crests.edit(1);
  assert.deepEqual(t.calls.opened[0], { crest: { shape: "oval" }, editing: true, fileName: "My map-crest-2.png" });
  assert.deepEqual(t.calls.updated, [[1, { shape: "french" }]]);
});
