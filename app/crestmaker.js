// The crest maker dialog. index.html holds the <dialog>; this module fills it on first use and
// resolves open() with the chosen crest (shield shape, division, ordinary, charge, a supporter on each
// side and the palette colours that paint them, see crestcells.js), or null when the person backs out.
// It shares the dialog chrome classes of flagdesigner.css and adds crestmaker.css. All DOM comes
// from dialog.ownerDocument, so a test can hand it a fake document.

import { SHAPES, DIVISIONS, ORDINARIES, CHARGES, SUPPORTERS, CREST_W, CREST_H, renderCrest } from "./crestcells.js";
import { cellsToPng, drawCells, CREST_PNG_CELL } from "./pngexport.js";
import { dialogParts } from "./dialogparts.js";
import { bindTermTips } from "./termtip.js";

/** CSS pixels per crest cell in the large preview. */
export const PREVIEW_PX = 10;

const CHOICES = [
  { key: "shape", label: "Shield", options: SHAPES },
  { key: "division", label: "Field", options: DIVISIONS },
  { key: "ordinary", label: "Ordinary", options: ORDINARIES },
  { key: "charge", label: "Charge", options: CHARGES },
  { key: "supporterLeft", label: "Left supporter", options: SUPPORTERS },
  { key: "supporterRight", label: "Right supporter", options: SUPPORTERS },
];
// Both supporter rows list the same animals, so they share the `supporter:` definitions in terms.js.
const OPTION_TERM_GROUP = { supporterLeft: "supporter", supporterRight: "supporter" };
const ROLES = [
  { key: "field", label: "Field" },
  { key: "field2", label: "Second field" },
  { key: "ordinaryColour", label: "Ordinary" },
  { key: "chargeColour", label: "Charge" },
  { key: "supporterLeftColour", label: "Left animal" },
  { key: "supporterRightColour", label: "Right animal" },
  { key: "outline", label: "Outline" },
];

/**
 * Wire a crest maker to a <dialog>.
 * @param {{
 *   dialog: HTMLDialogElement,
 *   getPalette: () => string[],
 *   addColour: (hex: string) => number | null,
 *   saveBlob: (blob: Blob, fileName: string) => void
 * }} options getPalette returns hex colours, re-read on every open(). addColour adds a picked
 *   colour to the map's palette and returns its index, or null when the palette is full.
 * @returns {{
 *   open: (start: {crest: object, editing: boolean, fileName: string}) => Promise<object|null>,
 *   close: () => void
 * }}
 */
export function createCrestMaker({ dialog, getPalette, addColour, saveBlob }) {
  const doc = dialog.ownerDocument;
  const { el, button, group, canvasFor } = dialogParts(doc);
  let ui = null;

  let palette = [];
  let crest = null;
  let role = ROLES[0].key;
  let fileName = "crest.png";
  let opener = null;
  let pending = null;
  let white = "#fff";

  function build() {
    const body = el("div", "fd-body");
    const heading = el("h2", "fd-title");

    const choiceRows = CHOICES.map(({ key, label, options }) => {
      const row = group(label, "fd-group");
      const buttons = options.map(({ id, label: optionLabel }) => {
        const node = button(optionLabel, () => choose(key, id));
        node.setAttribute("data-term", `${OPTION_TERM_GROUP[key] ?? key}:${id}`);
        row.append(node);
        return { id, node };
      });
      return { key, label, row, buttons };
    });

    const stage = el("div", "fd-stage");
    const preview = canvasFor(CREST_W * PREVIEW_PX, CREST_H * PREVIEW_PX, "cm-preview");
    preview.node.setAttribute("role", "img");
    preview.node.setAttribute("aria-label", "Preview of the crest");
    const choices = el("div", "cm-choices");
    for (const { key, label, row } of choiceRows) {
      const caption = el("span", "fd-caption", label);
      caption.setAttribute("data-term", `part:${key === "shape" ? "shield" : key}`);
      choices.append(caption, row);
    }
    stage.append(preview.node, choices);

    const status = el("p", "fd-status");
    status.setAttribute("role", "status");

    const roleRow = group("Which part to colour", "fd-group");
    const roleButtons = ROLES.map(({ key, label }) => {
      const node = button(label, () => setRole(key));
      node.setAttribute("data-term", `role:${key}`);
      const dot = el("span", "cm-role-dot");
      node.append(dot);
      roleRow.append(node);
      return { key, node, dot };
    });
    const swatchRow = group("Colours. Click to colour the chosen part.", "fd-swatches");
    const colourInput = el("input", "fd-colour-input");
    colourInput.setAttribute("type", "color");
    colourInput.setAttribute("tabindex", "-1");
    colourInput.setAttribute("aria-hidden", "true");
    colourInput.addEventListener("change", onColourPicked);

    const actions = el("div", "fd-actions");
    const pngBtn = button("Save PNG", savePng);
    const cancelBtn = button("Cancel", () => settle(null));
    const confirmBtn = button("", () => settle({ ...crest }), "fd-btn fd-btn-primary");
    actions.append(pngBtn, cancelBtn, confirmBtn);

    body.append(heading, stage, status, roleRow, swatchRow, colourInput, actions);
    dialog.className = "fd";
    dialog.append(body);
    bindTermTips(dialog);

    dialog.addEventListener("close", () => settle(null));
    // The padding-free dialog is covered by .fd-body, so a click that lands on the dialog itself hit the backdrop.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) settle(null);
    });

    return { heading, choiceRows, preview, status, roleButtons, swatchRow, colourInput, confirmBtn };
  }

  function readTheme() {
    const style = doc.defaultView.getComputedStyle(dialog);
    white = style.getPropertyValue("--flag-white").trim() || white;
  }

  function say(text) {
    ui.status.textContent = text;
  }

  function choose(key, id) {
    crest = { ...crest, [key]: id };
    redraw();
  }

  function setRole(key) {
    role = key;
    redraw();
  }

  function assignColour(index) {
    crest = { ...crest, [role]: index };
    redraw();
  }

  // The first swatch is white (palette index 0), the others are the map's colours in order.
  function renderSwatches() {
    const nodes = [white, ...palette].map((hex, index) => {
      const node = el("button", "fd-swatch");
      node.setAttribute("type", "button");
      node.style.backgroundColor = hex;
      node.setAttribute("title", index === 0 ? "White" : hex);
      node.setAttribute("aria-label", index === 0 ? "White" : `Colour ${index}, ${hex}`);
      node.addEventListener("click", () => assignColour(index));
      return node;
    });
    const add = el("button", "fd-swatch fd-swatch-add", "+");
    add.setAttribute("type", "button");
    add.setAttribute("aria-label", "Add a colour");
    add.setAttribute("title", "Add a colour");
    add.addEventListener("click", () => ui.colourInput.click());
    ui.swatchRow.replaceChildren(...nodes, add);
    ui.swatches = nodes;
  }

  // The colour joins the map's palette, so the map, the flags and other crests can use it too.
  function onColourPicked() {
    const index = addColour(ui.colourInput.value);
    if (index === null) {
      say("The colour list is full: a map holds up to 254 colours.");
      return;
    }
    palette = [...getPalette()];
    renderSwatches();
    assignColour(index);
  }

  function redraw() {
    for (const { key, buttons } of ui.choiceRows) {
      for (const { id, node } of buttons) node.setAttribute("aria-pressed", String(crest[key] === id));
    }
    for (const { key, node, dot } of ui.roleButtons) {
      node.setAttribute("aria-pressed", String(key === role));
      dot.style.backgroundColor = palette[crest[key] - 1] ?? white;
    }
    ui.swatches.forEach((node, i) => node.setAttribute("aria-pressed", String(crest[role] === i)));
    const { ctx } = ui.preview;
    ctx.clearRect(0, 0, CREST_W * PREVIEW_PX, CREST_H * PREVIEW_PX);
    drawCells(ctx, renderCrest(crest), CREST_W, palette, white, PREVIEW_PX);
  }

  async function savePng() {
    try {
      saveBlob(await cellsToPng({ cells: renderCrest(crest), cols: CREST_W, palette, white, cell: CREST_PNG_CELL, doc }), fileName);
    } catch (error) {
      console.warn("crestmaker: the picture was not saved", error);
      say("The picture could not be saved.");
    }
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
    open({ crest: start, editing, fileName: openFileName }) {
      if (pending) settle(null);
      palette = [...getPalette()];
      if (!ui) ui = build();
      readTheme();
      crest = { ...start };
      role = ROLES[0].key;
      fileName = openFileName;

      ui.heading.textContent = editing ? "Edit crest" : "New crest";
      ui.confirmBtn.textContent = editing ? "Save changes" : "Add to library";
      renderSwatches();
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
