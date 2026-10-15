// The file-level actions behind the header and the scenario bar: open, save, save as, PNG, scenarios,
// and the question asked before unsaved work would be lost.

import { MapFileError, decodeMap, asScenarioCopy } from "./mapfile.js";
import { downloadMap, downloadBlob, pickMapFile, readMapFile, cleanFileName } from "./filesave.js";
import { clearRecovery } from "./recovery.js";
import { loadScenarioBlob } from "./api.js";
import { pngFileName } from "./render.js";
import { MAX_NAME } from "./model.js";

const DEFAULT_NOTE = "This scenario is an approximate sketch, not a historian's map.";

const REAL_DEPS = { downloadMap, pickMapFile, readMapFile, decodeMap, clearRecovery, loadScenarioBlob, saveBlob: downloadBlob };

/**
 * @param {{
 *   model: object,
 *   renderer: {exportPng: () => Promise<Blob>, getLook: () => string},
 *   dialogs: {choose: Function, askName: Function},
 *   say: (text: string) => void,
 *   glyphIds: string[],
 *   onChange: () => void,
 *   deps?: typeof REAL_DEPS
 * }} options `onChange` runs after anything that changes the saved state or the map name.
 *   `deps` swaps the browser-facing helpers, for tests.
 * @returns {object} The actions.
 */
export function createActions({ model, renderer, dialogs, say, glyphIds, onChange, deps = REAL_DEPS }) {
  // A restored recovery copy is not on disk yet, but model.replace() marks it clean.
  let restoredUnsaved = false;

  function isDirty() {
    return model.isDirty() || restoredUnsaved;
  }

  // Only MapFileError messages are written for the person; anything else gets the plain fallback.
  function fail(error, fallback) {
    console.warn("actions:", error);
    say(error instanceof MapFileError ? error.message : fallback);
  }

  function load(data) {
    const wasUnsaved = isDirty();
    restoredUnsaved = false;
    model.replace(data);
    if (wasUnsaved) deps.clearRecovery();
    onChange();
  }

  async function save() {
    try {
      const clean = await deps.downloadMap(model.snapshot(), model.name);
      model.markSaved();
      restoredUnsaved = false;
      await deps.clearRecovery();
      onChange();
      say(`Saved as ${clean}.ahmap`);
      return true;
    } catch (error) {
      fail(error, "The map could not be saved.");
      return false;
    }
  }

  // True when it is safe to replace the map: nothing unsaved, or the person saved or chose to discard.
  async function guardUnsaved() {
    if (!isDirty()) return true;
    const choice = await dialogs.choose({
      title: "Unsaved changes",
      body: `"${model.name}" has changes that are not saved.`,
      choices: [
        { id: "save", label: "Save first", primary: true },
        { id: "discard", label: "Discard changes" },
        { id: "cancel", label: "Cancel" },
      ],
    });
    if (choice === "save") return save();
    return choice === "discard";
  }

  /** Asks about unsaved work, then loads a map file. */
  async function openFile(file) {
    if (!(await guardUnsaved())) return;
    try {
      load(await deps.readMapFile(file, glyphIds));
      say(`Opened ${model.name}.`);
    } catch (error) {
      fail(error, "That file could not be opened.");
    }
  }

  return {
    isDirty,
    guardUnsaved,
    save,

    /** Asks for a name, then saves under it. */
    async saveAs() {
      const name = await dialogs.askName({
        title: "Save as",
        label: "Map name",
        value: model.name,
        confirmLabel: "Save",
        preview: (text) => `${cleanFileName(text)}.ahmap`,
      });
      if (name === null) return;
      model.name = name.slice(0, MAX_NAME);
      await save();
    },

    /**
     * Shows the file picker, then opens the map file chosen. The picker must start inside the click that
     * asked for it, or the browser blocks it, so the unsaved-work question comes after the choice of file.
     */
    async open() {
      const file = await deps.pickMapFile();
      if (file) await openFile(file);
    },

    openFile,

    /** Downloads the view and layers on screen as a PNG. */
    async exportPng() {
      try {
        deps.saveBlob(await renderer.exportPng(), pngFileName(model.name, renderer.getLook()));
      } catch (error) {
        fail(error, "The picture could not be saved.");
      }
    },

    /**
     * Opens an editable copy of a bundled scenario, after the unsaved-work question.
     * @param {{id: string, title: string, note: string}} entry
     */
    async openScenario(entry) {
      if (!(await guardUnsaved())) return;
      let blob;
      try {
        blob = await deps.loadScenarioBlob(entry.id);
      } catch (error) {
        // api.js writes its messages for the person using the app.
        console.warn("actions:", error);
        say(error.message);
        return;
      }
      try {
        load(asScenarioCopy(await deps.decodeMap(blob, glyphIds), entry));
        say(entry.note || DEFAULT_NOTE);
      } catch (error) {
        fail(error, "That scenario could not be opened.");
      }
    },

    /**
     * Puts a recovery copy back as the open map. It counts as unsaved until the person saves it.
     * @param {Blob} blob
     */
    async restore(blob) {
      try {
        const data = await deps.decodeMap(blob, glyphIds);
        load(data);
        restoredUnsaved = true;
        onChange();
        say("Restored your unsaved map. Save it to keep it.");
      } catch (error) {
        fail(error, "The recovery copy could not be restored.");
      }
    },
  };
}
