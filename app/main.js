// Wiring only: builds the model and renderer, hands each piece of the page to its module, and
// runs the start-up checks (starting map, crash recovery, leaving with unsaved work).

import { loadBasemap, loadScenarioBlob } from "./api.js";
import { createModel } from "./model.js";
import { decodeMap } from "./mapfile.js";
import { loadPrefs, savePrefs, readRecovery, clearRecovery, startRecovery } from "./recovery.js";
import { GLYPHS } from "./glyphs.js";
import { createRenderer } from "./render.js";
import { createFlagDesigner } from "./flagdesigner.js";
import { createCrestMaker } from "./crestmaker.js";
import { createCountryFacts } from "./countryfacts.js";
import { createCountries } from "./countries.js";
import { createRelations } from "./relations.js";
import { createRelationMenu } from "./relationmenu.js";
import { renderCrest, renderShieldOnly } from "./crestcells.js";
import { downloadBlob } from "./filesave.js";
import { createFlagZoom } from "./flagzoom.js";
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
import { createCrests } from "./crests.js";
import { bindHeader } from "./header.js";
import { bindLayerBar } from "./layerbar.js";
import { lookFor } from "./layers.js";
import { bindToolPanel } from "./toolpanel.js";
import { bindPalette } from "./palette.js";
import { readTheme, shownColourIndex } from "./layerimage.js";
import { bindSymbols } from "./symbols.js";
import { bindFlagStrip } from "./flagstrip.js";
import { bindCrestStrip } from "./creststrip.js";
import { bindFileDrop } from "./filedrop.js";
import { bindScenarios } from "./scenarios.js";

// Editing needs room for the tool panel and a pointer; narrower windows only look around.
const NARROW_QUERY = "(max-width: 719px)";
const START_SCENARIO = "blank-world";

const part = (name) => document.querySelector(`[data-role="${name}"]`);

// Lets the browser paint and answer input between two long steps of start-up.
const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

// `blob` is the starting scenario's fetch, begun before the base map finished so the two downloads overlap.
async function startingMap(model, glyphIds, blob) {
  const untitled = model.name;
  try {
    const data = await decodeMap(await blob, glyphIds);
    await yieldToBrowser();
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
  const state = createAppState({ mode: narrow.matches ? "view" : prefs.mode, layer: prefs.layer, view: prefs.view, cityColour: prefs.cityColour, countryNames: prefs.countryNames, glyph: glyphIds[0] });

  say("Loading the map...");
  const startingBlob = loadScenarioBlob(START_SCENARIO);
  // startingMap reports a failed fetch; this only stops the browser flagging it as unhandled when the base map fails first and start-up ends.
  startingBlob.catch(() => {});
  let base;
  try {
    base = await loadBasemap();
  } catch (error) {
    console.error("main: the base map did not load", error);
    say(error.message);
    return;
  }
  await yieldToBrowser();
  const model = createModel(base);
  await startingMap(model, glyphIds, startingBlob);
  await yieldToBrowser();
  messages.clear();

  const canvas = part("canvas");
  const renderer = createRenderer({ canvas, model, glyphs: GLYPHS });
  renderer.setLook(lookFor(state.get()));
  renderer.setCityColour(state.get().cityColour);
  renderer.setCountryNames(state.get().countryNames);
  renderer.zoomHome();
  state.subscribe((value, changed) => {
    if (changed.includes("mode") || changed.includes("layer") || changed.includes("view")) renderer.setLook(lookFor(value));
    if (changed.includes("cityColour")) renderer.setCityColour(value.cityColour);
    if (changed.includes("countryNames")) renderer.setCountryNames(value.countryNames);
  });

  const dialogs = createDialogs(part("app-dialog"));
  const editor = createEditor({ model, state, say });
  const getPalette = () => model.palette;
  const shownIndex = (hex) => shownColourIndex(hex, model.palette, readTheme(getComputedStyle(canvas)));
  const addColour = (hex) => shownIndex(hex) ?? editor.addColour(hex);
  const designer = createFlagDesigner({
    dialog: part("flag-designer"),
    getPalette,
    addColour,
    getCrests: () => model.crests.map(renderCrest),
    getShields: () => model.crests.map(renderShieldOnly),
    saveBlob: downloadBlob,
  });
  const designs = createDesigns({ designer, model, state, editor, say });
  const maker = createCrestMaker({ dialog: part("crest-maker"), getPalette, addColour, saveBlob: downloadBlob });
  const crests = createCrests({ maker, model, state, editor, say });
  const facts = createCountryFacts({
    dialog: part("country-facts"),
    getPalette,
    getDesigns: () => model.designs,
    getCrests: () => model.crests,
    rng: Math.random,
  });
  const countries = createCountries({ facts, model, editor, say });
  const relationMenu = createRelationMenu({ box: part("relation-menu"), stage: part("stage") });
  const relations = createRelations({ model, editor, menu: relationMenu, say });
  const flagZoom = createFlagZoom({ box: part("flag-zoom"), canvas: part("flag-zoom-canvas"), getPalette });
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
    colonyButton: part("info-colony"),
    deleteButton: part("info-delete"),
    closeButton: part("info-close"),
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
    countries,
    relations,
    relationMenu,
    flagZoom,
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
  bindPalette({ container: part("palette"), colourInput: part("colour-input"), state, model, editor, countries, glyphIds, say, shownColourIndex: shownIndex });
  part("country-facts-open").addEventListener("click", () => countries.open(state.get().colour));
  bindSymbols({ container: part("symbols"), glyphs: GLYPHS, state });
  bindFlagStrip({
    container: part("flags"),
    newButton: part("flag-new"),
    editButton: part("flag-edit"),
    state,
    model,
    designs,
    flagZoom,
  });
  bindCrestStrip({
    container: part("crests"),
    newButton: part("crest-new"),
    editButton: part("crest-edit"),
    state,
    model,
    crests,
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
  const remembered = { mode: prefs.mode, layer: prefs.layer, view: prefs.view, cityColour: prefs.cityColour, countryNames: prefs.countryNames };
  let forcingView = false;
  state.subscribe((value, changed) => {
    if (changed.includes("mode") && !forcingView) remembered.mode = value.mode;
    if (changed.includes("layer")) remembered.layer = value.layer;
    if (changed.includes("view")) remembered.view = value.view;
    if (changed.includes("cityColour")) remembered.cityColour = value.cityColour;
    if (changed.includes("countryNames")) remembered.countryNames = value.countryNames;
    if (["mode", "layer", "view", "cityColour", "countryNames"].some((key) => changed.includes(key))) savePrefs(remembered);
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
