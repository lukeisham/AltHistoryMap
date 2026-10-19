import test from "node:test";
import assert from "node:assert/strict";
import { createFlagZoom, ZOOM_CELL } from "../app/flagzoom.js";
import { FLAG_W, FLAG_H } from "../app/model.js";
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

test("the enlarged picture is the whole flag grid at ZOOM_CELL pixels per cell, shown beside the pointer and hidden again", () => {
  const t = setup();
  assert.equal(t.canvas.style.width, `${FLAG_W * ZOOM_CELL}px`);
  assert.equal(t.canvas.style.height, `${FLAG_H * ZOOM_CELL}px`);
  t.zoom.show({ cells: new Uint8Array(FLAG_W * FLAG_H).fill(1), colour: "#ff0000", x: 100, y: 100 });
  assert.equal(t.box.hidden, false);
  assert.deepEqual([t.props["--at-x"], t.props["--at-y"]], ["116", "116"]);
  t.zoom.hide();
  assert.equal(t.box.hidden, true);
});

test("near the window's right or bottom edge the picture flips to the other side of the pointer", () => {
  const t = setup();
  t.zoom.show({ cells: null, colour: "#ff0000", x: 950, y: 790 });
  assert.equal(t.props["--at-x"], String(950 - 16 - FLAG_W * ZOOM_CELL));
  assert.equal(t.props["--at-y"], String(790 - 16 - FLAG_H * ZOOM_CELL));
  t.zoom.show({ cells: null, colour: "#ff0000", x: 5, y: 5 });
  assert.equal(t.props["--at-x"], "21");
});
