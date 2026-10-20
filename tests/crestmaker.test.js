import test from "node:test";
import assert from "node:assert/strict";
import { createCrestMaker } from "../app/crestmaker.js";
import { defaultCrest, CREST_W, CREST_H } from "../app/crestcells.js";
import { CREST_PNG_CELL } from "../app/pngexport.js";
import { fakeDocument, fakeDialog } from "./fakedom.js";

function setup(palette = ["#ff0000", "#00ff00", "#0000ff"]) {
  const doc = fakeDocument();
  const dialog = fakeDialog(doc);
  const opener = doc.createElement("button");
  doc.activeElement = opener;
  const saved = [];
  const added = [];
  let addResult = palette.length + 1;
  const maker = createCrestMaker({
    dialog,
    getPalette: () => palette,
    addColour(hex) {
      added.push(hex);
      if (addResult !== null) palette.push(hex);
      return addResult;
    },
    saveBlob: (blob, name) => saved.push({ blob, name }),
  });
  const byText = (text) => dialog.find((n) => n.tagName === "button" && n.textContent === text);
  const status = () => dialog.find((n) => n.className === "fd-status").textContent;
  return { maker, dialog, opener, byText, saved, added, status, doc, failAdds: () => (addResult = null) };
}

const START = () => ({ crest: defaultCrest(1, 2), editing: false, fileName: "Map-crest.png" });

test("choosing parts and a colour for the chosen part changes the crest that is returned", async () => {
  const t = setup();
  const result = t.maker.open(START());
  assert.ok(t.byText("Add to library"));
  t.byText("French").dispatch("click");
  t.byText("Per bend").dispatch("click");
  t.byText("Cross").dispatch("click");
  t.byText("Crown").dispatch("click");
  assert.equal(t.byText("French").getAttribute("aria-pressed"), "true");
  assert.equal(t.byText("Heater").getAttribute("aria-pressed"), "false");

  t.byText("Second field").dispatch("click");
  const swatches = t.dialog.findAll((n) => n.className === "fd-swatch");
  swatches[3].dispatch("click");
  t.byText("Add to library").dispatch("click");
  assert.deepEqual(await result, {
    shape: "french", division: "bend", ordinary: "cross", charge: "crown",
    supporterLeft: "lion", supporterRight: "lion", supporterLeftFacing: "inward", supporterRightFacing: "inward",
    compartment: "none", ribbon: "none",
    field: 1, field2: 3, ordinaryColour: 0, chargeColour: 0, supporterLeftColour: 0, supporterRightColour: 0,
    compartmentColour: 0, ribbonColour: 0, outline: 1,
  });
});

test("each side takes its own supporter and its own colour, and None removes one", async () => {
  const t = setup();
  const result = t.maker.open(START());
  const unicornButtons = t.dialog.findAll((n) => n.tagName === "button" && n.textContent === "Unicorn");
  assert.equal(unicornButtons.length, 2, "one Unicorn button per side");
  unicornButtons[1].dispatch("click");
  t.dialog.findAll((n) => n.tagName === "button" && n.textContent === "None")[2].dispatch("click");
  t.byText("Right animal").dispatch("click");
  t.dialog.findAll((n) => n.className === "fd-swatch")[2].dispatch("click");
  t.byText("Add to library").dispatch("click");
  const crest = await result;
  assert.equal(crest.supporterLeft, "none");
  assert.equal(crest.supporterRight, "unicorn");
  assert.equal(crest.supporterRightColour, 2);
  assert.equal(crest.supporterLeftColour, 0);
});

test("every option button carries a term for the pop-up", () => {
  const t = setup();
  t.maker.open(START());
  const optionButtons = t.dialog.findAll((n) => n.tagName === "button" && n.attrs["data-term"]);
  assert.ok(optionButtons.length > 40, "shapes, divisions, ordinaries, charges, animals and colour parts all have terms");
  const pressedOnes = t.byText("Heater").getAttribute("data-term");
  assert.equal(pressedOnes, "shape:heater");
  assert.equal(t.byText("Right animal").getAttribute("data-term"), "role:supporterRightColour");
  t.maker.close();
});

test("Cancel and the native close event resolve null and return focus; editing relabels the confirm button", async () => {
  const t = setup();
  const first = t.maker.open(START());
  t.byText("Cancel").dispatch("click");
  assert.equal(await first, null);
  assert.equal(t.doc.activeElement, t.opener);

  const second = t.maker.open({ ...START(), editing: true });
  assert.ok(t.byText("Save changes"));
  t.dialog.close();
  assert.equal(await second, null);
});

test("a picked colour joins the palette and colours the chosen part; a full palette says so", async () => {
  const t = setup();
  const result = t.maker.open(START());
  t.byText("Charge").dispatch("click");
  const input = t.dialog.find((n) => n.className === "fd-colour-input");
  input.value = "#abcdef";
  input.dispatch("change");
  assert.deepEqual(t.added, ["#abcdef"]);
  assert.equal(t.dialog.findAll((n) => n.className === "fd-swatch").length, 5, "white plus four colours");

  t.failAdds();
  input.value = "#000001";
  input.dispatch("change");
  assert.match(t.status(), /colour list is full/);
  t.byText("Add to library").dispatch("click");
  assert.equal((await result).chargeColour, 4);
});

test("Save PNG sends a whole-crest picture at CREST_PNG_CELL px per cell under the given file name", async () => {
  const t = setup();
  const result = t.maker.open(START());
  t.byText("Save PNG").dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(t.saved.length, 1);
  assert.equal(t.saved[0].name, "Map-crest.png");
  assert.equal(await t.saved[0].blob.text(), `png ${CREST_W * CREST_PNG_CELL}x${CREST_H * CREST_PNG_CELL}`);
  t.maker.close();
  await result;
});

test("each supporter takes its own facing, and the compartment and ribbon take a choice and a colour", async () => {
  const t = setup();
  const result = t.maker.open(START());
  const outward = t.dialog.findAll((n) => n.tagName === "button" && n.textContent === "Outward");
  assert.equal(outward.length, 2, "one Outward button per side");
  outward[1].dispatch("click");
  t.byText("Mound").dispatch("click");
  t.byText("Ribbon").dispatch("click");
  t.byText("Compartment").dispatch("click");
  t.dialog.findAll((n) => n.className === "fd-swatch")[2].dispatch("click");
  t.byText("Add to library").dispatch("click");
  const crest = await result;
  assert.deepEqual([crest.supporterLeftFacing, crest.supporterRightFacing], ["inward", "outward"]);
  assert.deepEqual([crest.compartment, crest.ribbon], ["mound", "ribbon"]);
  assert.deepEqual([crest.compartmentColour, crest.ribbonColour], [2, 0]);
});
