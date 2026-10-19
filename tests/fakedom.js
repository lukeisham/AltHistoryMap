// A small fake DOM shared by the dialog tests: only what flagdesigner.js, crestmaker.js,
// countryfacts.js, palette.js and dialogparts.js touch. Not a test file (the runner looks for *.test.js).

export class FakeElement {
  constructor(tag, doc) {
    this.tagName = tag;
    this.ownerDocument = doc;
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.listeners = {};
    this.style = { setProperty() {} };
    this.className = "";
    this.textContent = "";
    this.disabled = false;
    this.hidden = false;
    this.value = "";
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
    return { setTransform: noop, fillRect: noop, clearRect: noop, strokeRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop, setLineDash: noop };
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 384, height: 256 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
  click() { this.dispatch("click"); }
  toBlob(done) { done(new Blob([`png ${this.width}x${this.height}`], { type: "image/png" })); }
  focus() { this.ownerDocument.activeElement = this; }
  walk(fn) { fn(this); for (const c of this.children) c.walk(fn); }
  find(pred) { let hit = null; this.walk((n) => { if (!hit && pred(n)) hit = n; }); return hit; }
  findAll(pred) { const hits = []; this.walk((n) => { if (pred(n)) hits.push(n); }); return hits; }
}

export function fakeDocument() {
  const doc = {
    activeElement: null,
    defaultView: { devicePixelRatio: 1, innerWidth: 1000, innerHeight: 800, getComputedStyle: () => ({ getPropertyValue: () => "" }) },
    createElement: (tag) => new FakeElement(tag, doc),
  };
  doc.documentElement = new FakeElement("html", doc);
  return doc;
}

export function fakeDialog(doc) {
  const dialog = new FakeElement("dialog", doc);
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatch("close"); };
  return dialog;
}
