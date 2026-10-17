import test from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_VIEWS, isAllowedView, soloView, toggleLayer, settleLayers, lookFor, layersOnScreen, layersDrawn } from "../app/layers.js";
import { LAYERS } from "../app/model.js";

test("every sequence of toggles stays inside the allowed views, and reaches all of them", () => {
  const key = (view) => view.join("+");
  const reached = new Set();
  const moves = LAYERS.flatMap((layer) => [[layer, true], [layer, false]]);
  let frontier = ALLOWED_VIEWS.map((view) => view);
  for (let depth = 0; depth < 4; depth++) {
    const next = [];
    for (const view of frontier) {
      for (const [layer, shown] of moves) {
        const result = toggleLayer(view, layer, shown).view;
        assert.ok(isAllowedView(result), `${key(view)} + ${layer} ${shown} gave ${key(result)}`);
        assert.equal(result.length, 1);
        reached.add(key(result));
        next.push(result);
      }
    }
    frontier = next.filter((view, i) => next.findIndex((other) => key(other) === key(view)) === i);
  }
  assert.deepEqual([...reached].sort(), ALLOWED_VIEWS.map(key).sort());
});

test("a switch that drops a layer says so; one that drops nothing says nothing", () => {
  assert.equal(toggleLayer(["political"], "province", true).note, "Political hidden: Province never shares a view.");
  assert.deepEqual(toggleLayer(["political"], "province", true).view, ["province"]);
  assert.equal(toggleLayer(["culture"], "political", true).note, "Culture hidden: Political never shares a view.");
  assert.equal(toggleLayer(["political"], "political", true).note, "");
  assert.deepEqual(toggleLayer(["political"], "political", false).view, ["political"], "the last layer stays on");
});

test("settleLayers repairs a disallowed view and keeps the edited layer on screen in View mode", () => {
  assert.deepEqual(settleLayers("view", "culture", ["political", "culture"]), { layer: "culture", view: ["culture"] });
  assert.deepEqual(settleLayers("view", "political", ["province"]), { layer: "province", view: ["province"] });
  assert.deepEqual(settleLayers("edit", "political", ["province"]), { layer: "political", view: ["province"] });
});

test("the look follows the layer: only Culture edits over faded Political", () => {
  assert.equal(lookFor({ mode: "view", layer: "political", view: ["political"] }), "political");
  assert.equal(lookFor({ mode: "view", layer: "province", view: soloView("province") }), "province");
  assert.equal(lookFor({ mode: "edit", layer: "culture", view: ["political"] }), "editCulture");
  assert.equal(lookFor({ mode: "edit", layer: "province", view: ["political"] }), "province");
  assert.deepEqual(layersOnScreen("province"), ["province"]);
  assert.deepEqual(layersOnScreen("editCulture"), ["culture"]);
  assert.deepEqual(layersDrawn("province"), ["province"]);
  assert.deepEqual(layersDrawn("culture"), ["culture"]);
});
