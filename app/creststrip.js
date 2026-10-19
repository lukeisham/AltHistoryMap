// The Crests list in the tool panel: one thumbnail per saved crest. Clicking one picks it for the
// Edit button; double-clicking it, or the Edit button, opens the crest maker.

import { CREST_W, CREST_H, renderCrest } from "./crestcells.js";
import { drawCells } from "./pngexport.js";

/** CSS pixels per crest cell in a thumbnail. */
const THUMB_CELL = 1.5;

/**
 * @param {{
 *   container: HTMLElement,
 *   newButton: HTMLButtonElement,
 *   editButton: HTMLButtonElement,
 *   state: {get: () => object, set: (patch: object) => void, subscribe: Function},
 *   model: {palette: string[], crests: object[], onChange: Function},
 *   crests: {create: () => void, edit: (index: number) => void}
 * }} deps
 */
export function bindCrestStrip({ container, newButton, editButton, state, model, crests }) {
  const doc = container.ownerDocument;
  let buttons = [];
  let drawn = [];

  function thumb(crest, index) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "crest-thumb";
    button.dataset.crest = String(index);
    button.setAttribute("aria-label", `Crest ${index + 1}`);
    button.title = `Crest ${index + 1}. Double-click to edit.`;
    const canvas = doc.createElement("canvas");
    canvas.className = "crest-thumb-canvas";
    const scale = doc.defaultView?.devicePixelRatio || 1;
    canvas.width = Math.round(CREST_W * THUMB_CELL * scale);
    canvas.height = Math.round(CREST_H * THUMB_CELL * scale);
    canvas.style.width = `${CREST_W * THUMB_CELL}px`;
    canvas.style.height = `${CREST_H * THUMB_CELL}px`;
    canvas.setAttribute("aria-hidden", "true");
    const white = doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue("--flag-white").trim();
    drawCells(canvas.getContext("2d"), renderCrest(crest), CREST_W, model.palette, white, canvas.width / CREST_W);
    button.append(canvas);
    button.addEventListener("click", () => state.set({ crest: index }));
    button.addEventListener("dblclick", () => crests.edit(index));
    return button;
  }

  function render() {
    buttons = model.crests.map(thumb);
    drawn = [...model.crests];
    container.replaceChildren(...buttons);
    mark();
  }

  function mark() {
    const { crest } = state.get();
    for (const button of buttons) button.setAttribute("aria-pressed", String(Number(button.dataset.crest) === crest));
    editButton.disabled = crest < 0;
  }

  // Crests are replaced, never changed in place, so a reference check is enough.
  function stale() {
    return drawn.length !== model.crests.length || drawn.some((crest, i) => crest !== model.crests[i]);
  }

  newButton.addEventListener("click", () => crests.create());
  editButton.addEventListener("click", () => {
    const { crest } = state.get();
    if (crest >= 0) crests.edit(crest);
  });
  state.subscribe((value, changed) => {
    if (changed.includes("crest")) mark();
  });
  model.onChange((notice) => {
    if (notice.all || notice.palette || (notice.markers && stale())) render();
  });
  render();
}
