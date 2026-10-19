import test from "node:test";
import assert from "node:assert/strict";
import { createCountries } from "../app/countries.js";

function setup({ mode = "edit", paint = 3, saved = true, result = null } = {}) {
  const calls = { opened: [], set: [], said: [] };
  const model = { n: 4, palette: ["#b5473b", "#c98b2b", "#5c8a4d"], countries: [{ colour: 3, name: "Aurea" }], planes: { political: new Uint8Array(16).fill(paint) } };
  const facts = { open: async (start) => (calls.opened.push(start), result) };
  const editor = { editGate: () => mode === "edit", setCountry: (colour, patch) => (calls.set.push([colour, patch]), saved) };
  return { countries: createCountries({ facts, model, editor, say: (text) => calls.said.push(text) }), calls };
}

const PIXEL = { x: 1, y: 1, inside: true };

test("opening a colour passes its record and name, and saves the facts that come back", async () => {
  const t = setup({ result: { name: "Bora" } });
  await t.countries.open(3);
  assert.equal(t.calls.opened[0].name, "Aurea");
  assert.equal(t.calls.opened[0].editable, true);
  assert.deepEqual(t.calls.set, [[3, { name: "Bora" }]]);
  const viewing = setup({ mode: "view" });
  await viewing.countries.open(1);
  assert.equal(viewing.calls.opened[0].editable, false);
  assert.equal(viewing.calls.opened[0].name, "Brick red");
  assert.deepEqual(viewing.calls.set, [], "a pop-up closed without facts saves nothing");
});

test("a crest dropped on painted land goes to the country under it; sea and View mode give nothing", () => {
  const t = setup();
  t.countries.dropOnLand(PIXEL, { kind: "crest", crest: 1 });
  assert.deepEqual(t.calls.set, [[3, { crest: 1 }]]);
  assert.match(t.calls.said[0], /Aurea now has crest 2/);

  const sea = setup({ paint: 0 });
  sea.countries.dropOnLand(PIXEL, { kind: "crest", crest: 0 });
  assert.deepEqual(sea.calls.set, []);
  assert.match(sea.calls.said[0], /painted land/);

  const viewing = setup({ mode: "view" });
  viewing.countries.dropOnLand(PIXEL, { kind: "crest", crest: 0 });
  viewing.countries.dropOnColour(2, { kind: "crest", crest: 0 });
  assert.deepEqual(viewing.calls.set, []);
});

test("a crest or flag design dropped on a colour is linked; the plain flag is refused", () => {
  const t = setup();
  t.countries.dropOnColour(2, { kind: "flag", design: 0 });
  t.countries.dropOnColour(2, { kind: "crest", crest: 3 });
  t.countries.dropOnColour(2, { kind: "flag", design: -1 });
  assert.deepEqual(t.calls.set, [[2, { flag: 0 }], [2, { crest: 3 }]]);
  assert.match(t.calls.said.at(-1), /not the plain flag/);
});

test("showAt opens the pop-up only over painted land", () => {
  const t = setup();
  assert.equal(t.countries.showAt(PIXEL), true);
  assert.equal(t.calls.opened.length, 1);
  assert.equal(setup({ paint: 0 }).countries.showAt(PIXEL), false);
  assert.equal(t.countries.showAt({ x: 0, y: 0, inside: false }), false);
});
