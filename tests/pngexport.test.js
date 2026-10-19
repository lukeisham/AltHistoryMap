import test from "node:test";
import assert from "node:assert/strict";
import { drawCells, cellsToPng } from "../app/pngexport.js";
import { TRANSPARENT } from "../app/crestcells.js";
import { fakeDocument } from "./fakedom.js";

function recordingContext() {
  const fills = [];
  const ctx = {
    fillStyle: "",
    fillRect(x, y, w, h) { fills.push({ x, y, w, h, colour: this.fillStyle }); },
  };
  return { ctx, fills };
}

test("drawCells paints each cell in its palette colour, cell 0 white, and leaves transparent cells unpainted", () => {
  const { ctx, fills } = recordingContext();
  drawCells(ctx, Uint8Array.from([1, 0, TRANSPARENT, 2]), 2, ["#ff0000", "#00ff00"], "#ffffff", 10);
  assert.deepEqual(fills, [
    { x: 0, y: 0, w: 10, h: 10, colour: "#ff0000" },
    { x: 10, y: 0, w: 10, h: 10, colour: "#ffffff" },
    { x: 10, y: 10, w: 10, h: 10, colour: "#00ff00" },
  ]);
});

test("drawCells warns and draws white for a colour the palette lacks", () => {
  const { ctx, fills } = recordingContext();
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    drawCells(ctx, Uint8Array.from([5]), 1, ["#ff0000"], "#ffffff", 4);
  } finally {
    console.warn = original;
  }
  assert.equal(fills[0].colour, "#ffffff");
  assert.match(warnings[0], /no colour 5/);
});

test("cellsToPng sizes the picture from the grid and the cell size, and gives back a PNG blob", async () => {
  const doc = fakeDocument();
  const blob = await cellsToPng({ cells: new Uint8Array(24 * 16), cols: 24, palette: [], white: "#fff", cell: 16, doc });
  assert.equal(blob.type, "image/png");
  assert.equal(await blob.text(), "png 384x256");
});
