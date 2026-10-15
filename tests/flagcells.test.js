import test from "node:test";
import assert from "node:assert/strict";
import { FLAG_W, FLAG_H } from "../app/model.js";
import {
  blankCells, setCell, starterLayout, floodFill, mirrorWrite, pencilLine,
} from "../app/flagcells.js";

const at = (cells, x, y) => cells[y * FLAG_W + x];
const count = (cells, v) => cells.reduce((n, c) => n + (c === v ? 1 : 0), 0);

test("blankCells is all white and setCell copies", () => {
  const blank = blankCells();
  assert.equal(blank.length, FLAG_W * FLAG_H);
  const next = setCell(blank, 3, 4, 5);
  assert.equal(at(next, 3, 4), 5);
  assert.equal(at(blank, 3, 4), 0);
  assert.throws(() => setCell(blank, FLAG_W, 0, 1), RangeError);
});

test("starter layouts put the colours where a flag has them", () => {
  assert.equal(count(starterLayout("plain", 3, 4), 3), FLAG_W * FLAG_H);

  const h = starterLayout("stripes-h", 1, 2);
  assert.deepEqual([at(h, 5, 0), at(h, 5, 8), at(h, 5, 15)], [1, 2, 1]);

  const v = starterLayout("stripes-v", 1, 2);
  assert.deepEqual([at(v, 0, 5), at(v, 12, 5), at(v, 23, 5)], [1, 2, 1]);

  const cross = starterLayout("cross", 1, 2);
  assert.deepEqual([at(cross, 7, 0), at(cross, 0, 8), at(cross, 0, 0), at(cross, 20, 3)], [2, 2, 1, 1]);

  const saltire = starterLayout("saltire", 1, 2);
  const corners = [at(saltire, 0, 0), at(saltire, 23, 15), at(saltire, 23, 0), at(saltire, 0, 15)];
  assert.deepEqual(corners, [2, 2, 2, 2]);
  assert.deepEqual([at(saltire, 12, 0), at(saltire, 0, 8)], [1, 1]);
  assert.throws(() => starterLayout("chevron", 1, 2), RangeError);
});

test("floodFill stops at different values and leaves its input alone", () => {
  let cells = blankCells();
  for (let y = 0; y < FLAG_H; y++) cells = setCell(cells, 10, y, 7);
  const filled = floodFill(cells, 0, 0, 3);
  assert.equal(at(filled, 9, 15), 3);
  assert.equal(at(filled, 10, 5), 7);
  assert.equal(at(filled, 11, 5), 0);
  assert.equal(count(filled, 3), 10 * FLAG_H);
  assert.equal(count(cells, 3), 0);
});

test("floodFill is 4-connected: a diagonal gap does not leak", () => {
  let cells = blankCells();
  cells = setCell(cells, 1, 0, 9);
  cells = setCell(cells, 0, 1, 9);
  const filled = floodFill(cells, 0, 0, 4);
  assert.equal(at(filled, 0, 0), 4);
  assert.equal(at(filled, 1, 1), 0);
});

test("mirrorWrite writes the cell and its left-right mirror", () => {
  const out = mirrorWrite(blankCells(), 2, 5, 6);
  assert.equal(at(out, 2, 5), 6);
  assert.equal(at(out, 21, 5), 6);
  assert.equal(count(out, 6), 2);
});

test("pencilLine leaves no gap and honours mirror", () => {
  const out = pencilLine(blankCells(), 0, 0, 20, 3, 2, false);
  for (let x = 0; x <= 20; x++) {
    let hits = 0;
    for (let y = 0; y < FLAG_H; y++) if (at(out, x, y) === 2) hits++;
    assert.ok(hits >= 1, `column ${x} has a painted cell`);
  }
  assert.equal(at(out, 0, 0), 2);
  assert.equal(at(out, 20, 3), 2);

  const mirrored = pencilLine(blankCells(), 0, 0, 5, 0, 1, true);
  assert.equal(count(mirrored, 1), 12);
  assert.equal(at(mirrored, 23, 0), 1);
});
