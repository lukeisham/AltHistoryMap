import test from "node:test";
import assert from "node:assert/strict";
import { createCountryFacts } from "../app/countryfacts.js";
import { defaultCrest } from "../app/crestcells.js";
import { ITEM_TYPE } from "../app/dragitem.js";
import { FLAG_W, FLAG_H } from "../app/model.js";
import { fakeDocument, fakeDialog } from "./fakedom.js";

const PALETTE = ["#b5473b", "#c98b2b", "#5c8a4d"];
const FLAG = new Uint8Array(FLAG_W * FLAG_H).fill(1);
const rngOf = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

function setup({ rng = rngOf(0.1, 0.5, 0.9) } = {}) {
  const doc = fakeDocument();
  const dialog = fakeDialog(doc);
  const facts = createCountryFacts({ dialog, getPalette: () => PALETTE, getDesigns: () => [FLAG], getCrests: () => [defaultCrest(1, 2)], rng });
  const byText = (text) => dialog.find((n) => n.tagName === "button" && n.textContent === text);
  const input = (label) => dialog.find((n) => n.tagName === "input" && n.getAttribute("aria-label") === label);
  const generate = (label) => dialog.find((n) => n.tagName === "button" && n.getAttribute("aria-label") === `Generate ${label}`);
  const square = (label) => dialog.find((n) => n.getAttribute("role") === "radio" && n.textContent === label);
  return { facts, dialog, byText, input, generate, square };
}

const START = (over = {}) => ({ colour: 3, name: "Moss", record: null, editable: true, ...over });

test("the pop-up opens with the colour's name as the heading and the default, and Save returns every fact, filling an empty motto", async () => {
  const t = setup();
  const result = t.facts.open(START());
  assert.equal(t.dialog.find((n) => n.className === "fd-title").textContent, "Key facts: Moss");
  assert.equal(t.input("Name").getAttribute("placeholder"), "Moss");
  t.input("Ruler").value = "  Queen Ona ";
  t.input("Ruler").dispatch("input");
  t.input("Currency").value = "Mark";
  t.square("Chaotic good").dispatch("click");
  t.byText("Save").dispatch("click");
  const saved = await result;
  assert.equal(saved.ruler, "Queen Ona");
  assert.equal(saved.currency, "Mark");
  assert.equal(saved.alignment, "chaotic-good");
  assert.match(saved.motto, /^(\w+ et \w+|Pro \w+|\w+ ante omnia)$/, "an empty motto is generated on Save");
  assert.deepEqual([saved.flag, saved.crest, saved.name], [-1, -1, ""]);
});

test("a motto that was written is kept, and the philosophy grid toggles and moves with the arrow keys", async () => {
  const t = setup();
  const result = t.facts.open(START({ record: { motto: "Fiat lux", alignment: "lawful-evil", flag: 0, crest: 0 } }));
  assert.equal(t.square("Lawful evil").getAttribute("aria-checked"), "true");
  t.square("Lawful evil").dispatch("click");
  assert.equal(t.square("Lawful evil").getAttribute("aria-checked"), "false", "a second click clears it");
  t.square("Lawful good").dispatch("keydown", { key: "ArrowDown" });
  assert.equal(t.square("Lawful neutral").getAttribute("aria-checked"), "true");
  t.byText("Save").dispatch("click");
  const saved = await result;
  assert.equal(saved.motto, "Fiat lux");
  assert.equal(saved.alignment, "lawful-neutral");
  assert.deepEqual([saved.flag, saved.crest], [0, 0]);
});

test("Generate buttons fill their own field from the alignment; Generate all fills government, name, ruler, motto and demonym", async () => {
  const t = setup({ rng: rngOf(0.2, 0.7, 0.4, 0.9, 0.1, 0.6, 0.3, 0.8) });
  const result = t.facts.open(START());
  t.square("Chaotic evil").dispatch("click");
  t.generate("type of government").dispatch("click");
  assert.ok(["Horde", "Tyranny", "Warlord state", "Junta", "Khanate"].includes(t.input("Type of government").value));
  t.generate("motto (latin)").dispatch("click");
  assert.ok(t.input("Motto (Latin)").value.length > 4);
  t.byText("Generate all").dispatch("click");
  for (const label of ["Type of government", "Name", "Ruler", "Motto (Latin)", "Demonym"]) assert.ok(t.input(label).value.length > 0, label);
  assert.equal(t.input("Currency").value, "");
  assert.equal(t.dialog.find((n) => n.className === "fd-title").textContent, `Key facts: ${t.input("Name").value}`);
  t.byText("Cancel").dispatch("click");
  assert.equal(await result, null);
});

test("in View mode the facts are shown but cannot change, nothing generates, and Close returns null", async () => {
  const t = setup();
  const result = t.facts.open(START({ editable: false, record: { alignment: "true-neutral", ruler: "King Aldo" } }));
  assert.equal(t.input("Ruler").disabled, true);
  assert.equal(t.input("Ruler").value, "King Aldo");
  assert.equal(t.square("True neutral").getAttribute("aria-checked"), "true", "the philosophy still shows");
  assert.equal(t.square("True neutral").getAttribute("aria-disabled"), "true");
  assert.equal(t.generate("ruler").hidden, true);
  assert.equal(t.byText("Save").hidden, true);
  t.square("Lawful good").dispatch("click");
  assert.equal(t.square("Lawful good").getAttribute("aria-checked"), "false");
  t.byText("Close").dispatch("click");
  assert.equal(await result, null);
});

test("a flag or crest chosen in the pop-up, or dropped on its picture, is returned; a wrong kind is ignored", async () => {
  const t = setup();
  const result = t.facts.open(START());
  t.dialog.find((n) => n.getAttribute("aria-label") === "Flag design 1").dispatch("click");
  const crestSlot = t.dialog.findAll((n) => n.className === "kf-slot")[1];
  const drop = (item) => crestSlot.dispatch("drop", { dataTransfer: { types: [ITEM_TYPE], getData: () => JSON.stringify(item) } });
  drop({ kind: "flag", design: 0 });
  assert.equal(t.dialog.find((n) => n.getAttribute("aria-label") === "No crest").getAttribute("aria-pressed"), "true", "a flag on the crest picture changes nothing");
  drop({ kind: "crest", crest: 0 });
  t.byText("Save").dispatch("click");
  const saved = await result;
  assert.deepEqual([saved.flag, saved.crest], [0, 0]);
});

test("the corner Close button dismisses the pop-up like Cancel, in Edit and View mode", async () => {
  for (const editable of [true, false]) {
    const t = setup();
    const result = t.facts.open(START({ editable }));
    t.dialog.find((n) => n.tagName === "button" && n.getAttribute("aria-label") === "Close").dispatch("click");
    assert.equal(await result, null);
  }
});

test("the Currency Generate button fills the field from the country's name and Generate all leaves it alone", () => {
  const t = setup();
  t.facts.open(START());
  t.input("Name").value = "Valoria";
  t.input("Name").dispatch("input");
  t.generate("currency").dispatch("click");
  assert.match(t.input("Currency").value, /^(Valorian|Valoria) \p{L}+$/u);
});

test("Relationship sets a kind and an overlord and Save returns them; None clears both", async () => {
  const t = setup();
  const others = [{ colour: 1, name: "Brick red", loops: false }, { colour: 2, name: "Amber", loops: false }];
  const kind = () => t.dialog.find((n) => n.tagName === "select" && n.getAttribute("aria-label") === "Relationship");
  const target = () => t.dialog.find((n) => n.tagName === "select" && n.getAttribute("aria-label") === "Answers to");
  const first = t.facts.open(START({ others }));
  kind().value = "client";
  kind().dispatch("change");
  assert.equal(target().value, "1", "the first country that would not make a loop is chosen");
  target().value = "2";
  target().dispatch("change");
  t.byText("Save").dispatch("click");
  const saved = await first;
  assert.deepEqual([saved.relation, saved.overlord], ["client", 2]);

  const second = t.facts.open(START({ others, record: { relation: "colony", overlord: 2 } }));
  assert.equal(kind().value, "colony");
  kind().value = "none";
  kind().dispatch("change");
  t.byText("Save").dispatch("click");
  const cleared = await second;
  assert.deepEqual([cleared.relation, cleared.overlord], ["", 0]);
});

test("choosing an overlord that already answers to this country is refused with a message", async () => {
  const t = setup();
  const others = [{ colour: 1, name: "Brick red", loops: false }, { colour: 2, name: "Amber", loops: true }];
  const target = () => t.dialog.find((n) => n.tagName === "select" && n.getAttribute("aria-label") === "Answers to");
  const kind = () => t.dialog.find((n) => n.tagName === "select" && n.getAttribute("aria-label") === "Relationship");
  const result = t.facts.open(START({ others }));
  kind().value = "dominion";
  kind().dispatch("change");
  target().value = "2";
  target().dispatch("change");
  assert.equal(target().value, "1");
  assert.match(t.dialog.find((n) => n.className === "fd-status").textContent, /Amber already answers to this country/);
  t.byText("Cancel").dispatch("click");
  await result;
});
