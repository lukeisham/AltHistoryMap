import test from "node:test";
import assert from "node:assert/strict";
import { bindTermTips } from "../app/termtip.js";
import { fakeDocument, fakeDialog } from "./fakedom.js";

function setup() {
  const doc = fakeDocument();
  const dialog = fakeDialog(doc);
  const term = doc.createElement("button");
  term.setAttribute("data-term", "division:pale");
  const plain = doc.createElement("button");
  dialog.append(term, plain);
  term.closest = (selector) => (selector === "[data-term]" ? term : null);
  plain.closest = () => null;
  const props = {};
  const tips = bindTermTips(dialog);
  const tip = dialog.find((n) => n.attrs.role === "tooltip");
  tip.style = { setProperty: (name, value) => (props[name] = value) };
  tip.getBoundingClientRect = () => ({ width: 200, height: 60 });
  term.getBoundingClientRect = () => ({ left: 40, top: 100, bottom: 120 });
  return { dialog, term, plain, tip, props, tips };
}

test("keyboard focus on a term shows its name and definition and links it to the element, and focus leaving hides it", () => {
  const t = setup();
  assert.equal(t.tip.hidden, true);
  t.dialog.dispatch("focusin", { target: t.term });
  assert.equal(t.tip.hidden, false);
  assert.equal(t.tip.children[0].textContent, "Per pale");
  assert.match(t.tip.children[1].textContent, /vertical line/);
  assert.equal(t.term.getAttribute("aria-describedby"), t.tip.id);
  assert.deepEqual([t.props["--at-x"], t.props["--at-y"]], ["40", "126"], "just below the term");
  t.dialog.dispatch("focusout", { target: t.term });
  assert.equal(t.tip.hidden, true);
});

test("Escape, a press and the dialog closing all hide it", () => {
  const t = setup();
  for (const [type, event] of [["keydown", { key: "Escape" }], ["pointerdown", {}], ["close", {}]]) {
    t.dialog.dispatch("focusin", { target: t.term });
    assert.equal(t.tip.hidden, false);
    t.dialog.dispatch(type, { target: t.term, ...event });
    assert.equal(t.tip.hidden, true, `${type} left it showing`);
  }
});

test("a pointer resting on a term shows it after a short delay, and leaving first cancels it", async () => {
  const t = setup();
  t.dialog.dispatch("pointerover", { target: t.term });
  t.dialog.dispatch("pointerout", { target: t.term });
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(t.tip.hidden, true);
  t.dialog.dispatch("pointerover", { target: t.term });
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(t.tip.hidden, false);
  t.tips.hide();
});

test("an element with no term does nothing, and near the bottom edge the pop-up flips above the term", () => {
  const t = setup();
  t.dialog.dispatch("focusin", { target: t.plain });
  assert.equal(t.tip.hidden, true);
  t.term.getBoundingClientRect = () => ({ left: 900, top: 780, bottom: 800 });
  t.dialog.dispatch("focusin", { target: t.term });
  assert.deepEqual([t.props["--at-x"], t.props["--at-y"]], ["794", "714"]);
});
