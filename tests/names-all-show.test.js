import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { decodeMap } from "../app/mapfile.js";
import { GLYPHS } from "../app/glyphs.js";
import { N } from "../app/model.js";
import { findRegions, drawCountryNames } from "../app/countrylabels.js";
import { countryName } from "../app/countrydata.js";
import { representativeColours } from "../app/layerimage.js";
import { MAX_K, fitScale } from "../app/viewport.js";

// Every painted Political colour must show its name when the viewer is zoomed fully in on one of its areas.
const APP = fileURLToPath(new URL("../app/", import.meta.url));
const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const GLYPH_IDS = GLYPHS.map((glyph) => glyph.id);
const STAGE = { w: 1200, h: 800 };

const files = [
  ...(await readdir(APP + "data/scenarios")).filter((name) => name.endsWith(".ahmap")).map((name) => APP + "data/scenarios/" + name),
  ...(await readdir(FIXTURES)).filter((name) => name.endsWith(".ahmap")).map((name) => FIXTURES + name),
];

function measuringContext() {
  const drawn = [];
  const ctx = {
    font: "",
    measureText: (text) => ({ width: text.length * 0.65 * Number.parseFloat(ctx.font) }),
    strokeText() {},
    fillText: (text) => drawn.push(text),
    save() {},
    restore() {},
    translate() {},
    rotate() {},
  };
  return { ctx, drawn };
}

// The countries whose name is not drawn when the view is centred on each of their areas at the highest zoom.
function unnamed(data) {
  const representative = representativeColours(data.palette);
  const regions = findRegions(data.planes.political, N, representative);
  const painted = new Set();
  for (let i = 0; i < data.planes.political.length; i++) painted.add(representative[data.planes.political[i]]);
  painted.delete(0);
  const kFit = fitScale(STAGE, N);
  const shown = new Set();
  const lastOf = (colour) => regions.filter((region) => region.colour === colour);
  for (const colour of painted) {
    for (const region of lastOf(colour)) {
      const vp = { x: STAGE.w / 2 - region.x * MAX_K, y: STAGE.h / 2 - (region.y + 0.5) * MAX_K, k: MAX_K, kFit };
      const { ctx, drawn } = measuringContext();
      const scene = { vp, stage: STAGE, theme: { font: "serif", css: { land: "#fff", ink: "#000" } }, palette: data.palette, countries: data.countries, countryRegions: [region] };
      drawCountryNames(ctx, scene);
      const name = countryName(data.countries.find((country) => country.colour === colour), data.palette, colour);
      if (drawn.includes(name) || name.split("").every((letter) => drawn.includes(letter))) shown.add(colour);
    }
  }
  return [...painted].filter((colour) => !shown.has(colour));
}

for (const file of files) {
  test(`${file.split("/").pop()}: every painted country shows its name at the highest zoom`, async () => {
    const data = await decodeMap(new Blob([await readFile(file)]), GLYPH_IDS);
    assert.deepEqual(unnamed(data), []);
  });
}
