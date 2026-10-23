import test from "node:test";
import assert from "node:assert/strict";
import { createEyeDropperButton } from "../app/eyedropper.js";
import { fakeDocument } from "./fakedom.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));

function build(getDropper) {
  const picked = [];
  let opened = 0;
  const button = createEyeDropperButton({ doc: fakeDocument(), className: "swatch", onPick: (hex) => picked.push(hex), openPicker: () => opened++, getDropper });
  return { button, picked, opened: () => opened };
}

test("the button is labelled for a screen reader and by its tooltip", () => {
  const { button } = build(() => undefined);
  assert.equal(button.getAttribute("aria-label"), "Pick a colour from the screen");
  assert.equal(button.getAttribute("title"), "Pick a colour from the screen");
  assert.match(button.innerHTML, /<svg[^>]*aria-hidden="true"/);
});

test("with an EyeDropper the click hands the sampled colour on; cancelling hands on nothing and warns of nothing", async () => {
  const { button, picked, opened } = build(() => class { open() { return Promise.resolve({ sRGBHex: "#a1b2c3" }); } });
  button.dispatch("click");
  await tick();
  assert.deepEqual(picked, ["#a1b2c3"]);
  assert.equal(opened(), 0);

  const cancelled = build(() => class { open() { return Promise.reject(Object.assign(new Error("cancelled"), { name: "AbortError" })); } });
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    cancelled.button.dispatch("click");
    await tick();
  } finally {
    console.warn = warn;
  }
  assert.deepEqual([cancelled.picked, warnings], [[], []]);
});

test("without an EyeDropper the click opens the + colour picker", () => {
  const { button, picked, opened } = build(() => undefined);
  button.dispatch("click");
  assert.deepEqual([opened(), picked], [1, []]);
});

test("an EyeDropper that fails for another reason is reported, not hidden", async () => {
  const { button, picked } = build(() => class { open() { return Promise.reject(new Error("blocked")); } });
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    button.dispatch("click");
    await tick();
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1);
  assert.deepEqual(picked, []);
});
