import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PLANE_NAMES } from "../app/model.js";
import { decodeMap, encodeMap } from "../app/mapfile.js";
import { GLYPHS } from "../app/glyphs.js";

// Opening an old map and saving it must lose nothing: the second read has to equal the first.
const FOLDER = fileURLToPath(new URL("./fixtures/", import.meta.url));
const GLYPH_IDS = GLYPHS.map((glyph) => glyph.id);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const names = (await readdir(FOLDER)).filter((name) => name.endsWith(".ahmap")).sort();

for (const name of names) {
  test(`${name} survives open, save and open again unchanged`, async () => {
    const first = await decodeMap(new Blob([await readFile(FOLDER + name)]), GLYPH_IDS);
    const second = await decodeMap(await encodeMap(first), GLYPH_IDS);
    for (const plane of PLANE_NAMES) assert.equal(sha(second.planes[plane]), sha(first.planes[plane]), `plane ${plane}`);
    assert.deepEqual(second.markers, first.markers);
    assert.deepEqual(second.palette, first.palette);
    assert.deepEqual(second.crests, first.crests);
    assert.deepEqual(second.countries, first.countries);
    assert.deepEqual(second.designs.map(sha), first.designs.map(sha));
  });
}

test("a map saved without relationships shows no relationship and writes none back", async () => {
  const data = await decodeMap(new Blob([await readFile(FOLDER + "relations-absent.ahmap")]), GLYPH_IDS);
  assert.equal(data.countries.length, 3);
  assert.ok(data.countries.every((country) => !("relation" in country) && !("overlord" in country)));
  const again = await decodeMap(await encodeMap(data), GLYPH_IDS);
  assert.ok(again.countries.every((country) => !("relation" in country) && !("overlord" in country)));
});
