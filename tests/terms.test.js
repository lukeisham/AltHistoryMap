import test from "node:test";
import assert from "node:assert/strict";
import { termFor } from "../app/terms.js";
import { ALIGNMENT_IDS } from "../app/alignmentpools.js";
import { SHAPES, DIVISIONS, ORDINARIES, CHARGES, SUPPORTERS, FACINGS, COMPARTMENTS, RIBBONS, TOPPERS } from "../app/crestcells.js";

const LISTS = { shape: SHAPES, division: DIVISIONS, ordinary: ORDINARIES, charge: CHARGES, supporter: SUPPORTERS, facing: FACINGS, compartment: COMPARTMENTS, ribbon: RIBBONS, topper: TOPPERS };

test("every shield shape, division, ordinary, charge and supporter has a name and a definition", () => {
  for (const [group, list] of Object.entries(LISTS)) {
    for (const { id } of list) {
      const term = termFor(`${group}:${id}`);
      assert.ok(term, `${group}:${id} has no definition`);
      assert.ok(term.name.length > 0 && term.text.length > 20, `${group}:${id} is too thin`);
    }
  }
});

test("the crest parts, colour roles, flag tools, starters and flag parts are defined, and an unknown key is null", () => {
  for (const key of [
    "part:shield", "part:division", "part:ordinary", "part:charge", "part:supporterLeft", "part:supporterRight", "part:supporterLeftFacing", "part:supporterRightFacing", "part:compartment", "part:ribbon", "part:topper", "role:topperColour",
    "role:compartmentColour", "role:ribbonColour",
    "role:field", "role:field2", "role:ordinaryColour", "role:chargeColour", "role:outline", "role:supporterLeftColour", "role:supporterRightColour",
    "tool:pencil", "tool:erase", "tool:fill", "tool:crest", "tool:mirror", "tool:eyedropper",
    "starter:plain", "starter:stripes-h", "starter:stripes-v", "starter:cross", "starter:saltire",
    "flag:hoist", "flag:fly", "flag:canton",
  ]) {
    assert.ok(termFor(key), `${key} has no definition`);
  }
  assert.equal(termFor("shape:kite"), null);
  assert.equal(termFor("constructor"), null);
});

test("every philosophy square has a name and a definition", () => {
  assert.equal(ALIGNMENT_IDS.length, 9);
  for (const id of ALIGNMENT_IDS) {
    const term = termFor(`alignment:${id}`);
    assert.ok(term && term.text.length > 20, `alignment:${id} has no definition`);
  }
});

test("each relationship has a name and a definition", () => {
  for (const id of ["none", "dominion", "client", "colony"]) {
    const term = termFor(`relation:${id}`);
    assert.ok(term && term.text.length > 20, `relation:${id} has no definition`);
  }
});
