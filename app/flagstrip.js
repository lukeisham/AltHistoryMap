// The Flags list under the palette: a plain flag in the chosen colour, then one thumbnail per design.
// Clicking one picks it and the Flag tool; double-clicking a thumbnail, or the Edit button, opens the designer.
// Dragging one onto the map places a flag with that design where it is dropped.

import { FLAG_W, FLAG_H } from "./model.js";
import { setDragItem } from "./dragitem.js";

/** CSS pixels per design cell in a thumbnail: 24 cells wide makes it 36 px, the size a placed flag is drawn at. */
const THUMB_CELL = 1.5;

/**
 * Paints a design (or, with cells null, a solid plain flag) onto a canvas.
 * @param {HTMLCanvasElement} canvas Sized by the caller to FLAG_W x FLAG_H cells.
 * @param {Uint8Array | null} cells
 * @param {string[]} palette
 * @param {string} white The colour of palette index 0.
 * @param {string} plain The colour of a plain flag.
 */
export function drawThumb(canvas, cells, palette, white, plain) {
  const ctx = canvas.getContext("2d");
  const cell = canvas.width / FLAG_W;
  if (!cells) {
    ctx.fillStyle = plain;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  for (let y = 0; y < FLAG_H; y++) {
    for (let x = 0; x < FLAG_W; x++) {
      const index = cells[y * FLAG_W + x];
      ctx.fillStyle = index === 0 ? white : palette[index - 1];
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}

/**
 * @param {{
 *   container: HTMLElement,
 *   newButton: HTMLButtonElement,
 *   editButton: HTMLButtonElement,
 *   state: {get: () => object, set: (patch: object) => void, subscribe: Function},
 *   model: {palette: string[], designs: Uint8Array[], onChange: Function},
 *   designs: {create: () => void, edit: (index: number) => void}
 * }} deps
 */
export function bindFlagStrip({ container, newButton, editButton, state, model, designs }) {
  const doc = container.ownerDocument;
  let buttons = [];
  let drawn = [];
  let drawnColour = null;

  function thumb(label, index) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "flag-thumb";
    button.dataset.design = String(index);
    button.setAttribute("aria-label", label);
    button.title = index < 0 ? label : `${label}. Double-click to edit.`;
    const canvas = doc.createElement("canvas");
    canvas.className = "flag-thumb-canvas";
    const scale = doc.defaultView?.devicePixelRatio || 1;
    canvas.width = Math.round(FLAG_W * THUMB_CELL * scale);
    canvas.height = Math.round(FLAG_H * THUMB_CELL * scale);
    canvas.setAttribute("aria-hidden", "true");
    button.append(canvas);
    button.draggable = true;
    button.addEventListener("click", () => state.set({ design: index, tool: "flag" }));
    button.addEventListener("dragstart", (event) => setDragItem(event, { kind: "flag", design: index }));
    if (index >= 0) button.addEventListener("dblclick", () => designs.edit(index));
    return button;
  }

  function render() {
    const white = doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue("--flag-white").trim();
    const plainColour = model.palette[state.get().colour - 1] ?? white;
    buttons = [thumb("Plain flag in the chosen colour", -1)];
    model.designs.forEach((_, i) => buttons.push(thumb(`Flag design ${i + 1}`, i)));
    buttons.forEach((button, i) => {
      const cells = i === 0 ? null : model.designs[i - 1];
      drawThumb(button.firstChild, cells, model.palette, white, plainColour);
    });
    drawn = [...model.designs];
    drawnColour = plainColour;
    container.replaceChildren(...buttons);
    mark();
  }

  function mark() {
    const { design } = state.get();
    for (const button of buttons) button.setAttribute("aria-pressed", String(Number(button.dataset.design) === design));
    editButton.disabled = design < 0;
  }

  // Cheap to check on every marker notice: designs are replaced, never changed in place.
  function stale() {
    return drawn.length !== model.designs.length || drawn.some((cells, i) => cells !== model.designs[i]);
  }

  newButton.addEventListener("click", () => designs.create());
  editButton.addEventListener("click", () => {
    const { design } = state.get();
    if (design >= 0) designs.edit(design);
  });
  state.subscribe((value, changed) => {
    if (changed.includes("colour") && model.palette[value.colour - 1] !== drawnColour) render();
    else if (changed.includes("design")) mark();
  });
  model.onChange((notice) => {
    if (notice.all || (notice.markers && stale())) render();
  });
  render();
}
