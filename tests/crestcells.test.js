import test from "node:test";
import assert from "node:assert/strict";
import {
  CREST_W, CREST_H, SHIELD_W, SHIELD_H, SHIELD_X, SHIELD_Y, TRANSPARENT, SHAPES, DIVISIONS, ORDINARIES, CHARGES, SUPPORTERS,
  defaultCrest, normaliseCrest, renderCrest, renderShieldOnly, FACINGS, COMPARTMENTS, RIBBONS,
} from "../app/crestcells.js";
import { SUPPORTER_W, LINE, rasterSupporter } from "../app/supporters.js";
import { stampCrest } from "../app/flagcells.js";
import { FLAG_W, FLAG_H } from "../app/model.js";

const NO_SUPPORTERS = { supporterLeft: "none", supporterRight: "none" };
const crest = (over = {}) => ({ ...defaultCrest(1, 2), ...NO_SUPPORTERS, outline: 3, ordinaryColour: 4, chargeColour: 5, ...over });
const at = (cells, x, y) => cells[y * CREST_W + x];

test("every shield is one non-empty, left-right symmetric shape that sits in its box and has an outline on its whole rim", () => {
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

test("charge bitmaps are rectangular with an even width, so they centre on the shield", () => {
  for (const { id, rows, w, h } of CHARGES.filter((c) => c.id !== "none")) {
    assert.equal(w % 2, 0, `${id} has an odd width`);
    assert.ok(rows.every((row) => row.length === w), `${id} has ragged rows`);
    assert.ok(h <= (SHIELD_H * 2) / 3 && w <= (SHIELD_W * 2) / 3, `${id} is too big for the shield`);
  }
});

test("the shield sits low and central between the supporters, so their heads stand clear above it", () => {
  assert.equal(SHIELD_X * 2 + SHIELD_W, CREST_W);
  assert.ok(SHIELD_Y + SHIELD_H <= CREST_H);
  const both = renderCrest(crest({ supporterLeft: "lion", supporterRight: "lion", supporterLeftColour: 6, supporterRightColour: 6 }));
  const above = both.slice(0, SHIELD_Y * CREST_W);
  assert.ok(above.some((v) => v === 6), "a lion's head reaches above the shield");
});

test("a supporter on each side draws in its own colour, and the same animal both sides gives a left-right mirror image", () => {
  const pair = renderCrest(crest({ supporterLeft: "stag", supporterRight: "stag", supporterLeftColour: 6, supporterRightColour: 6 }));
  for (let y = 0; y < CREST_H; y++) {
    for (let x = 0; x < CREST_W; x++) assert.equal(pair[y * CREST_W + x], pair[y * CREST_W + CREST_W - 1 - x], `asymmetric at ${x},${y}`);
  }
  const leftOnly = renderCrest(crest({ supporterLeft: "bear", supporterLeftColour: 7 }));
  const half = (cells, from, to) => cells.some((v, i) => v === 7 && i % CREST_W >= from && i % CREST_W < to);
  assert.ok(half(leftOnly, 0, CREST_W / 2), "the left animal is on the left");
  assert.ok(!half(leftOnly, CREST_W / 2, CREST_W), "nothing is drawn on the right");
});

test("every supporter draws something, with its eye in the outline colour, and the shield stays on top of it", () => {
  for (const { id } of SUPPORTERS.filter((s) => s.id !== "none")) {
    const cells = renderCrest(crest({ supporterLeft: id, supporterLeftColour: 6, outline: 9 }));
    assert.ok(cells.includes(6), `${id} is invisible`);
    const shieldOnly = renderCrest(crest({ outline: 9 }));
    for (let y = 0; y < SHIELD_H; y++) {
      for (let x = 0; x < SHIELD_W; x++) {
        const i = (SHIELD_Y + y) * CREST_W + SHIELD_X + x;
        if (shieldOnly[i] !== TRANSPARENT) assert.equal(cells[i], shieldOnly[i], `${id} covers the shield at ${x},${y}`);
      }
    }
  }
});

test("a supporter's detail lines are painted in the outline colour, and the rest of its body in its own colour", () => {
  const mask = rasterSupporter("soldier");
  const cells = renderCrest(crest({ supporterLeft: "soldier", supporterLeftColour: 6, outline: 9 }));
  const cellAt = (i) => cells[Math.floor(i / SUPPORTER_W) * CREST_W + (i % SUPPORTER_W)];
  const lines = Array.from(mask, (v, i) => (v === LINE ? i : -1)).filter((i) => i >= 0);
  assert.ok(lines.length > 0);
  assert.ok(lines.every((i) => cellAt(i) === 9));
  assert.ok(cells.includes(6), "the body is in the supporter's colour");
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

test("normaliseCrest gives a crest saved before supporters existed none, and refuses an unknown animal or a bad colour", () => {
  const { supporterLeft, supporterRight, supporterLeftColour, supporterRightColour, ...old } = crest();
  const clean = normaliseCrest(old, 8);
  assert.equal(clean.supporterLeft, "none");
  assert.equal(clean.supporterRight, "none");
  assert.equal(clean.supporterLeftColour, old.chargeColour);
  assert.equal(normaliseCrest(crest({ supporterLeft: "kraken" }), 8), null);
  assert.equal(normaliseCrest(crest({ supporterRightColour: 9 }), 8), null);
  assert.deepEqual(renderCrest(old), renderCrest(crest()), "an old crest draws with no supporters");
});

test("renderCrest refuses an unknown part and a colour that is not a palette index", () => {
  assert.throws(() => renderCrest(crest({ division: "swirl" })), RangeError);
  assert.throws(() => renderCrest(crest({ field: -1 })), RangeError);
  assert.throws(() => renderCrest(crest({ outline: 255 })), RangeError);
});

test("stampCrest centres the crest, leaves transparent cells alone, clips at the flag's edge and never changes its input", () => {
  const flag = new Uint8Array(FLAG_W * FLAG_H).fill(7);
  const cells = renderCrest(crest({ shape: "oval", charge: "none", field: 1, field2: 1, outline: 1 }));
  const cx = FLAG_W / 2;
  const cy = FLAG_H / 2;
  const out = stampCrest(flag, cells, cx, cy);
  assert.equal(out[cy * FLAG_W + cx], 1);
  assert.equal(out[(cy - CREST_H / 2) * FLAG_W + cx - CREST_W / 2], 7, "the crest's transparent top-left corner is not stamped");
  assert.equal(flag[cy * FLAG_W + cx], 7);
  const corner = stampCrest(flag, cells, SHIELD_X + SHIELD_W / 2 - 1, SHIELD_Y + SHIELD_H / 2 - 1);
  assert.equal(corner[0], 7, "the transparent surround is not stamped at the flag's corner");
  assert.ok(corner.includes(1), "the visible part of a crest at the corner is still drawn");
  assert.equal(corner.length, FLAG_W * FLAG_H);
  assert.throws(() => stampCrest(new Uint8Array(10), cells, 0, 0), RangeError);
});

test("renderShieldOnly draws the shield alone, centred in the crest frame, whatever the supporters", () => {
  const withAnimals = crest({ supporterLeft: "lion", supporterRight: "stag", supporterLeftColour: 6, supporterRightColour: 7 });
  const cells = renderShieldOnly(withAnimals);
  assert.ok(!cells.includes(6) && !cells.includes(7), "no supporter cell is drawn");
  const top = (CREST_H - SHIELD_H) / 2;
  const left = (CREST_W - SHIELD_W) / 2;
  const shield = renderCrest(crest());
  for (let y = 0; y < SHIELD_H; y++) {
    for (let x = 0; x < SHIELD_W; x++) {
      assert.equal(at(cells, left + x, top + y), at(shield, SHIELD_X + x, SHIELD_Y + y), `shield differs at ${x},${y}`);
    }
  }
  assert.equal(cells.filter((v) => v !== TRANSPARENT).length, shield.filter((v) => v !== TRANSPARENT).length);
});

test("a supporter facing outward is the mirror image of the same supporter facing inward, on each side", () => {
  for (const side of ["Left", "Right"]) {
    const inward = renderCrest(crest({ [`supporter${side}`]: "lion", [`supporter${side}Colour`]: 6 }));
    const outward = renderCrest(crest({ [`supporter${side}`]: "lion", [`supporter${side}Colour`]: 6, [`supporter${side}Facing`]: "outward" }));
    assert.notDeepEqual(inward, outward, `${side} outward draws differently`);
    const from = side === "Left" ? 0 : CREST_W - SUPPORTER_W;
    const covered = SUPPORTER_W - SHIELD_X;
    for (let y = 0; y < CREST_H; y++) {
      // The shield covers some columns of the animal's box on the shield side, so only the columns clear of it on both sides are compared.
      for (let x = covered; x < SUPPORTER_W - covered; x++) {
        assert.equal(at(outward, from + x, y), at(inward, from + SUPPORTER_W - 1 - x, y), `${side} ${x},${y}`);
      }
    }
  }
});

test("a mound sits along the bottom of the frame under the supporters, and a ribbon between them, each in its own colour with the outline round it", () => {
  const mound = renderCrest(crest({ compartment: "mound", compartmentColour: 6, outline: 9 }));
  const ribbon = renderCrest(crest({ ribbon: "ribbon", ribbonColour: 7, outline: 9 }));
  assert.ok(mound.includes(6) && mound.includes(9), "the mound has a body and an outline");
  assert.ok(ribbon.includes(7) && ribbon.includes(9), "the ribbon has a body and an outline");
  assert.notEqual(at(mound, CREST_W / 2, CREST_H - 1), TRANSPARENT, "the mound reaches the bottom edge at the middle");
  assert.equal(at(mound, 0, CREST_H - 5), TRANSPARENT, "the mound narrows toward its top");
  const bare = renderCrest(crest());
  for (let x = 0; x < CREST_W; x++) {
    assert.equal(at(mound, x, 0), at(bare, x, 0), "nothing above the mound changes");
    assert.equal(at(ribbon, x, CREST_H - 1), at(bare, x, CREST_H - 1), "nothing below the ribbon changes");
  }
});

test("the shield stays on top of the mound and the ribbon, and a mound is drawn behind the supporters", () => {
  const both = renderCrest(crest({ compartment: "mound", ribbon: "ribbon", compartmentColour: 6, ribbonColour: 7, outline: 9 }));
  const shield = renderCrest(crest({ outline: 9 }));
  for (let y = 0; y < SHIELD_H; y++) {
    for (let x = 0; x < SHIELD_W; x++) {
      const i = (SHIELD_Y + y) * CREST_W + SHIELD_X + x;
      if (shield[i] !== TRANSPARENT) assert.equal(both[i], shield[i], `covered at ${x},${y}`);
    }
  }
  const animal = crest({ supporterLeft: "lion", supporterLeftColour: 5, outline: 9 });
  const withMound = renderCrest({ ...animal, compartment: "mound", compartmentColour: 6 });
  const lionCells = renderCrest(animal);
  for (let i = 0; i < lionCells.length; i++) {
    if (lionCells[i] !== TRANSPARENT) assert.equal(withMound[i], lionCells[i], `the mound covers the lion at ${i}`);
  }
});

test("normaliseCrest fills in facing, compartment and ribbon for a crest saved without them, and refuses unknown ones", () => {
  const { supporterLeftFacing, supporterRightFacing, compartment, ribbon, compartmentColour, ribbonColour, ...old } = crest();
  const clean = normaliseCrest(old, 8);
  assert.deepEqual([clean.supporterLeftFacing, clean.supporterRightFacing, clean.compartment, clean.ribbon], ["inward", "inward", "none", "none"]);
  assert.deepEqual([clean.compartmentColour, clean.ribbonColour], [old.chargeColour, old.chargeColour]);
  assert.deepEqual(renderCrest(old), renderCrest(crest()), "an old crest draws as before");
  assert.equal(normaliseCrest(crest({ supporterLeftFacing: "sideways" }), 8), null);
  assert.equal(normaliseCrest(crest({ compartment: "cliff" }), 8), null);
  assert.equal(normaliseCrest(crest({ ribbon: "banner" }), 8), null);
  assert.equal(normaliseCrest(crest({ ribbonColour: 9 }), 8), null);
  assert.deepEqual(FACINGS.map((f) => f.id), ["inward", "outward"]);
  assert.deepEqual(COMPARTMENTS.map((f) => f.id), ["none", "mound"]);
  assert.deepEqual(RIBBONS.map((f) => f.id), ["none", "ribbon"]);
});

test("a crown is drawn above the shield in its own colour with the outline round it, and the shield-only picture leaves it out", () => {
  const bare = renderCrest(crest({ outline: 9 }));
  const crowned = renderCrest(crest({ topper: "crown", topperColour: 6, outline: 9 }));
  assert.ok(crowned.includes(6) && crowned.includes(9), "the crown has a body and an outline");
  for (let y = SHIELD_Y; y < CREST_H; y++) {
    for (let x = 0; x < CREST_W; x++) assert.equal(at(crowned, x, y), at(bare, x, y), `nothing from the shield down changes at ${x},${y}`);
  }
  assert.ok(!renderShieldOnly(crest({ topper: "crown", topperColour: 6 })).includes(6));
  assert.equal(normaliseCrest(crest({ topper: "tiara" }), 8), null);
  assert.equal(normaliseCrest(crest({ topperColour: 9 }), 8), null);
});

test("a soldier is a supporter that draws on either side", () => {
  for (const side of ["Left", "Right"]) {
    const cells = renderCrest(crest({ [`supporter${side}`]: "soldier", [`supporter${side}Colour`]: 6 }));
    assert.ok(cells.includes(6), `${side} soldier draws`);
  }
});
