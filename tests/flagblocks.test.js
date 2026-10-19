import test from "node:test";
import assert from "node:assert/strict";
import { flagBlocks, BLOCK_COLS, BLOCK_ROWS } from "../app/flagblocks.js";
import { FLAG_W, FLAG_H, LEGACY_FLAG_SCALE } from "../app/model.js";

const PALETTE = ["#ff0000", "#0000ff"];

test("a plain flag shrinks to one colour in every block, and 24 x 16 blocks come back", () => {
  const blocks = flagBlocks(new Uint8Array(FLAG_W * FLAG_H).fill(1), PALETTE, "#ffffff");
  assert.equal(blocks.length, BLOCK_COLS * BLOCK_ROWS);
  assert.ok(blocks.every((c) => c === "rgb(255,0,0)"));
});

test("a block takes the average of the cells it covers, with 0 as the white colour", () => {
  const design = new Uint8Array(FLAG_W * FLAG_H);
  for (let y = 0; y < LEGACY_FLAG_SCALE; y++) {
    for (let x = 0; x < LEGACY_FLAG_SCALE; x++) design[y * FLAG_W + x] = x < 2 ? 2 : 0;
  }
  const [first, second] = flagBlocks(design, PALETTE, "#ffffff");
  assert.equal(second, "rgb(255,255,255)");
  assert.equal(first, "rgb(153,153,255)", "two blue columns in five average with three white ones");
});

test("a changed palette is noticed for the same design, and a colour outside the palette counts as white", () => {
  const design = new Uint8Array(FLAG_W * FLAG_H).fill(1);
  assert.equal(flagBlocks(design, PALETTE, "#ffffff")[0], "rgb(255,0,0)");
  assert.equal(flagBlocks(design, ["#00ff00"], "#ffffff")[0], "rgb(0,255,0)");
  const stray = new Uint8Array(FLAG_W * FLAG_H).fill(9);
  assert.equal(flagBlocks(stray, PALETTE, "#ffffff")[0], "rgb(255,255,255)");
});
