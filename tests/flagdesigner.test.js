import test from "node:test";
import assert from "node:assert/strict";
import { createFlagDesigner } from "../app/flagdesigner.js";
import { TRANSPARENT, CREST_W, CREST_H } from "../app/crestcells.js";
import { FLAG_W, FLAG_H } from "../app/model.js";
import { FLAG_PNG_CELL } from "../app/pngexport.js";
import { fakeDocument, fakeDialog } from "./fakedom.js";

// A whole-crest grid of colour 3 with its four corner cells transparent, as renderCrest leaves the surround.
function cornerlessCrest() {
  const cells = new Uint8Array(CREST_W * CREST_H).fill(3);
  for (const i of [0, CREST_W - 1, CREST_W * (CREST_H - 1), CREST_W * CREST_H - 1]) cells[i] = TRANSPARENT;
  return cells;
}

function setup({ palette = ["#ff0000", "#00ff00", "#0000ff"], crests = [], shields = [], existing = null } = {}) {
  const doc = fakeDocument();
  const dialog = fakeDialog(doc);
  const opener = doc.createElement("button");
  doc.activeElement = opener;
  const added = [];
  const saved = [];
  let addResult = palette.length + 1;
  const designer = createFlagDesigner({
    dialog,
    getPalette: () => palette,
    addColour(hex) {
      added.push(hex);
      if (existing !== null) return existing;
      if (addResult !== null) palette.push(hex);
      return addResult;
    },
    getCrests: () => crests,
    getShields: () => shields,
    saveBlob: (blob, name) => saved.push({ blob, name }),
  });
  const byText = (text) => dialog.find((n) => n.tagName === "button" && n.textContent === text);
  const canvas = () => dialog.find((n) => n.tagName === "canvas" && n.className === "fd-canvas");
  const click = (text) => byText(text).dispatch("click", {});
  // The fake canvas reports 384 x 256 pixels, so a cell is 384 / FLAG_W wide and cell (x, y) is centred half a cell in.
  const cellPx = 384 / FLAG_W;
  const pointer = (type, x, y) => canvas().dispatch(type, { clientX: (x + 0.5) * cellPx, clientY: (y + 0.5) * cellPx, pointerId: 1 });
  const swatchButtons = () => {
    const nodes = [];
    dialog.walk((n) => { if (n.className === "fd-swatch") nodes.push(n); });
    return nodes;
  };
  const addButton = () => dialog.find((n) => n.className === "fd-swatch fd-swatch-add");
  const colourInput = () => dialog.find((n) => n.className === "fd-colour-input");
  return { designer, dialog, opener, click, byText, canvas, pointer, doc, added, saved, swatchButtons, addButton, colourInput, failAdds: () => (addResult = null) };
}

const painted = (cells) => cells.reduce((n, c) => n + (c ? 1 : 0), 0);

test("Cancel resolves null, closes the dialog and returns focus to the opener", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false });
  assert.equal(t.dialog.open, true);
  t.doc.activeElement = t.canvas();
  t.click("Cancel");
  assert.equal(await result, null);
  assert.equal(t.dialog.open, false);
  assert.equal(t.doc.activeElement, t.opener);
});

test("Escape (the native close event) also resolves null", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false });
  t.dialog.close();
  assert.equal(await result, null);
});

test("painting one cell and confirming resolves a full grid of cells; the label follows editing", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 3, colour2: 1, editing: false });
  assert.ok(t.byText("Add to library"));
  t.pointer("pointerdown", 5, 4);
  t.pointer("pointerup", 5, 4);
  t.click("Add to library");
  const cells = await result;
  assert.equal(cells.length, FLAG_W * FLAG_H);
  assert.equal(cells[4 * FLAG_W + 5], 3);
  assert.equal(painted(cells), 1);

  const again = t.designer.open({ cells, colour: 1, colour2: 2, editing: true });
  assert.ok(t.byText("Save changes"));
  t.click("Save changes");
  assert.deepEqual(await again, cells);
});

test("a drag paints a gapless stroke and Undo takes the whole stroke back", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 2, colour2: 1, editing: false });
  t.pointer("pointerdown", 0, 0);
  t.pointer("pointermove", 10, 0);
  t.pointer("pointerup", 10, 0);
  t.click("Add to library");
  assert.equal(painted(await result), 11);

  const second = t.designer.open({ cells: null, colour: 2, colour2: 1, editing: false });
  t.pointer("pointerdown", 0, 0);
  t.pointer("pointermove", 10, 0);
  t.pointer("pointerup", 10, 0);
  t.click("Undo");
  t.click("Add to library");
  assert.equal(painted(await second), 0);
});

test("Clear blanks the canvas and can be undone; Mirror writes both halves", async () => {
  const t = setup();
  const start = new Uint8Array(FLAG_W * FLAG_H).fill(2);
  const result = t.designer.open({ cells: start, colour: 1, colour2: 2, editing: true });
  t.click("Clear");
  t.click("Undo");
  t.click("Clear");
  t.click("Mirror");
  assert.equal(t.byText("Mirror").getAttribute("aria-pressed"), "true");
  t.pointer("pointerdown", 2, 3);
  t.pointer("pointerup", 2, 3);
  t.click("Save changes");
  const cells = await result;
  assert.equal(painted(cells), 2);
  assert.equal(cells[3 * FLAG_W + 2], 1);
  assert.equal(cells[3 * FLAG_W + FLAG_W - 3], 1);
});

test("Erase writes white, Fill fills a region, a starter replaces the canvas", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false });
  t.click("Stripes (horizontal)");
  t.click("Erase");
  t.pointer("pointerdown", 0, 0);
  t.pointer("pointerup", 0, 0);
  t.click("Fill");
  t.pointer("pointerdown", FLAG_W - 1, FLAG_H - 1);
  t.pointer("pointerup", FLAG_W - 1, FLAG_H - 1);
  t.click("Add to library");
  const cells = await result;
  assert.equal(cells[0], 0);
  assert.equal(cells[(FLAG_H - 1) * FLAG_W + FLAG_W - 1], 1);
  assert.equal(cells[(FLAG_H / 2) * FLAG_W], 2);
});

test("keyboard: arrows move the cursor, Space paints, Shift-click sets the second colour", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false });
  const canvas = t.canvas();
  assert.equal(canvas.getAttribute("role"), "application");
  canvas.dispatch("keydown", { key: "ArrowRight" });
  canvas.dispatch("keydown", { key: "ArrowDown" });
  canvas.dispatch("keydown", { key: " " });
  const swatches = [];
  t.dialog.walk((n) => { if (n.className === "fd-swatch") swatches.push(n); });
  swatches[2].dispatch("click", { shiftKey: true });
  assert.match(swatches[2].getAttribute("aria-label"), /second colour/);
  t.click("Stripes (vertical)");
  t.click("Add to library");
  const cells = await result;
  assert.equal(cells[0], 1);
  assert.equal(cells[FLAG_W / 2], 3);
});

test("the + swatch opens the colour picker; a picked colour joins the palette and becomes the pen colour", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false, fileName: "x.png" });
  assert.equal(t.swatchButtons().length, 3);
  let opened = 0;
  t.colourInput().click = () => opened++;
  t.addButton().dispatch("click");
  assert.equal(opened, 1, "the + swatch clicks the hidden colour input");

  t.colourInput().value = "#123456";
  t.colourInput().dispatch("change");
  assert.deepEqual(t.added, ["#123456"]);
  assert.equal(t.swatchButtons().length, 4, "the new colour has a swatch");
  assert.match(t.swatchButtons()[3].getAttribute("aria-label"), /Colour 4, #123456, pen colour/);

  t.pointer("pointerdown", 1, 1);
  t.pointer("pointerup", 1, 1);
  t.click("Add to library");
  assert.equal((await result)[1 * FLAG_W + 1], 4);
});

test("a picked colour that stands for a colour already in the palette selects that colour and adds no swatch", async () => {
  const t = setup({ existing: 2 });
  const result = t.designer.open({ cells: null, colour: 1, colour2: 3, editing: false, fileName: "x.png" });
  t.colourInput().value = "#00ff00";
  t.colourInput().dispatch("change");
  assert.equal(t.swatchButtons().length, 3);
  assert.match(t.swatchButtons()[1].getAttribute("aria-label"), /pen colour/);
  t.pointer("pointerdown", 1, 1);
  t.pointer("pointerup", 1, 1);
  t.click("Add to library");
  assert.equal((await result)[1 * FLAG_W + 1], 2);
});

test("the flag designer has an eye-dropper button beside +, with a pop-up term, that sends the sampled colour through addColour; without an EyeDropper it opens the colour input", async () => {
  const t = setup({ existing: 2 });
  t.designer.open({ cells: null, colour: 1, colour2: 3, editing: false, fileName: "x.png" });
  const button = t.dialog.find((n) => n.className === "fd-swatch fd-swatch-add fd-swatch-eyedropper");
  assert.ok(button, "the button is there");
  assert.equal(button.getAttribute("data-term"), "tool:eyedropper");
  globalThis.EyeDropper = class { open() { return Promise.resolve({ sRGBHex: "#00ff00" }); } };
  try {
    button.dispatch("click");
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    delete globalThis.EyeDropper;
  }
  assert.deepEqual(t.added, ["#00ff00"]);
  assert.equal(t.swatchButtons().length, 3, "no new swatch: the colour stood for one already there");
  let opened = 0;
  t.colourInput().click = () => opened++;
  button.dispatch("click");
  assert.equal(opened, 1);
  t.designer.close();
});

test("a full palette says so and leaves the pen colour alone", () => {
  const t = setup();
  t.designer.open({ cells: null, colour: 2, colour2: 1, editing: false, fileName: "x.png" });
  t.failAdds();
  t.colourInput().value = "#123456";
  t.colourInput().dispatch("change");
  assert.match(t.dialog.find((n) => n.className === "fd-status").textContent, /colour list is full/);
  assert.equal(t.swatchButtons().length, 3);
  assert.match(t.swatchButtons()[1].getAttribute("aria-label"), /pen colour/);
  t.designer.close();
});

test("the Crest tool stamps the chosen crest centred on the clicked cell, skips its transparent corners, and Undo takes it back", async () => {
  const t = setup({ crests: [cornerlessCrest()] });
  const result = t.designer.open({ cells: new Uint8Array(FLAG_W * FLAG_H).fill(1), colour: 1, colour2: 2, editing: true, fileName: "x.png" });
  assert.equal(t.dialog.find((n) => n.className === "fd-crests").hidden, true, "the crest picker shows only for the Crest tool");
  t.click("Crest");
  assert.equal(t.dialog.find((n) => n.className === "fd-crests").hidden, false);
  assert.equal(t.dialog.find((n) => n.className === "fd-crest").getAttribute("aria-pressed"), "true");

  const cx = FLAG_W / 2;
  const cy = FLAG_H / 2;
  t.pointer("pointerdown", cx, cy);
  t.pointer("pointerup", cx, cy);
  t.click("Undo");
  t.pointer("pointerdown", cx, cy);
  t.pointer("pointerup", cx, cy);
  t.click("Save changes");
  const cells = await result;
  const left = cx - CREST_W / 2;
  const top = cy - CREST_H / 2;
  assert.equal(cells[cy * FLAG_W + cx], 3);
  assert.equal(cells[top * FLAG_W + left], 1, "the crest's top-left corner is transparent, so the flag shows through");
  assert.equal(cells[top * FLAG_W + left + 1], 3, "the cell beside it is crest");
  assert.equal(cells.filter((c) => c === 3).length, CREST_W * CREST_H - 4);
});

test("Shield only stamps the shield list instead of the whole crest, shows only for the Crest tool, and resets on open", async () => {
  const shield = new Uint8Array(CREST_W * CREST_H).fill(TRANSPARENT);
  shield[(CREST_H / 2) * CREST_W + CREST_W / 2] = 2;
  const t = setup({ crests: [cornerlessCrest()], shields: [shield] });
  const result = t.designer.open({ cells: new Uint8Array(FLAG_W * FLAG_H).fill(1), colour: 1, colour2: 2, editing: true, fileName: "x.png" });
  assert.equal(t.byText("Shield only").hidden, true, "the toggle shows only for the Crest tool");
  t.click("Crest");
  assert.equal(t.byText("Shield only").hidden, false);
  assert.equal(t.byText("Shield only").getAttribute("aria-pressed"), "false");
  t.click("Shield only");
  assert.equal(t.byText("Shield only").getAttribute("aria-pressed"), "true");

  const cx = FLAG_W / 2;
  const cy = FLAG_H / 2;
  t.pointer("pointerdown", cx, cy);
  t.pointer("pointerup", cx, cy);
  t.click("Save changes");
  const cells = await result;
  assert.equal(cells[cy * FLAG_W + cx], 2, "the shield's one painted cell lands on the clicked cell");
  assert.equal(cells.filter((c) => c !== 1).length, 1, "nothing else of the crest is stamped");

  t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false, fileName: "x.png" });
  t.click("Crest");
  assert.equal(t.byText("Shield only").getAttribute("aria-pressed"), "false", "each open starts with the whole crest");
  t.designer.close();
});

test("the Crest tool with no saved crests changes nothing and says how to make one", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false, fileName: "x.png" });
  t.click("Crest");
  t.pointer("pointerdown", 5, 5);
  t.pointer("pointerup", 5, 5);
  assert.match(t.dialog.find((n) => n.className === "fd-status").textContent, /New crest/);
  t.click("Add to library");
  assert.equal(painted(await result), 0);
});

test("Save PNG hands the picture and the file name to the page, and a failure is said, not thrown", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false, fileName: "My map-flag-2.png" });
  t.click("Save PNG");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(t.saved.length, 1);
  assert.equal(t.saved[0].name, "My map-flag-2.png");
  assert.equal(t.saved[0].blob.type, "image/png");
  assert.equal(await t.saved[0].blob.text(), `png ${FLAG_W * FLAG_PNG_CELL}x${FLAG_H * FLAG_PNG_CELL}`, "the whole grid at FLAG_PNG_CELL pixels per cell");

  t.canvas().ownerDocument.createElement = () => { throw new Error("no canvas"); };
  t.click("Save PNG");
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(t.dialog.find((n) => n.className === "fd-status").textContent, /could not be saved/);
  assert.equal(t.saved.length, 1);
  t.designer.close();
  await result;
});

test("tools, Mirror, starter layouts and the flag-part captions each carry a term for the pop-up", () => {
  const t = setup();
  t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false, fileName: "x.png" });
  const terms = [];
  t.dialog.walk((n) => { if (n.attrs["data-term"]) terms.push(n.attrs["data-term"]); });
  for (const expected of ["tool:pencil", "tool:erase", "tool:fill", "tool:crest", "tool:shield-only", "tool:mirror", "starter:stripes-h", "starter:saltire", "flag:hoist", "flag:fly", "flag:canton"]) {
    assert.ok(terms.includes(expected), `${expected} has no term`);
  }
  t.designer.close();
});

test("the corner Close button dismisses the designer like Cancel", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false });
  t.dialog.find((n) => n.tagName === "button" && n.getAttribute("aria-label") === "Close").dispatch("click");
  assert.equal(await result, null);
});
