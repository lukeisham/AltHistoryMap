// Crash recovery (IndexedDB) and remembered view settings (localStorage). Neither is ever
// allowed to break the app: every failure is logged and the app carries on without it.

import { encodeMap } from "./mapfile.js";
import { isAllowedView, soloView } from "./layers.js";
import { LAYERS } from "./model.js";

const DB_NAME = "althistorymap";
const STORE = "recovery";
const KEY = "current";
const INTERVAL_MS = 60_000;
const PREFS_KEY = "ahm.prefs";
const MODES = ["view", "edit"];
const DEFAULT_PREFS = { mode: "view", layer: "political", view: ["political"], cityColour: "neutral" };

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Waiting for the transaction to complete, not just the request, is what makes a write durable.
async function inStore(mode, act) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, mode);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const result = await act(tx.objectStore(STORE));
    await done;
    return result;
  } finally {
    db.close();
  }
}

/**
 * Writes one recovery copy of the model now.
 * @param {{snapshot: () => object, revision: number}} model
 * @returns {Promise<boolean>} False when the write failed (already logged).
 */
export async function writeRecovery(model) {
  try {
    const data = model.snapshot();
    const blob = await encodeMap(data);
    await inStore("readwrite", (store) => request(store.put({ blob, name: data.name, time: Date.now() }, KEY)));
    return true;
  } catch (error) {
    console.error("recovery copy could not be written", error);
    return false;
  }
}

/**
 * Keeps a recovery copy while the map has unsaved changes.
 * @param {{isDirty: () => boolean, snapshot: () => object, revision: number}} model
 * @returns {() => void} Stops the timer.
 */
export function startRecovery(model) {
  let writing = false;
  let lastWritten = null;
  const timer = setInterval(async () => {
    if (writing || !model.isDirty()) return;
    // Opening another map swaps the planes object, so revision numbers alone cannot tell maps apart.
    const state = { revision: model.revision, planes: model.snapshot().planes };
    if (lastWritten?.revision === state.revision && lastWritten.planes === state.planes) return;
    writing = true;
    if (await writeRecovery(model)) lastWritten = state;
    writing = false;
  }, INTERVAL_MS);
  return () => clearInterval(timer);
}

/**
 * @returns {Promise<{blob: Blob, name: string, time: number} | null>} The recovery copy, if any.
 */
export async function readRecovery() {
  try {
    return (await inStore("readonly", (store) => request(store.get(KEY)))) ?? null;
  } catch (error) {
    console.error("recovery copy could not be read", error);
    return null;
  }
}

/** Deletes the recovery copy. */
export async function clearRecovery() {
  try {
    await inStore("readwrite", (store) => request(store.delete(KEY)));
  } catch (error) {
    console.error("recovery copy could not be cleared", error);
  }
}

/**
 * @returns {{mode: string, layer: string, view: string[], cityColour: string}} The remembered mode, layer,
 *   View-mode layers and city colour choice, or the defaults. A stored view that is not allowed becomes the stored layer alone.
 */
export function loadPrefs() {
  try {
    const stored = JSON.parse(globalThis.localStorage.getItem(PREFS_KEY) ?? "null");
    const layer = LAYERS.includes(stored?.layer) ? stored.layer : DEFAULT_PREFS.layer;
    return {
      mode: MODES.includes(stored?.mode) ? stored.mode : DEFAULT_PREFS.mode,
      layer,
      view: isAllowedView(stored?.view) ? stored.view : soloView(layer),
      cityColour: stored?.cityColour === "nation" ? "nation" : "neutral",
    };
  } catch (error) {
    console.warn("saved settings could not be read", error);
    return { ...DEFAULT_PREFS };
  }
}

/**
 * Remembers the mode, layer, View-mode layers and city colour choice for the next visit.
 * @param {{mode: string, layer: string, view: string[], cityColour: string}} prefs
 */
export function savePrefs({ mode, layer, view, cityColour }) {
  try {
    globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify({ mode, layer, view, cityColour }));
  } catch (error) {
    console.warn("settings could not be saved", error);
  }
}
