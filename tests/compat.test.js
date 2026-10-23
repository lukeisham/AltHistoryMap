import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PLANE_NAMES } from "../app/model.js";
import { decodeMap } from "../app/mapfile.js";
import { GLYPHS } from "../app/glyphs.js";
import { SUPPORTERS } from "../app/supporters.js";

// The fixtures are maps saved by earlier versions of the app. Opening them with the real reader must
// give exactly what snapshot.json holds; a change to the reader that alters any of them breaks old files.
const FOLDER = fileURLToPath(new URL("./fixtures/", import.meta.url));
const GLYPH_IDS = GLYPHS.map((glyph) => glyph.id);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

const snapshot = JSON.parse(await readFile(FOLDER + "snapshot.json", "utf8"));
const names = (await readdir(FOLDER)).filter((name) => name.endsWith(".ahmap")).sort();

test("the fixture scan found every saved map and each has a snapshot", () => {
  assert.ok(names.length >= 11, "nine scenarios and two hand-made files");
  assert.deepEqual(names, Object.keys(snapshot).sort());
});

for (const name of names) {
  test(`${name} opens with the same planes, palette, markers, flags, crests and countries`, async () => {
    const data = await decodeMap(new Blob([await readFile(FOLDER + name)]), GLYPH_IDS);
    const expected = snapshot[name];
    for (const plane of PLANE_NAMES) assert.equal(sha(data.planes[plane]), expected.planes[plane], `plane ${plane}`);
    assert.equal(data.name, expected.name);
    assert.equal(data.origin, expected.origin);
    assert.deepEqual(data.palette, expected.palette);
    assert.deepEqual(data.markers, expected.markers);
    assert.deepEqual(data.crests, expected.crests);
    assert.deepEqual(data.countries, expected.countries);
    assert.deepEqual(data.designs.map(sha), expected.designs);
  });
}

test("a file saved before crests, countries and colonies existed opens with none of them", async () => {
  const data = await decodeMap(new Blob([await readFile(FOLDER + "older-format.ahmap")]), GLYPH_IDS);
  assert.deepEqual([data.crests, data.countries], [[], []]);
  assert.ok(data.markers.every((marker) => marker.colony === false));
  assert.equal(data.markers.find((marker) => marker.name === "Siege").layer, "province");
});

test("the current-format fixture holds a colony, a capital and every supporter, and all of them still open", async () => {
  const data = await decodeMap(new Blob([await readFile(FOLDER + "current-format.ahmap")]), GLYPH_IDS);
  assert.ok(data.markers.some((marker) => marker.colony === true));
  assert.ok(data.markers.some((marker) => marker.capital === true));
  const named = new Set(data.crests.flatMap((crest) => [crest.supporterLeft, crest.supporterRight]));
  for (const { id } of SUPPORTERS.filter((supporter) => supporter.id !== "none")) assert.ok(named.has(id), `no fixture crest names ${id}`);
});
