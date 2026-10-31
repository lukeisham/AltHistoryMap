import test from "node:test";
import assert from "node:assert/strict";
import { createRelationMenu } from "../app/relationmenu.js";
import { fakeDocument, FakeElement } from "./fakedom.js";

function setup() {
  const doc = fakeDocument();
  doc.addEventListener = (type, fn) => (doc.listeners[type] ??= []).push(fn);
  doc.listeners = {};
  doc.defaultView.getComputedStyle = () => ({ marginLeft: "8px" });
  const box = new FakeElement("div", doc);
  box.hidden = true;
  box.contains = (node) => node === box || box.children.includes(node);
  const stage = new FakeElement("main", doc);
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
  const placed = {};
  box.style = { setProperty: (name, value) => (placed[name] = value) };
  return { menu: createRelationMenu({ box, stage }), box, doc, placed };
}

const OPTIONS = [
  { id: "client", label: "Client State", hint: "h", current: false },
  { id: "colony", label: "Colony", hint: "h", current: true },
];

test("choose shows a heading and a button per option, marks the current one, and resolves with the id clicked", async () => {
  const t = setup();
  const answer = t.menu.choose({ x: 5, y: 6, title: "Aurea answers to Brora", options: OPTIONS });
  assert.equal(t.box.hidden, false);
  assert.equal(t.box.children[0].textContent, "Aurea answers to Brora");
  const buttons = t.box.children.slice(1);
  assert.deepEqual(buttons.map((b) => [b.textContent, b.getAttribute("aria-pressed")]), [["Client State", "false"], ["Colony", "true"]]);
  assert.equal(t.box.ownerDocument.activeElement, buttons[0]);
  assert.deepEqual([t.placed["--at-x"], t.placed["--at-y"]], ["5", "6"]);
  buttons[1].click();
  assert.equal(await answer, "colony");
  assert.equal(t.box.hidden, true);
});

test("Escape, a press outside, and a second menu each close the first with null; a press inside does not", async () => {
  const t = setup();
  const first = t.menu.choose({ x: 0, y: 0, title: "a", options: OPTIONS });
  t.box.dispatch("keydown", { key: "Escape", stopPropagation() {} });
  assert.equal(await first, null);

  const second = t.menu.choose({ x: 0, y: 0, title: "b", options: OPTIONS });
  for (const fn of t.doc.listeners.pointerdown) fn({ target: t.box.children[1] });
  assert.equal(t.box.hidden, false, "a press on a menu button leaves it open");
  for (const fn of t.doc.listeners.pointerdown) fn({ target: new FakeElement("canvas", t.doc) });
  assert.equal(await second, null);

  const third = t.menu.choose({ x: 0, y: 0, title: "c", options: OPTIONS });
  const fourth = t.menu.choose({ x: 0, y: 0, title: "d", options: OPTIONS });
  assert.equal(await third, null);
  assert.equal(t.menu.hide(), true);
  assert.equal(await fourth, null);
  assert.equal(t.menu.hide(), false);
});
