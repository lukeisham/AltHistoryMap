import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORTERS, SUPPORTER_W, SUPPORTER_H, BODY, EYE, rasterSupporter } from "../app/supporters.js";

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

test("an unknown animal is refused", () => {
  assert.throws(() => rasterSupporter("kraken"), RangeError);
});
