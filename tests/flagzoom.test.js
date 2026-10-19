import test from "node:test";
import assert from "node:assert/strict";
import { createFlagZoom, ZOOM_CELL } from "../app/flagzoom.js";
import { fakeDocument } from "./fakedom.js";

function setup() {
  const doc = fakeDocument();
  const box = doc.createElement("div");
  box.hidden = true;
  const props = {};
  box.style = { setProperty: (name, value) => (props[name] = value) };
  const canvas = doc.createElement("canvas");
  box.append(canvas);
  const zoom = createFlagZoom({ box, canvas, getPalette: () => ["#ff0000"] });
  return { zoom, box, canvas, props };
}

test("the enlarged picture is 24 x 16 cells at ZOOM_CELL pixels, shown beside the pointer and hidden again", () => {
  const t = setup();
  assert.equal(t.canvas.style.width, `${24 * ZOOM_CELL}px`);
  assert.equal(t.canvas.style.height, `${16 * ZOOM_CELL}px`);
  t.zoom.show({ cells: new Uint8Array(384).fill(1), colour: "#ff0000", x: 100, y: 100 });
  assert.equal(t.box.hidden, false);
  assert.deepEqual([t.props["--at-x"], t.props["--at-y"]], ["116", "116"]);
  t.zoom.hide();
  assert.equal(t.box.hidden, true);
});

test("near the window's right or bottom edge the picture flips to the other side of the pointer", () => {
  const t = setup();
  t.zoom.show({ cells: null, colour: "#ff0000", x: 950, y: 790 });
  assert.equal(t.props["--at-x"], String(950 - 16 - 24 * ZOOM_CELL));
  assert.equal(t.props["--at-y"], String(790 - 16 - 16 * ZOOM_CELL));
  t.zoom.show({ cells: null, colour: "#ff0000", x: 5, y: 5 });
  assert.equal(t.props["--at-x"], "21");
});
