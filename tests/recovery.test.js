import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createModel, LAND, N } from "../app/model.js";
import { decodeMap } from "../app/mapfile.js";
import { writeRecovery, startRecovery, readRecovery, clearRecovery, loadPrefs, savePrefs } from "../app/recovery.js";

function stubGlobal(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else delete globalThis[name];
  });
}


// Implements only the calls recovery.js makes: open, createObjectStore, transaction, get/put/delete, close.
function fakeIndexedDB({ failOpen = false } = {}) {
  const stores = new Map();
  const later = (fn) => queueMicrotask(fn);
  return {
    stores,
    open(name) {
      const req = {};
      later(() => {
        if (failOpen) {
          req.error = new Error("blocked");
          return req.onerror?.();
        }
        const db = {
          createObjectStore: (store) => stores.set(store, new Map()),
          transaction(store) {
            const tx = {
              objectStore: () => ({
                get: (key) => ask(() => stores.get(store).get(key)),
                put: (value, key) => ask(() => void stores.get(store).set(key, value)),
                delete: (key) => ask(() => void stores.get(store).delete(key)),
              }),
            };
            function ask(work) {
              const r = {};
              later(() => {
                r.result = work();
                r.onsuccess?.();
                later(() => tx.oncomplete?.());
              });
              return r;
            }
            return tx;
          },
          close() {},
        };
        req.result = db;
        if (!stores.has("recovery")) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

function dirtyModel() {
  const model = createModel(new Uint8Array(N * N).fill(LAND), N);
  model.name = "Unsaved work";
  model.beginStroke({ tool: "paint", layer: "political", colour: 1, size: 3 });
  model.strokeTo(100, 100);
  model.endStroke();
  return model;
}

async function until(check) {
  for (let i = 0; i < 200; i++) {
    const value = await check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.fail("condition never became true");
}

test("AC-4: a recovery copy is written, read back, restored and cleared", async (t) => {
  stubGlobal(t, "indexedDB", fakeIndexedDB());
  assert.equal(await readRecovery(), null);
  const model = dirtyModel();
  assert.equal(await writeRecovery(model), true);

  const saved = await readRecovery();
  assert.equal(saved.name, "Unsaved work");
  assert.ok(Math.abs(Date.now() - saved.time) < 60_000);
  const restored = await decodeMap(saved.blob, []);
  assert.equal(restored.planes.political[100 * N + 100], 1);

  await clearRecovery();
  assert.equal(await readRecovery(), null);
});

test("startRecovery writes every 60 s only while dirty, and stops on request", async (t) => {
  stubGlobal(t, "indexedDB", fakeIndexedDB());
  mock.timers.enable({ apis: ["setInterval"] });
  const model = dirtyModel();
  const stop = startRecovery(model);
  try {
    mock.timers.tick(60_000);
    const first = await until(readRecovery);
    assert.equal(first.name, "Unsaved work");

    await clearRecovery();
    model.markSaved();
    mock.timers.tick(60_000);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(await readRecovery(), null, "a clean map writes nothing");
  } finally {
    stop();
    mock.timers.reset();
  }
});

test("a failing IndexedDB is logged and the app keeps going", async (t) => {
  stubGlobal(t, "indexedDB", fakeIndexedDB({ failOpen: true }));
  const error = t.mock.method(console, "error", () => {});
  assert.equal(await writeRecovery(dirtyModel()), false);
  assert.equal(await readRecovery(), null);
  await clearRecovery();
  assert.equal(error.mock.callCount(), 3);
});

test("prefs default, round-trip, and survive a localStorage that throws", (t) => {
  const store = new Map();
  stubGlobal(t, "localStorage", { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  const defaults = { mode: "view", layer: "political", view: ["political"], cityColour: "neutral" };
  assert.deepEqual(loadPrefs(), defaults);
  savePrefs({ mode: "edit", layer: "province", view: ["culture"], cityColour: "nation" });
  assert.deepEqual(loadPrefs(), { mode: "edit", layer: "province", view: ["culture"], cityColour: "nation" });
  store.set("ahm.prefs", JSON.stringify({ mode: "view", layer: "culture" }));
  assert.deepEqual(loadPrefs(), { mode: "view", layer: "culture", view: ["culture"], cityColour: "neutral" }, "an older save has no view: the layer alone");
  store.set("ahm.prefs", JSON.stringify({ mode: "view", layer: "culture", view: ["political", "culture"] }));
  assert.deepEqual(loadPrefs().view, ["culture"], "Political and Culture never share a view");
  store.set("ahm.prefs", JSON.stringify({ mode: "hacked", layer: 5, view: "all" }));
  assert.deepEqual(loadPrefs(), defaults);
  store.set("ahm.prefs", "{not json");
  t.mock.method(console, "warn", () => {});
  assert.deepEqual(loadPrefs(), defaults);
});

test("FR-10: every localStorage access may throw", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const boom = () => {
    throw new Error("denied");
  };
  stubGlobal(t, "localStorage", { getItem: boom, setItem: boom });
  assert.deepEqual(loadPrefs(), { mode: "view", layer: "political", view: ["political"], cityColour: "neutral" });
  assert.doesNotThrow(() => savePrefs({ mode: "edit", layer: "province", view: ["province"] }));
  assert.equal(warn.mock.callCount(), 2);
});
