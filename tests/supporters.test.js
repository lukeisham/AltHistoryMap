import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORTERS, SUPPORTER_W, SUPPORTER_H, BODY, EYE, LINE, rasterSupporter } from "../app/supporters.js";

test("none rasters to nothing and every animal to a body with one eye inside it", () => {
  assert.ok(rasterSupporter("none").every((v) => v === 0));
  for (const { id } of SUPPORTERS.filter((s) => s.id !== "none")) {
    const mask = rasterSupporter(id);
    assert.equal(mask.length, SUPPORTER_W * SUPPORTER_H);
    const body = mask.filter((v) => v === BODY).length;
    assert.ok(body > 120, `${id} is barely drawn (${body} cells)`);
    assert.equal(mask.filter((v) => v === EYE).length, 1, `${id} has no single eye`);
  }
});

test("each animal stays inside its box, touches the ground row and reaches toward the shield side", () => {
  for (const { id } of SUPPORTERS.filter((s) => s.id !== "none")) {
    const mask = rasterSupporter(id);
    const rows = new Set();
    let rightmost = 0;
    mask.forEach((v, i) => {
      if (!v) return;
      rows.add(Math.floor(i / SUPPORTER_W));
      rightmost = Math.max(rightmost, i % SUPPORTER_W);
    });
    assert.ok(rows.has(SUPPORTER_H - 1) || rows.has(SUPPORTER_H - 2), `${id} does not stand on the ground`);
    assert.ok(rightmost >= SUPPORTER_W - 4, `${id} does not reach toward the shield`);
  }
});

const FIGURES = SUPPORTERS.filter((s) => s.id !== "none").map((s) => s.id);

// How many separate runs of figure cells a row holds: two feet or legs read as two.
function runsInRow(mask, y) {
  let runs = 0;
  for (let x = 0; x < SUPPORTER_W; x++) if (mask[y * SUPPORTER_W + x] && !(x > 0 && mask[y * SUPPORTER_W + x - 1])) runs++;
  return runs;
}

function extent(mask) {
  const rows = [];
  const cols = [];
  mask.forEach((v, i) => {
    if (!v) return;
    rows.push(Math.floor(i / SUPPORTER_W));
    cols.push(i % SUPPORTER_W);
  });
  return { height: Math.max(...rows) - Math.min(...rows) + 1, width: Math.max(...cols) - Math.min(...cols) + 1 };
}

test("every drawing is the whole box, uses only body, line and eye cells, and keeps its eye inside the figure", () => {
  for (const id of FIGURES) {
    const { rows } = SUPPORTERS.find((s) => s.id === id);
    assert.equal(rows.length, SUPPORTER_H, id);
    assert.ok(rows.every((row) => row.length === SUPPORTER_W && /^[.#oe]+$/.test(row)), `${id} has a row of the wrong length or an unknown character`);
    const mask = rasterSupporter(id);
    const eye = mask.indexOf(EYE);
    assert.ok(eye >= 0, `${id} has no eye`);
    const neighbours = [eye - 1, eye + 1, eye - SUPPORTER_W, eye + SUPPORTER_W];
    assert.ok(neighbours.every((n) => mask[n]), `${id}'s eye sits on its edge`);
  }
});

test("every figure has detail lines, and stands on at least two separate legs or feet", () => {
  for (const id of FIGURES) {
    const mask = rasterSupporter(id);
    assert.ok(mask.includes(LINE), `${id} has no detail lines`);
    const feet = Math.max(...[53, 54, 55, 56, 57].map((y) => runsInRow(mask, y)));
    assert.ok(feet >= 2, `${id} stands on ${feet} shapes`);
  }
});

test("the soldier is taller and narrower than a lion", () => {
  const soldier = extent(rasterSupporter("soldier"));
  const lion = extent(rasterSupporter("lion"));
  assert.ok(soldier.height > lion.height, "taller");
  assert.ok(soldier.width < lion.width, "narrower");
});

test("an unknown animal is refused", () => {
  assert.throws(() => rasterSupporter("kraken"), RangeError);
});
