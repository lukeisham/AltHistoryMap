// Wiring only: builds the model and renderer, hands each piece of the page to its module, and
// runs the start-up checks (starting map, crash recovery, leaving with unsaved work).

import { loadBasemap, loadScenarioBlob } from "./api.js";
import { createModel } from "./model.js";
import { decodeMap } from "./mapfile.js";
import { loadPrefs, savePrefs, readRecovery, clearRecovery, startRecovery } from "./recovery.js";
import { GLYPHS } from "./glyphs.js";
import { createRenderer } from "./render.js";
import { createFlagDesigner } from "./flagdesigner.js";
import { createAppState, keepSelectionsValid } from "./state.js";
import { createEditor } from "./editor.js";
import { createKeys } from "./keys.js";
import { createStage } from "./stage.js";
import { createNameField } from "./namefield.js";
import { createMarkerInfo } from "./markerinfo.js";
import { createDialogs } from "./dialogs.js";
import { createMessages } from "./messages.js";
import { createActions } from "./actions.js";
import { createDesigns } from "./designs.js";
import { bindHeader } from "./header.js";
import { bindLayerBar } from "./layerbar.js";
import { lookFor } from "./layers.js";
import { bindToolPanel } from "./toolpanel.js";
import { bindPalette } from "./palette.js";
import { bindSymbols } from "./symbols.js";
import { bindFlagStrip } from "./flagstrip.js";
import { bindFileDrop } from "./filedrop.js";
import { bindScenarios } from "./scenarios.js";

// Editing needs room for the tool panel and a pointer; narrower windows only look around.
const NARROW_QUERY = "(max-width: 719px)";
const START_SCENARIO = "blank-world";

const part = (name) => document.querySelector(`[data-role="${name}"]`);

async function startingMap(model, glyphIds) {
  const untitled = model.name;
  try {
    const data = await decodeMap(await loadScenarioBlob(START_SCENARIO), glyphIds);
    model.replace({ ...data, name: untitled, origin: null });
  } catch (error) {
    console.warn("main: the blank world scenario was not loaded; starting with an empty map", error);
  }
}

async function offerRecovery(dialogs, actions) {
  const copy = await readRecovery();
  if (!copy) return;
  const choice = await dialogs.choose({
    title: "Restore your unsaved map?",
    body: `A copy of "${copy.name}" from ${new Date(copy.time).toLocaleString()} was kept when the page closed with unsaved changes.`,
    choices: [
      { id: "restore", label: "Restore", primary: true },
      { id: "discard", label: "Discard" },
    ],
  });
  if (choice === "restore") await actions.restore(copy.blob);
  else if (choice === "discard") await clearRecovery();
}

async function main() {
  const messages = createMessages(part("message"));
  const say = messages.say;
  const narrow = window.matchMedia(NARROW_QUERY);
  const prefs = loadPrefs();
  const glyphIds = GLYPHS.map((glyph) => glyph.id);
  const state = createAppState({ mode: narrow.matches ? "view" : prefs.mode, layer: prefs.layer, view: prefs.view, cityColour: prefs.cityColour, glyph: glyphIds[0] });

  say("Loading the map...");
  let base;
  try {
    base = await loadBasemap();
  } catch (error) {
    console.error("main: the base map did not load", error);
    say(error.message);
    return;
  }
  const model = createModel(base);
  await startingMap(model, glyphIds);
  messages.clear();

  const canvas = part("canvas");
  const renderer = createRenderer({ canvas, model, glyphs: GLYPHS });
  renderer.setLook(lookFor(state.get()));
  renderer.setCityColour(state.get().cityColour);
  renderer.zoomHome();
  state.subscribe((value, changed) => {
    if (changed.includes("mode") || changed.includes("layer") || changed.includes("view")) renderer.setLook(lookFor(value));
    if (changed.includes("cityColour")) renderer.setCityColour(value.cityColour);
  });

  const dialogs = createDialogs(part("app-dialog"));
  const editor = createEditor({ model, state, say });
  const designer = createFlagDesigner({ dialog: part("flag-designer"), getPalette: () => model.palette });
  const designs = createDesigns({ designer, model, state, editor, say });
  const stageBox = part("stage");

  const nameField = createNameField({
    form: part("name-field"),
    input: part("name-input"),
    submit: part("name-submit"),
    cancelButton: part("name-cancel"),
    stage: stageBox,
  });
  const markerInfo = createMarkerInfo({
    box: part("marker-info"),
    name: part("info-name"),
    kind: part("info-kind"),
    actions: part("info-actions"),
    renameButton: part("info-rename"),
    capitalButton: part("info-capital"),
    deleteButton: part("info-delete"),
    stage: stageBox,
  });

  const keys = createKeys({ state, editor, dismiss: () => stage.dismiss(), say });
  const stage = createStage({
    canvas,
    renderer,
    model,
    state,
    editor,
    nameField,
    markerInfo,
    designs,
    say,
    glyphIds,
    isPanHeld: keys.isPanHeld,
    readout: { coord: part("coord"), zoom: part("zoom") },
    zoomButtons: { zoomIn: part("zoom-in"), zoomOut: part("zoom-out"), home: part("zoom-home") },
  });
  document.addEventListener("keydown", keys.onKeyDown);
  document.addEventListener("keyup", keys.onKeyUp);
  window.addEventListener("blur", keys.onBlur);

  const refreshChrome = () => {
    header.refresh();
    stage.refresh();
  };
  const actions = createActions({ model, renderer, dialogs, say, glyphIds, onChange: () => refreshChrome() });
  const header = bindHeader({ root: document.querySelector(".app-header"), state, model, actions });
  bindFileDrop({ target: document, onFile: (file) => actions.openFile(file) });
  bindLayerBar({ root: document.querySelector(".layerbar"), state, model, editor, say });
  bindToolPanel({
    toolsEl: part("tools"),
    brushInput: part("brush"),
    brushValue: part("brush-value"),
    flagsSection: part("flags-section"),
    nameTagRow: part("name-tag-row"),
    nameTagInput: part("name-tag"),
    capitalRow: part("capital-row"),
    capitalInput: part("capital"),
    state,
  });
  bindPalette({ container: part("palette"), colourInput: part("colour-input"), state, model, editor, say });
  bindSymbols({ container: part("symbols"), glyphs: GLYPHS, state });
  bindFlagStrip({
    container: part("flags"),
    newButton: part("flag-new"),
    editButton: part("flag-edit"),
    state,
    model,
    designs,
  });
  // An earlier confirmation or warning no longer describes the map once it changes.
  model.onChange(() => messages.clear());
  // After the palette and flag list have redrawn, so their marks follow the repaired choices.
  model.onChange(() => keepSelectionsValid(state, model));
  model.onChange(refreshChrome);

  state.subscribe((value, changed) => {
    if (changed.includes("mode")) document.body.dataset.mode = value.mode;
  });
  document.body.dataset.mode = state.get().mode;

  // A window too narrow to edit in shows View, but the remembered mode survives for the next wide visit.
  const remembered = { mode: prefs.mode, layer: prefs.layer, view: prefs.view, cityColour: prefs.cityColour };
  let forcingView = false;
  state.subscribe((value, changed) => {
    if (changed.includes("mode") && !forcingView) remembered.mode = value.mode;
    if (changed.includes("layer")) remembered.layer = value.layer;
    if (changed.includes("view")) remembered.view = value.view;
    if (changed.includes("cityColour")) remembered.cityColour = value.cityColour;
    if (["mode", "layer", "view", "cityColour"].some((key) => changed.includes(key))) savePrefs(remembered);
  });
  const applyWidth = () => {
    header.setNarrow(narrow.matches);
    forcingView = narrow.matches;
    state.set({ mode: narrow.matches ? "view" : remembered.mode });
    forcingView = false;
  };
  narrow.addEventListener("change", applyWidth);
  applyWidth();

  window.addEventListener("beforeunload", (event) => {
    if (!actions.isDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  refreshChrome();
  bindScenarios({ container: part("scenarios"), actions, say });
  await offerRecovery(dialogs, actions);
  startRecovery(model);
}

main().catch((error) => {
  console.error("main: start-up failed", error);
  part("message").textContent = "AltHistoryMap could not start. Reload the page to try again.";
});
