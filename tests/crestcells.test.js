import test from "node:test";
import assert from "node:assert/strict";
import {
  CREST_W, CREST_H, TRANSPARENT, SHAPES, DIVISIONS, ORDINARIES, CHARGES,
  defaultCrest, normaliseCrest, renderCrest,
} from "../app/crestcells.js";
import { stampCrest } from "../app/flagcells.js";

const crest = (over = {}) => ({ ...defaultCrest(1, 2), outline: 3, ordinaryColour: 4, chargeColour: 5, ...over });
const at = (cells, x, y) => cells[y * CREST_W + x];

test("every shield is one non-empty, left-right symmetric shape that touches the box and has an outline on its whole rim", () => {
  for (const { id } of SHAPES) {
    const cells = renderCrest(crest({ shape: id, outline: 9 }));
    const inside = (x, y) => at(cells, x, y) !== TRANSPARENT;
    assert.ok(cells.some((v) => v !== TRANSPARENT), `${id} is empty`);
    for (let y = 0; y < CREST_H; y++) {
      for (let x = 0; x < CREST_W; x++) {
        assert.equal(inside(x, y), inside(CREST_W - 1 - x, y), `${id} is not symmetric at ${x},${y}`);
        if (!inside(x, y)) continue;
        const open = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => nx < 0 || ny < 0 || nx >= CREST_W || ny >= CREST_H || !inside(nx, ny));
        assert.equal(at(cells, x, y) === 9, open, `${id} rim at ${x},${y}`);
      }
    }
  }
});

test("every division, ordinary and charge draws something of its own colour inside the outline and never outside the shield", () => {
  const plain = renderCrest(crest({ field: 1, field2: 2 }));
  for (const { id } of DIVISIONS.filter((d) => d.id !== "plain")) {
    assert.ok(renderCrest(crest({ division: id })).includes(2), `division ${id} never uses the second colour`);
  }
  for (const { id } of ORDINARIES.filter((o) => o.id !== "none")) {
    assert.ok(renderCrest(crest({ ordinary: id, ordinaryColour: 5 })).includes(5), `ordinary ${id} is invisible`);
  }
  for (const { id } of CHARGES.filter((c) => c.id !== "none")) {
    const cells = renderCrest(crest({ charge: id, chargeColour: 6 }));
    assert.ok(cells.includes(6), `charge ${id} is invisible`);
    cells.forEach((v, i) => {
      if (plain[i] === TRANSPARENT) assert.equal(v, TRANSPARENT, `charge ${id} spilled outside the shield at ${i}`);
    });
  }
});

test("charge bitmaps are rectangular with an even width, so they centre on the 12-cell shield", () => {
  for (const { id, rows, w, h } of CHARGES.filter((c) => c.id !== "none")) {
    assert.equal(w % 2, 0, `${id} has an odd width`);
    assert.ok(rows.every((row) => row.length === w), `${id} has ragged rows`);
    assert.ok(h <= 8 && w <= 8, `${id} is too big for the shield`);
  }
});

test("normaliseCrest keeps a good crest and refuses unknown parts, bad colours and non-objects", () => {
  const good = crest({ ordinary: "chevron" });
  assert.deepEqual(normaliseCrest({ ...good, extra: "ignored" }, 8), good);
  assert.equal(normaliseCrest({ ...good, shape: "kite" }, 8), null);
  assert.equal(normaliseCrest({ ...good, field: -1 }, 8), null);
  assert.equal(normaliseCrest({ ...good, field: 0 }, 8).field, 0, "0 is white");
  assert.equal(normaliseCrest({ ...good, outline: 9 }, 8), null);
  assert.equal(normaliseCrest({ ...good, field: 1.5 }, 8), null);
  assert.equal(normaliseCrest(null, 8), null);
  assert.equal(normaliseCrest([good], 8), null);
});

test("renderCrest refuses an unknown part and a colour that is not a palette index", () => {
  assert.throws(() => renderCrest(crest({ division: "swirl" })), RangeError);
  assert.throws(() => renderCrest(crest({ field: -1 })), RangeError);
  assert.throws(() => renderCrest(crest({ outline: 255 })), RangeError);
});

test("stampCrest centres the crest, leaves transparent cells alone, clips at the flag's edge and never changes its input", () => {
  const flag = new Uint8Array(24 * 16).fill(7);
  const cells = renderCrest(crest({ shape: "oval", charge: "none", field: 1, field2: 1, outline: 1 }));
  const out = stampCrest(flag, cells, 12, 8);
  assert.equal(out[8 * 24 + 12], 1);
  assert.equal(out[1 * 24 + 6], 7, "the crest's transparent top-left corner is not stamped");
  assert.equal(flag[8 * 24 + 12], 7);
  const corner = stampCrest(flag, cells, 0, 0);
  assert.equal(corner[0], 1, "a crest at the corner still draws its visible part");
  assert.equal(corner.length, 384);
  assert.throws(() => stampCrest(new Uint8Array(10), cells, 0, 0), RangeError);
});
