import test from "node:test";
import assert from "node:assert/strict";
import { coloursTouch, createRelations, nearestCapitalColour } from "../app/relations.js";

const N = 6;
// Colour 1 on the left, colour 2 on the right with a gap of sea (0) between, colour 3 touching colour 1 along the bottom.
const GRID = [
  1, 1, 0, 0, 2, 2,
  1, 1, 0, 0, 2, 2,
  1, 1, 0, 0, 2, 2,
  3, 3, 0, 0, 0, 0,
  3, 3, 0, 0, 0, 0,
  3, 3, 0, 0, 0, 0,
];
const capital = (nation, x, y) => ({ capital: true, nation, x, y });

function setup({ mode = "edit", markers = [capital(1, 0, 0)], countries = [], menuChoice = null, saved = true } = {}) {
  const calls = { menus: [], set: [], said: [] };
  const model = { n: N, palette: ["#b5473b", "#c98b2b", "#5c8a4d"], countries, markers, planes: { political: Uint8Array.from(GRID) } };
  const menu = { choose: async (request) => (calls.menus.push(request), menuChoice) };
  const editor = { editGate: () => mode === "edit", setCountry: (colour, patch) => (calls.set.push([colour, patch]), saved) };
  return { relations: createRelations({ model, editor, menu, say: (text) => calls.said.push(text) }), calls };
}

const at = (x, y) => ({ x, y, inside: true });
const SCREEN = { x: 10, y: 20 };

test("the nearest capital's colour is found, skipping the clicked colour and capitals standing for nothing", () => {
  const markers = [capital(1, 0, 0), capital(3, 5, 5), { capital: true, nation: 0, x: 4, y: 0 }, { capital: false, nation: 2, x: 4, y: 1 }];
  assert.equal(nearestCapitalColour(markers, 4, 0, 2), 1);
  assert.equal(nearestCapitalColour(markers, 5, 4, 2), 3);
  assert.equal(nearestCapitalColour(markers, 5, 4, 3), 1, "the clicked colour's own capital is ignored");
  assert.equal(nearestCapitalColour([], 0, 0, 2), 0);
});

test("two colours touch only along a shared edge, not across sea or at a corner", () => {
  const political = Uint8Array.from(GRID);
  assert.equal(coloursTouch(political, N, 1, 3), true);
  assert.equal(coloursTouch(political, N, 3, 1), true);
  assert.equal(coloursTouch(political, N, 1, 2), false);
  const corner = new Uint8Array(4).fill(0);
  corner[0] = 1;
  corner[3] = 2;
  assert.equal(coloursTouch(corner, 2, 1, 2), false);
});

test("right-clicking a colour that does not touch the capital's colour offers the three kinds, and the choice is saved with that overlord", async () => {
  const t = setup({ menuChoice: "dominion" });
  assert.equal(await t.relations.menuAt(at(4, 1), SCREEN), true);
  const request = t.calls.menus[0];
  assert.deepEqual(request.options.map((option) => option.id), ["client", "dominion", "colony"]);
  assert.deepEqual([request.x, request.y], [10, 20]);
  assert.match(request.title, /answers to/);
  assert.deepEqual(t.calls.set, [[2, { relation: "dominion", overlord: 1 }]]);
});

test("a colour that touches the capital's colour is refused with the reason, and sea or View mode opens nothing", async () => {
  const touching = setup({ menuChoice: "client" });
  await touching.relations.menuAt(at(0, 4), SCREEN);
  assert.deepEqual(touching.calls.menus, []);
  assert.match(touching.calls.said[0], /touches/);
  assert.deepEqual(touching.calls.set, []);

  const sea = setup();
  assert.equal(await sea.relations.menuAt(at(2, 2), SCREEN), false);
  assert.deepEqual(sea.calls.menus, []);

  const viewing = setup({ mode: "view", menuChoice: "client" });
  assert.equal(await viewing.relations.menuAt(at(4, 1), SCREEN), true);
  assert.deepEqual([viewing.calls.menus, viewing.calls.set], [[], []], "View mode cannot change a relationship");
});

test("with no capital the person is told to make one, and a loop of overlords is refused", async () => {
  const none = setup({ markers: [] });
  await none.relations.menuAt(at(4, 1), SCREEN);
  assert.match(none.calls.said[0], /capital/);
  assert.deepEqual(none.calls.menus, []);

  const loop = setup({ countries: [{ colour: 1, relation: "client", overlord: 2 }], markers: [capital(1, 0, 0)] });
  await loop.relations.menuAt(at(4, 1), SCREEN);
  assert.match(loop.calls.said[0], /loop/);
  assert.deepEqual(loop.calls.set, []);
});

test("a country with a relationship can always be set back to None, and a backed-out menu saves nothing", async () => {
  const related = setup({ countries: [{ colour: 2, relation: "colony", overlord: 1 }], menuChoice: "none" });
  await related.relations.menuAt(at(4, 1), SCREEN);
  assert.deepEqual(related.calls.menus[0].options.map((option) => [option.id, option.current]), [["client", false], ["dominion", false], ["colony", true], ["none", false]]);
  assert.deepEqual(related.calls.set, [[2, { relation: "", overlord: 0 }]]);

  const blocked = setup({ markers: [], countries: [{ colour: 2, relation: "colony", overlord: 1 }], menuChoice: null });
  await blocked.relations.menuAt(at(4, 1), SCREEN);
  assert.deepEqual(blocked.calls.menus[0].options.map((option) => option.id), ["none"], "no kind is offered while the tie cannot be made");
  assert.deepEqual(blocked.calls.set, []);
});
