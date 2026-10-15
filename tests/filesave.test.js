import test from "node:test";
import assert from "node:assert/strict";
import { createModel, LAND, N } from "../app/model.js";
import { cleanFileName, downloadMap, pickMapFile, readMapFile } from "../app/filesave.js";
import { encodeMap } from "../app/mapfile.js";

function stubGlobal(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else delete globalThis[name];
  });
}


// A hand-built page: just the element calls filesave.js makes.
function fakeDocument() {
  const events = [];
  const element = (tag) => {
    const listeners = {};
    return {
      tag,
      listeners,
      files: [],
      addEventListener: (type, fn) => (listeners[type] = fn),
      click() {
        events.push(["click", tag, this.download ?? null]);
      },
      remove: () => events.push(["remove", tag]),
    };
  };
  const created = [];
  return {
    events,
    created,
    createElement: (tag) => {
      const el = element(tag);
      created.push(el);
      return el;
    },
    body: { append: (el) => events.push(["append", el.tag]) },
  };
}

test("cleanFileName keeps safe characters, caps at 60, defaults to map", () => {
  assert.equal(cleanFileName("Rome: 117 AD / v2?"), "Rome 117 AD  v2");
  assert.equal(cleanFileName("  my_map-1  "), "my_map-1");
  assert.equal(cleanFileName("../../etc"), "etc");
  assert.equal(cleanFileName("x".repeat(80)).length, 60);
  assert.equal(cleanFileName("???"), "map");
  assert.equal(cleanFileName(undefined), "map");
});

test("downloadMap links a .ahmap object URL, clicks it and revokes the URL", async (t) => {
  const doc = fakeDocument();
  stubGlobal(t, "document", doc);
  const made = [];
  const revoked = [];
  t.mock.method(URL, "createObjectURL", (blob) => (made.push(blob), "blob:fake"));
  t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const model = createModel(new Uint8Array(N * N).fill(LAND), N);
  const name = await downloadMap(model.snapshot(), "Rome: 117");
  assert.equal(name, "Rome 117");
  assert.equal(made.length, 1);
  assert.ok(made[0].size > 0);
  assert.deepEqual(doc.events.find((e) => e[0] === "click"), ["click", "a", "Rome 117.ahmap"]);
  assert.equal(doc.created[0].href, "blob:fake");
  t.mock.timers.tick(1000);
  assert.deepEqual(revoked, ["blob:fake"]);
});

test("pickMapFile resolves the chosen file, or null on cancel", async (t) => {
  const doc = fakeDocument();
  stubGlobal(t, "document", doc);

  const chosen = pickMapFile();
  const input = doc.created[0];
  assert.equal(input.type, "file");
  assert.equal(input.accept, ".ahmap");
  input.files = ["the-file"];
  input.listeners.change();
  assert.equal(await chosen, "the-file");

  const cancelled = pickMapFile();
  doc.created[1].listeners.cancel();
  assert.equal(await cancelled, null);
});

test("readMapFile validates through decodeMap", async () => {
  const model = createModel(new Uint8Array(N * N).fill(LAND), N);
  const blob = await encodeMap(model.snapshot());
  assert.equal((await readMapFile(blob, [])).name, "Untitled map");
  await assert.rejects(readMapFile(new Blob(["nope"]), []), /not an AltHistoryMap file/);
});
