import test from "node:test";
import assert from "node:assert/strict";
import { blankCountry, colourNameFor, countryName, isBlank, normaliseCountry } from "../app/countrydata.js";

test("a colour is called by the nearest named colour, or by its number when none is near", () => {
  assert.equal(colourNameFor("#b5473b", 1), "Brick red");
  assert.equal(colourNameFor("#4a4a4a", 8), "Charcoal");
  assert.equal(colourNameFor("#ff00ff", 4), "Colour 4");
});

test("an unnamed country shows its colour's name; a named one keeps its own", () => {
  assert.equal(countryName(null, "#5c8a4d", 4), "Moss");
  assert.equal(countryName({ name: "" }, "#5c8a4d", 4), "Moss");
  assert.equal(countryName({ name: "Aurea" }, "#5c8a4d", 4), "Aurea");
});

test("normaliseCountry trims text and refuses a colour, alignment, index or length that is not valid", () => {
  const ok = normaliseCountry({ colour: 2, name: "  Aurea ", alignment: "true-neutral", crest: 1 }, 8, 0, 2);
  assert.deepEqual(ok, { ...blankCountry(2), name: "Aurea", alignment: "true-neutral", crest: 1 });
  for (const bad of [
    { colour: 0 }, { colour: 9 }, { colour: 1.5 }, { colour: 1, alignment: "mostly-good" }, { colour: 1, crest: 2 }, { colour: 1, flag: 0 },
    { colour: 1, name: "x".repeat(61) }, { colour: 1, motto: "x".repeat(81) }, { colour: 1, ruler: 5 }, null, "x",
  ]) {
    assert.equal(normaliseCountry(bad, 8, 0, 2), null, JSON.stringify(bad));
  }
  assert.equal(isBlank(blankCountry(3)), true);
  assert.equal(isBlank({ ...blankCountry(3), currency: "Mark" }), false);
});
