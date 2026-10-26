import test from "node:test";
import assert from "node:assert/strict";
import { blankCountry, colourNameFor, countryName, defaultColourName, relationLoops, isBlank, normaliseCountry } from "../app/countrydata.js";

test("a colour is called by the nearest named colour, or by its number when none is near", () => {
  assert.equal(colourNameFor("#b5473b", 1), "Brick red");
  assert.equal(colourNameFor("#4a4a4a", 8), "Charcoal");
  assert.equal(colourNameFor("#ff00ff", 4), "Colour 4");
});

test("an unnamed country shows its colour's name; a named one keeps its own", () => {
  assert.equal(countryName(null, ["#5c8a4d"], 1), "Moss");
  assert.equal(countryName({ name: "" }, ["#5c8a4d"], 1), "Moss");
  assert.equal(countryName({ name: "Aurea" }, ["#5c8a4d"], 1), "Aurea");
});

test("two different colours with one nearest name differ by a lightness word; look-alikes still share a name", () => {
  const palette = ["#b5483a", "#a8402f", "#98382b", "#b5483b"];
  assert.deepEqual(palette.slice(0, 3).map((hex) => colourNameFor(hex, 1)), ["Brick red", "Brick red", "Brick red"]);
  assert.deepEqual([1, 2, 3].map((colour) => defaultColourName(palette, colour)), ["Light brick red", "Brick red", "Dark brick red"]);
  assert.equal(defaultColourName(palette, 4), "Light brick red", "a look-alike of the first shares its name");
  assert.deepEqual([1, 2].map((colour) => defaultColourName(palette.slice(0, 2), colour)), ["Light brick red", "Brick red"]);
  assert.equal(defaultColourName(["#b5483a", "#2e8b3d"], 1), "Brick red", "a colour alone with its name is not renamed");
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

test("a relationship is a kind and an overlord kept together; a country with neither carries neither key", () => {
  const related = normaliseCountry({ colour: 2, relation: "client", overlord: 5 }, 8, 0, 0);
  assert.deepEqual([related.relation, related.overlord], ["client", 5]);
  const none = normaliseCountry({ colour: 2, relation: "", overlord: 0 }, 8, 0, 0);
  assert.equal("relation" in none || "overlord" in none, false);
  assert.equal(isBlank({ ...blankCountry(2), relation: "colony", overlord: 3 }), false);
  for (const bad of [{ relation: "client" }, { overlord: 5 }, { relation: "vassal", overlord: 5 }, { relation: "client", overlord: 2 }, { relation: "client", overlord: 9 }, { relation: "client", overlord: 1.5 }]) {
    assert.equal(normaliseCountry({ colour: 2, ...bad }, 8, 0, 0), null, JSON.stringify(bad));
  }
});

test("relationLoops finds a chain of overlords that returns to the country", () => {
  const countries = [{ colour: 2, overlord: 3 }, { colour: 3, overlord: 4 }];
  assert.equal(relationLoops(countries, 4, 2), true, "4 under 2, 2 under 3, 3 under 4");
  assert.equal(relationLoops(countries, 5, 2), false);
  assert.equal(relationLoops([], 1, 1), true, "a country as its own overlord");
});
