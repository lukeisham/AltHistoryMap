// The colour swatches. A click sets the colour, Shift-click the second colour (the second colour of a flag). The + button adds a colour from the system picker.
// A swatch is also a country: double-click opens its Key Facts, and a crest or flag design dropped on it is given to the country.

import { MAX_PALETTE } from "./model.js";
import { hasDragItem, readDragItem } from "./dragitem.js";

/**
 * @param {{
 *   container: HTMLElement,
 *   colourInput: HTMLInputElement,
 *   state: {get: () => object, set: (patch: object) => void, subscribe: Function},
 *   model: {palette: string[], designs: unknown[], crests: unknown[], onChange: Function},
 *   glyphIds: string[],
 *   editor: {addColour: (hex: string) => number | null, editGate: () => boolean},
 *   countries: {open: (colour: number) => void, dropOnColour: (colour: number, item: object) => void},
 *   say: (text: string) => void
 * }} deps
 * @returns {{render: () => void}}
 */
export function bindPalette({ container, colourInput, state, model, editor, countries, glyphIds, say }) {
  const doc = container.ownerDocument;
  let swatches = [];

  function swatch(hex, index) {
    const node = doc.createElement("button");
    node.type = "button";
    node.className = "swatch";
    node.style.backgroundColor = hex;
    node.title = hex;
    node.addEventListener("click", (event) => {
      if (event.shiftKey) state.set({ colour2: index });
      else state.set({ colour: index });
    });
    node.addEventListener("dblclick", () => countries.open(index));
    node.addEventListener("dragover", (event) => {
      if (hasDragItem(event) && editor.editGate()) event.preventDefault();
    });
    node.addEventListener("drop", (event) => {
      if (!hasDragItem(event)) return;
      event.preventDefault();
      const item = readDragItem(event, { glyphIds, designCount: model.designs.length, crestCount: model.crests.length });
      if (item && (item.kind === "crest" || item.kind === "flag")) countries.dropOnColour(index, item);
    });
    return node;
  }

  function mark() {
    const { colour, colour2 } = state.get();
    swatches.forEach((node, i) => {
      const index = i + 1;
      const marks = [index === colour ? "1" : "", index === colour2 ? "2" : ""].filter(Boolean).join(" ");
      const roles = [index === colour ? "colour" : "", index === colour2 ? "second colour" : ""].filter(Boolean).join(", ");
      node.setAttribute("aria-pressed", String(index === colour));
      node.dataset.mark = marks;
      node.setAttribute("aria-label", `Colour ${index}, ${model.palette[i]}${roles ? `, ${roles}` : ""}`);
    });
  }

  function render() {
    swatches = model.palette.map((hex, i) => swatch(hex, i + 1));
    const add = doc.createElement("button");
    add.type = "button";
    add.className = "swatch swatch-add";
    add.textContent = "+";
    add.setAttribute("aria-label", "Add a colour");
    add.title = "Add a colour";
    add.addEventListener("click", () => colourInput.click());
    container.replaceChildren(...swatches, add);
    mark();
  }

  colourInput.addEventListener("change", () => {
    const index = editor.addColour(colourInput.value);
    if (index === null) say(`The colour list is full: a map holds up to ${MAX_PALETTE} colours.`);
    else state.set({ colour: index });
  });

  state.subscribe((value, changed) => {
    if (changed.includes("colour") || changed.includes("colour2")) mark();
  });
  model.onChange((notice) => {
    if (notice.all || notice.palette) render();
  });
  render();
  return { render };
}
