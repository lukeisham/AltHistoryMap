import test from "node:test";
import assert from "node:assert/strict";
import { createFlagDesigner } from "../app/flagdesigner.js";

// A fake DOM with only what flagdesigner.js touches: createElement, append, replaceChildren,
// attributes, listeners, getContext, getBoundingClientRect, pointer capture, showModal and close.
class FakeElement {
  constructor(tag, doc) {
    this.tagName = tag;
    this.ownerDocument = doc;
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.style = {};
    this.className = "";
    this.textContent = "";
    this.disabled = false;
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name]; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  dispatch(type, event = {}) {
    const e = { target: this, preventDefault() {}, ...event };
    for (const fn of this.listeners[type] ?? []) fn(e);
  }
  getContext() {
    const noop = () => {};
    return { setTransform: noop, fillRect: noop, strokeRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, setLineDash: noop };
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 384, height: 256 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() { this.ownerDocument.activeElement = this; }
  walk(fn) { fn(this); for (const c of this.children) c.walk(fn); }
  find(pred) { let hit = null; this.walk((n) => { if (!hit && pred(n)) hit = n; }); return hit; }
}

function setup(palette = ["#ff0000", "#00ff00", "#0000ff"]) {
  const doc = {
    activeElement: null,
    defaultView: { devicePixelRatio: 1, getComputedStyle: () => ({ getPropertyValue: () => "" }) },
    createElement: (tag) => new FakeElement(tag, doc),
  };
  const dialog = new FakeElement("dialog", doc);
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatch("close"); };
  const opener = new FakeElement("button", doc);
  doc.activeElement = opener;
  const designer = createFlagDesigner({ dialog, getPalette: () => palette });
  const byText = (text) => dialog.find((n) => n.tagName === "button" && n.textContent === text);
  const canvas = () => dialog.find((n) => n.tagName === "canvas" && n.className === "fd-canvas");
  const click = (text) => byText(text).dispatch("click", {});
  // The 384 x 256 canvas holds 16 px cells, so cell (x, y) is centred at (16x + 8, 16y + 8).
  const pointer = (type, x, y) => canvas().dispatch(type, { clientX: x * 16 + 8, clientY: y * 16 + 8, pointerId: 1 });
  return { designer, dialog, opener, click, byText, canvas, pointer, doc };
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

test("painting one cell and confirming resolves 384 cells; the label follows editing", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 3, colour2: 1, editing: false });
  assert.ok(t.byText("Add to library"));
  t.pointer("pointerdown", 5, 4);
  t.pointer("pointerup", 5, 4);
  t.click("Add to library");
  const cells = await result;
  assert.equal(cells.length, 384);
  assert.equal(cells[4 * 24 + 5], 3);
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
  const start = new Uint8Array(384).fill(2);
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
  assert.equal(cells[3 * 24 + 2], 1);
  assert.equal(cells[3 * 24 + 21], 1);
});

test("Erase writes white, Fill fills a region, a starter replaces the canvas", async () => {
  const t = setup();
  const result = t.designer.open({ cells: null, colour: 1, colour2: 2, editing: false });
  t.click("Stripes (horizontal)");
  t.click("Erase");
  t.pointer("pointerdown", 0, 0);
  t.pointer("pointerup", 0, 0);
  t.click("Fill");
  t.pointer("pointerdown", 23, 15);
  t.pointer("pointerup", 23, 15);
  t.click("Add to library");
  const cells = await result;
  assert.equal(cells[0], 0);
  assert.equal(cells[15 * 24 + 23], 1);
  assert.equal(cells[8 * 24], 2);
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
  assert.equal(cells[12], 3);
});
