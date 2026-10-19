// The Key Facts dialog for one country (a political palette colour). index.html holds the <dialog>;
// this module fills it on first use and resolves open() with the facts to save, or null when the
// person backs out or was only looking (View mode). The flag and crest sit at the top, then the
// philosophy grid, then the facts. The grid and the style choice steer the Generate buttons
// (namegen.js). It shares the dialog chrome classes of flagdesigner.css and adds countryfacts.css.
// All DOM comes from dialog.ownerDocument, so a test can hand it a fake document.

import { ALIGNMENTS, GOVERNMENTS, MAX_FIELD, MAX_MOTTO, colourNameFor } from "./countrydata.js";
import { STYLES, generateAll, makeDemonym, makeGovernment, makeMotto, makeName, makeRuler } from "./namegen.js";
import { CREST_W, CREST_H, renderCrest } from "./crestcells.js";
import { FLAG_W, FLAG_H } from "./model.js";
import { BLOCK_COLS, BLOCK_ROWS } from "./flagblocks.js";
import { drawThumb } from "./flagstrip.js";
import { drawCells } from "./pngexport.js";
import { hasDragItem, readDragItem } from "./dragitem.js";
import { dialogParts } from "./dialogparts.js";
import { bindTermTips } from "./termtip.js";

/** CSS pixels per cell in the big flag and crest at the top: 120 cells wide makes the flag 240 px. */
export const FLAG_CELL = 2;
export const CREST_CELL = 3;
const THUMB_CELL = 1.5;
const GRID_COLUMNS = 3;
const DATALIST_ID = "kf-governments";

/**
 * Wire a Key Facts dialog to a <dialog>.
 * @param {{
 *   dialog: HTMLDialogElement,
 *   getPalette: () => string[],
 *   getDesigns: () => Uint8Array[],
 *   getCrests: () => object[],
 *   rng: () => number
 * }} options getPalette, getDesigns and getCrests are re-read on every open(); rng is Math.random in the app.
 * @returns {{
 *   open: (start: {colour: number, name: string, record: object | null, editable: boolean}) => Promise<object | null>,
 *   close: () => void
 * }}
 */
export function createCountryFacts({ dialog, getPalette, getDesigns, getCrests, rng }) {
  const doc = dialog.ownerDocument;
  const { el, button, group, canvasFor } = dialogParts(doc);
  let ui = null;

  let palette = [];
  let designs = [];
  let crests = [];
  let colour = 1;
  let facts = null;
  let editable = true;
  let opener = null;
  let pending = null;
  let white = "#fff";

  const TEXT_ROWS = [
    { key: "name", label: "Name", max: MAX_FIELD, make: (v) => makeName(v.style, v.alignment, v.government, rng) },
    { key: "government", label: "Type of government", max: MAX_FIELD, list: DATALIST_ID, make: (v) => makeGovernment(v.alignment, rng) },
    { key: "ruler", label: "Ruler", max: MAX_FIELD, make: (v) => makeRuler(v.style, v.alignment, v.government, rng) },
    { key: "motto", label: "Motto (Latin)", max: MAX_MOTTO, make: (v) => makeMotto(v.alignment, rng) },
    { key: "currency", label: "Currency", max: MAX_FIELD },
    { key: "demonym", label: "Demonym", max: MAX_FIELD, make: (v) => makeDemonym(v.name || v.defaultName, v.style) },
  ];

  function slot(label, width, height) {
    const box = el("figure", "kf-slot");
    const canvas = canvasFor(width, height, "kf-canvas");
    canvas.node.setAttribute("role", "img");
    canvas.node.setAttribute("aria-label", label);
    const hint = el("figcaption", "kf-hint");
    box.append(canvas.node, hint, el("span", "fd-caption", label));
    return { box, canvas, hint };
  }

  function build() {
    const body = el("div", "fd-body");
    const heading = el("h2", "fd-title");

    const flagSlot = slot("Flag", FLAG_W * FLAG_CELL, FLAG_H * FLAG_CELL);
    const crestSlot = slot("Crest", CREST_W * CREST_CELL, CREST_H * CREST_CELL);
    const top = el("div", "kf-top");
    top.append(flagSlot.box, crestSlot.box);
    for (const [target, kind] of [[flagSlot.box, "flag"], [crestSlot.box, "crest"]]) {
      target.addEventListener("dragover", (event) => {
        if (editable && hasDragItem(event)) event.preventDefault();
      });
      target.addEventListener("drop", (event) => onSlotDrop(event, kind));
    }

    const flagRow = group("Flag for this country", "fd-group kf-choices");
    const crestRow = group("Crest for this country", "fd-group kf-choices");
    const flagCaption = el("span", "fd-caption", "Choose a flag");
    const crestCaption = el("span", "fd-caption", "Choose a crest");

    const grid = group("Philosophy", "kf-grid");
    grid.setAttribute("role", "radiogroup");
    const cells = ALIGNMENTS.map(({ id, label }, index) => {
      const node = button(label, () => pickAlignment(id), "kf-cell");
      node.setAttribute("role", "radio");
      node.setAttribute("data-term", `alignment:${id}`);
      node.addEventListener("keydown", (event) => onGridKey(event, index));
      grid.append(node);
      return { id, node };
    });

    const styleSelect = el("select", "kf-input");
    styleSelect.setAttribute("aria-label", "Sound of generated names");
    for (const { id, label } of STYLES) {
      const option = el("option", "", label);
      option.value = id;
      styleSelect.append(option);
    }
    styleSelect.value = STYLES[0].id;
    const allButton = button("Generate all", onGenerateAll);
    const styleRow = el("div", "kf-style");
    styleRow.append(el("span", "fd-caption", "Names sound"), styleSelect, allButton);

    const datalist = el("datalist");
    datalist.setAttribute("id", DATALIST_ID);
    for (const type of GOVERNMENTS) {
      const option = el("option");
      option.value = type;
      datalist.append(option);
    }

    const fieldsBox = el("div", "kf-fields");
    const rows = TEXT_ROWS.map((row) => {
      const input = el("input", "kf-input");
      input.setAttribute("type", "text");
      input.setAttribute("maxlength", String(row.max));
      input.setAttribute("autocomplete", "off");
      input.setAttribute("aria-label", row.label);
      if (row.list) input.setAttribute("list", row.list);
      input.addEventListener("input", () => onTyped(row.key));
      const generate = row.make ? button("Generate", () => onGenerate(row), "fd-btn kf-generate") : null;
      if (generate) generate.setAttribute("aria-label", `Generate ${row.label.toLowerCase()}`);
      fieldsBox.append(el("span", "kf-label", row.label), input, generate ?? el("span"));
      return { ...row, input, generate };
    });

    const status = el("p", "fd-status");
    status.setAttribute("role", "status");
    const actions = el("div", "fd-actions");
    const cancelBtn = button("Cancel", () => settle(null));
    const saveBtn = button("Save", () => settle(collect()), "fd-btn fd-btn-primary");
    actions.append(cancelBtn, saveBtn);

    body.append(heading, top, flagCaption, flagRow, crestCaption, crestRow, el("span", "fd-caption", "Philosophy"), grid, styleRow, datalist, fieldsBox, status, actions);
    dialog.className = "fd";
    dialog.append(body);
    bindTermTips(dialog);

    dialog.addEventListener("close", () => settle(null));
    // The padding-free dialog is covered by .fd-body, so a click that lands on the dialog itself hit the backdrop.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) settle(null);
    });

    return { heading, flagSlot, crestSlot, flagRow, crestRow, flagCaption, crestCaption, cells, styleRow, styleSelect, allButton, rows, status, cancelBtn, saveBtn };
  }

  function readTheme() {
    white = doc.defaultView.getComputedStyle(dialog).getPropertyValue("--flag-white").trim() || white;
  }

  function say(text) {
    ui.status.textContent = text;
  }

  const hex = () => palette[colour - 1];
  const defaultName = () => colourNameFor(hex(), colour);
  const rowOf = (key) => ui.rows.find((row) => row.key === key);
  const values = () => ({
    style: ui.styleSelect.value,
    alignment: facts.alignment,
    government: rowOf("government").input.value.trim(),
    name: rowOf("name").input.value.trim(),
    defaultName: defaultName(),
  });

  function onTyped(key) {
    facts[key] = rowOf(key).input.value;
    if (key === "name") showHeading();
  }

  function onGenerate(row) {
    if (!editable) return;
    const text = row.make(values());
    rowOf(row.key).input.value = text;
    onTyped(row.key);
  }

  function onGenerateAll() {
    if (!editable) return;
    const { style, alignment } = values();
    const made = generateAll({ style, alignment, rng });
    for (const [key, text] of Object.entries(made)) {
      rowOf(key).input.value = text;
      onTyped(key);
    }
  }

  function pickAlignment(id) {
    if (!editable) return;
    facts.alignment = facts.alignment === id ? "" : id;
    redraw();
  }

  // Arrow keys move through the grid and choose as they go, as a radio group does.
  function onGridKey(event, index) {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: GRID_COLUMNS, ArrowUp: -GRID_COLUMNS }[event.key];
    if (!step || !editable) return;
    const next = index + step;
    if (next < 0 || next >= ALIGNMENTS.length) return;
    event.preventDefault();
    ui.cells[next].node.focus();
    pickAlignment(ui.cells[next].id);
  }

  function onSlotDrop(event, kind) {
    if (!editable || !hasDragItem(event)) return;
    event.preventDefault();
    const item = readDragItem(event, { glyphIds: [], designCount: designs.length, crestCount: crests.length });
    if (!item || item.kind !== kind) return;
    facts[kind] = kind === "crest" ? item.crest : item.design;
    redraw();
  }

  function showHeading() {
    ui.heading.textContent = `Key facts: ${facts.name.trim() || defaultName()}`;
  }

  function choice(label, index, key, draw) {
    const node = button("", () => {
      facts[key] = index;
      redraw();
    }, "fd-btn kf-choice");
    node.setAttribute("aria-label", label);
    node.setAttribute("title", label);
    if (draw) node.append(draw());
    else node.textContent = "None";
    return { index, node };
  }

  // Sized in device pixels with no context transform, because drawThumb and drawCells take the cell size from the canvas width.
  function thumbCanvas(cols, rows) {
    const scale = doc.defaultView?.devicePixelRatio || 1;
    const canvas = el("canvas", "kf-thumb");
    canvas.width = Math.round(cols * THUMB_CELL * scale);
    canvas.height = Math.round(rows * THUMB_CELL * scale);
    canvas.style.width = `${cols * THUMB_CELL}px`;
    canvas.style.height = `${rows * THUMB_CELL}px`;
    canvas.setAttribute("aria-hidden", "true");
    return canvas;
  }

  function renderChoosers() {
    const flagChoices = [choice("No flag", -1, "flag", null)];
    designs.forEach((cells, i) => {
      flagChoices.push(
        choice(`Flag design ${i + 1}`, i, "flag", () => {
          const canvas = thumbCanvas(BLOCK_COLS, BLOCK_ROWS);
          drawThumb(canvas, cells, palette, white, hex());
          return canvas;
        }),
      );
    });
    const crestChoices = [choice("No crest", -1, "crest", null)];
    crests.forEach((cells, i) => {
      crestChoices.push(
        choice(`Crest ${i + 1}`, i, "crest", () => {
          const canvas = thumbCanvas(CREST_W, CREST_H);
          drawCells(canvas.getContext("2d"), cells, CREST_W, palette, white, canvas.width / CREST_W);
          return canvas;
        }),
      );
    });
    ui.flagRow.replaceChildren(...flagChoices.map((c) => c.node));
    ui.crestRow.replaceChildren(...crestChoices.map((c) => c.node));
    ui.flagChoices = flagChoices;
    ui.crestChoices = crestChoices;
  }

  function drawSlot({ canvas, hint }, cells, cols, rows, cell, empty) {
    canvas.ctx.clearRect(0, 0, cols * cell, rows * cell);
    if (cells) drawCells(canvas.ctx, cells, cols, palette, white, cell);
    hint.textContent = cells ? "" : empty;
  }

  function redraw() {
    drawSlot(ui.flagSlot, designs[facts.flag] ?? null, FLAG_W, FLAG_H, FLAG_CELL, editable ? "No flag yet. Pick one below or drag one here." : "No flag yet.");
    drawSlot(ui.crestSlot, crests[facts.crest] ?? null, CREST_W, CREST_H, CREST_CELL, editable ? "No crest yet. Pick one below or drag one here." : "No crest yet.");
    for (const { index, node } of ui.flagChoices) node.setAttribute("aria-pressed", String(facts.flag === index));
    for (const { index, node } of ui.crestChoices) node.setAttribute("aria-pressed", String(facts.crest === index));
    for (const { id, node } of ui.cells) {
      node.setAttribute("aria-checked", String(facts.alignment === id));
      node.setAttribute("tabindex", facts.alignment === id || (facts.alignment === "" && id === ALIGNMENTS[0].id) ? "0" : "-1");
    }
  }

  // Cancel and Save are for editing; in View mode one Close button is enough.
  function applyMode() {
    for (const row of ui.rows) {
      row.input.disabled = !editable;
      if (row.generate) row.generate.hidden = !editable;
    }
    for (const { node } of ui.cells) node.setAttribute("aria-disabled", String(!editable));
    for (const node of [ui.flagRow, ui.crestRow, ui.flagCaption, ui.crestCaption]) node.hidden = !editable;
    ui.styleRow.hidden = !editable;
    ui.saveBtn.hidden = !editable;
    ui.cancelBtn.textContent = editable ? "Cancel" : "Close";
  }

  function collect() {
    const text = (key) => rowOf(key).input.value.trim();
    return {
      name: text("name"),
      ruler: text("ruler"),
      government: text("government"),
      motto: text("motto") || makeMotto(facts.alignment, rng),
      currency: text("currency"),
      demonym: text("demonym"),
      alignment: facts.alignment,
      flag: facts.flag,
      crest: facts.crest,
    };
  }

  function settle(result) {
    if (!pending) return;
    const { resolve } = pending;
    pending = null;
    resolve(result);
    if (dialog.open) dialog.close();
    opener?.focus?.();
    opener = null;
  }

  return {
    open({ colour: start, record, editable: canEdit }) {
      if (pending) settle(null);
      palette = [...getPalette()];
      designs = getDesigns();
      crests = getCrests().map((crest) => renderCrest(crest));
      if (!ui) ui = build();
      readTheme();
      colour = start;
      editable = canEdit;
      facts = { name: "", ruler: "", government: "", motto: "", currency: "", demonym: "", alignment: "", flag: -1, crest: -1, ...record };

      for (const row of ui.rows) row.input.value = facts[row.key];
      rowOf("name").input.setAttribute("placeholder", defaultName());
      showHeading();
      renderChoosers();
      applyMode();
      say("");
      redraw();

      opener = doc.activeElement;
      dialog.setAttribute("aria-label", ui.heading.textContent);
      dialog.showModal();
      return new Promise((resolve) => {
        pending = { resolve };
      });
    },

    close() {
      settle(null);
    },
  };
}
