import test from "node:test";
import assert from "node:assert/strict";
import { STYLES, generateAll, makeCurrency, makeDemonym, makeGovernment, makeMotto, makeName, makeRuler } from "../app/namegen.js";
import { ALIGNMENTS, ALIGNMENT_IDS, MOTTO_NOUNS, governmentPool, mottoPool } from "../app/alignmentpools.js";

// A small seeded generator: the same seed gives the same run of numbers.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("a fixed generator gives the same facts every run, and a different seed gives different ones", () => {
  const first = generateAll({ style: "norse", alignment: "lawful-good", rng: seeded(7) });
  assert.deepEqual(generateAll({ style: "norse", alignment: "lawful-good", rng: seeded(7) }), first);
  assert.notDeepEqual(generateAll({ style: "norse", alignment: "lawful-good", rng: seeded(8) }), first);
  for (const text of Object.values(first)) assert.ok(text.length > 0);
});

test("every style and alignment gives readable names and rulers of sane length", () => {
  const rng = seeded(11);
  for (const { id } of STYLES) {
    for (const alignment of ["", ...ALIGNMENT_IDS]) {
      for (let i = 0; i < 20; i++) {
        const government = makeGovernment(alignment, rng);
        const name = makeName(id, alignment, government, rng);
        const base = name.split(" of ").pop();
        assert.match(base, /^\p{Lu}\p{L}{3,12}$/u, `${id}/${alignment}: ${name}`);
        assert.doesNotMatch(base.toLowerCase(), /([aeiouy])\1|[aeiouy]{3}|(.)\2\2/, `${id}/${alignment}: ${name}`);
        assert.match(makeRuler(id, alignment, government, rng), /^[\p{L} -]+$/u);
      }
    }
  }
});

test("the alignment steers the government, the Latin motto and the name form, and the nine squares differ", () => {
  for (const alignment of ALIGNMENT_IDS) {
    const rng = seeded(3);
    const types = governmentPool(alignment).map((g) => g.type);
    const nouns = mottoPool(alignment);
    assert.ok(nouns.length >= 6, `${alignment} has only ${nouns.length} motto words`);
    for (let i = 0; i < 200; i++) {
      assert.ok(types.includes(makeGovernment(alignment, rng)), `${alignment} chose a government outside its pool`);
      const motto = makeMotto(alignment, rng);
      const shape = [/^(\w+) et (\w+)$/, /^Pro (\w+)$/, /^(\w+) ante omnia$/].find((pattern) => pattern.test(motto));
      assert.ok(shape, `${motto} is not one of the three shapes`);
      const words = motto.match(shape).slice(1);
      const allowed = new Set(nouns.flatMap((n) => [n.nom, n.abl]));
      for (const word of words) assert.ok(allowed.has(word), `${alignment}: ${word} is outside its pool`);
    }
  }
  assert.notDeepEqual(governmentPool("lawful-good"), governmentPool("chaotic-evil"));
  assert.ok(mottoPool("chaotic-evil").some((n) => n.nom === "Sanguis"));
  assert.ok(!mottoPool("lawful-good").some((n) => n.nom === "Sanguis"));
  assert.equal(ALIGNMENTS.length, 9);
});

test("a motto uses a noun's nominative with et and ante omnia, and its ablative with Pro", () => {
  const rng = seeded(5);
  const nominatives = new Set(MOTTO_NOUNS.map((n) => n.nom));
  const ablatives = new Set(MOTTO_NOUNS.map((n) => n.abl));
  for (let i = 0; i < 100; i++) {
    const motto = makeMotto("", rng);
    if (motto.startsWith("Pro ")) assert.ok(ablatives.has(motto.slice(4)), motto);
    else assert.ok(nominatives.has(motto.split(" ")[0]), motto);
  }
});

test("a demonym is built from the last place-word of the name", () => {
  assert.equal(makeDemonym("Valoria", "latin"), "Valorian");
  assert.equal(makeDemonym("Free Republic of Valoria", "norse"), "Valorian");
  assert.equal(makeDemonym("Riviland", "norse"), "Rivilander");
  assert.equal(makeDemonym("Karstan", "arabic"), "Karstani");
  assert.equal(makeDemonym("Tarun", "eastasian"), "Tarunese");
  assert.equal(makeDemonym("Merle", "celtic"), "Merlian");
  assert.equal(makeDemonym("Brick red", "any"), "redish");
  assert.equal(makeDemonym("   ", "any"), "");
});

test("a currency is built from the country's name and sound, always fits a field and is empty for a nameless country", () => {
  const rng = seeded(5);
  for (const { id } of STYLES) {
    for (let i = 0; i < 20; i++) {
      const currency = makeCurrency("Free Republic of Valoria", id, rng);
      assert.match(currency, /^(Valorian|Valoria) \p{L}+$/u, currency);
      assert.ok(currency.length <= 60);
    }
  }
  assert.equal(makeCurrency("", "latin", rng), "");
  assert.deepEqual(makeCurrency("Valoria", "norse", seeded(3)), makeCurrency("Valoria", "norse", seeded(3)));
});
