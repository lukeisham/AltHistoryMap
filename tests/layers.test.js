import test from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_VIEWS, isAllowedView, soloView, toggleLayer, settleLayers, lookFor, layersOnScreen } from "../app/layers.js";
import { LAYERS } from "../app/model.js";

test("every sequence of toggles stays inside the five allowed views, and reaches all five", () => {
  const key = (view) => view.join("+");
  const reached = new Set();
  const moves = LAYERS.flatMap((layer) => [[layer, true], [layer, false]]);
  let frontier = ALLOWED_VIEWS.map((view) => view);
  for (let depth = 0; depth < 6; depth++) {
    const next = [];
    for (const view of frontier) {
      for (const [layer, shown] of moves) {
        const result = toggleLayer(view, layer, shown).view;
        assert.ok(isAllowedView(result), `${key(view)} + ${layer} ${shown} gave ${key(result)}`);
        assert.ok(result.length > 0);
        assert.ok(!(result.includes("political") && result.includes("culture")));
        reached.add(key(result));
        next.push(result);
      }
    }
    frontier = next.filter((view, i) => next.findIndex((other) => key(other) === key(view)) === i);
  }
  assert.deepEqual([...reached].sort(), ALLOWED_VIEWS.map(key).sort());
});

test("a switch that drops a layer says so; one that drops nothing says nothing", () => {
  assert.equal(toggleLayer(["political", "conflict"], "culture", true).note, "Political hidden: Culture never shares a view with it.");
  assert.deepEqual(toggleLayer(["political", "conflict"], "culture", true).view, ["conflict", "culture"]);
  assert.equal(toggleLayer(["conflict", "culture"], "political", true).note, "Culture hidden: it never shares a view with Political.");
  assert.deepEqual(toggleLayer(["conflict", "culture"], "political", true).view, ["political", "conflict"]);
  assert.equal(toggleLayer(["political"], "conflict", true).note, "");
  assert.deepEqual(toggleLayer(["political"], "political", false).view, ["political"], "the last layer stays on");
});

test("settleLayers repairs a disallowed view and keeps the edited layer on screen in View mode", () => {
  assert.deepEqual(settleLayers("view", "culture", ["political", "culture"]), { layer: "culture", view: ["culture"] });
  assert.deepEqual(settleLayers("view", "political", ["conflict", "culture"]), { layer: "conflict", view: ["conflict", "culture"] });
  assert.deepEqual(settleLayers("edit", "political", ["conflict", "culture"]), { layer: "political", view: ["conflict", "culture"] });
});

test("the look follows the mode: Edit shows one layer, Culture over faded Political", () => {
  assert.equal(lookFor({ mode: "view", layer: "political", view: ["political", "conflict"] }), "political+conflict");
  assert.equal(lookFor({ mode: "view", layer: "conflict", view: soloView("conflict") }), "conflict");
  assert.equal(lookFor({ mode: "edit", layer: "culture", view: ["political"] }), "editCulture");
  assert.equal(lookFor({ mode: "edit", layer: "conflict", view: ["political"] }), "conflict");
  assert.deepEqual(layersOnScreen("conflict+culture"), ["conflict", "culture"]);
  assert.deepEqual(layersOnScreen("editCulture"), ["culture"]);
});
