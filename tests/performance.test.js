// Checks the budgets in the `render.js` frame row of GUIDE.md. Time limits are several times the measured cost so a
// slow machine does not fail them; the call counts are exact.

import test from "node:test";
import assert from "node:assert/strict";
import { findRegions, drawCountryNames } from "../app/countrylabels.js";

const SIDE = 4096;
const FIND_REGIONS_BUDGET_MS = 600;

// Forty separate blocks of five colours on a plane, about the shape of a busy scenario.
function busyWorld() {
  const political = new Uint8Array(SIDE * SIDE);
  for (let block = 0; block < 40; block++) {
    const left = 100 + (block % 8) * 480;
    const top = 100 + Math.floor(block / 8) * 700;
    for (let y = top; y < top + 400; y++) political.fill((block % 5) + 1, y * SIDE + left, y * SIDE + left + 400);
  }
  return political;
}

function countingContext() {
  const calls = { measureText: 0, fillText: 0, save: 0 };
  const ctx = {
    font: "",
    measureText: (text) => {
      calls.measureText++;
      return { width: text.length * 0.5 * Number.parseFloat(ctx.font) };
    },
    strokeText() {},
    fillText: () => calls.fillText++,
    save: () => calls.save++,
    restore() {},
    translate() {},
    rotate() {},
  };
  return { ctx, calls };
}

function sceneOf(regions, vp) {
  return {
    vp,
    stage: { w: 1200, h: 800 },
    theme: { font: "serif", css: { land: "#fff", ink: "#000" } },
    palette: ["#a00", "#0a0", "#00a", "#aa0", "#0aa"],
    countries: [],
    countryRegions: regions,
  };
}

test("finding the name regions of a busy 4096 plane stays inside its budget", () => {
  const political = busyWorld();
  const started = performance.now();
  const regions = findRegions(political, SIDE);
  const spent = performance.now() - started;
  assert.equal(regions.length, 40);
  assert.ok(spent < FIND_REGIONS_BUDGET_MS, `findRegions took ${spent.toFixed(0)} ms, budget ${FIND_REGIONS_BUDGET_MS} ms`);
});

test("finding regions twice on the same plane gives the same answer, so a cached result can stand in", () => {
  const political = busyWorld();
  assert.deepEqual(findRegions(political, SIDE), findRegions(political, SIDE));
});

test("a frame measures and draws only the names on the stage", () => {
  const political = busyWorld();
  const regions = findRegions(political, SIDE);
  const k = 1;
  const view = { x: 0, y: 0, k, kFit: 0.2 };
  const { ctx, calls } = countingContext();
  drawCountryNames(ctx, sceneOf(regions, view));
  const onStage = regions.filter((r) => r.x * k > -40 && r.x * k < 1240 && r.y * k > -40 && r.y * k < 840).length;
  assert.ok(onStage > 0 && onStage < regions.length, "the view should hold some regions but not all");
  assert.equal(calls.measureText, onStage, "one measurement per name on the stage, none for names off it");
  assert.ok(calls.fillText <= onStage);
});

test("a view too far out for names does no text work at all", () => {
  const political = busyWorld();
  const regions = findRegions(political, SIDE);
  const { ctx, calls } = countingContext();
  drawCountryNames(ctx, sceneOf(regions, { x: 0, y: 0, k: 0.2, kFit: 0.2 }));
  assert.deepEqual(calls, { measureText: 0, fillText: 0, save: 0 });
});
