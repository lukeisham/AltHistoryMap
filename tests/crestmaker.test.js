import test from "node:test";
import assert from "node:assert/strict";
import { createCrestMaker } from "../app/crestmaker.js";
import { defaultCrest } from "../app/crestcells.js";
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
    field: 1, field2: 3, ordinaryColour: 0, chargeColour: 0, outline: 1,
  });
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

test("Save PNG sends a 12 x 14 cell picture at 24 px per cell under the given file name", async () => {
  const t = setup();
  const result = t.maker.open(START());
  t.byText("Save PNG").dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(t.saved.length, 1);
  assert.equal(t.saved[0].name, "Map-crest.png");
  assert.equal(await t.saved[0].blob.text(), "png 288x336");
  t.maker.close();
  await result;
});
