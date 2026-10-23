// The colour swatches. A click sets the colour, Shift-click the second colour (the second colour of a flag). The + button adds a colour from the system picker; the eye-dropper button beside it picks one from the screen.
// A swatch is also a country: double-click opens its Key Facts, and a crest or flag design dropped on it is given to the country.

import { MAX_PALETTE } from "./model.js";
import { hasDragItem, readDragItem } from "./dragitem.js";
import { countryName } from "./countrydata.js";
import { createEyeDropperButton } from "./eyedropper.js";

/**
 * @param {{
 *   container: HTMLElement,
 *   colourInput: HTMLInputElement,
 *   state: {get: () => object, set: (patch: object) => void, subscribe: Function},
 *   model: {palette: string[], designs: unknown[], crests: unknown[], onChange: Function},
 *   glyphIds: string[],
 *   editor: {addColour: (hex: string) => number | null, editGate: () => boolean},
 *   shownColourIndex: (hex: string) => number | null,
 *   countries: {open: (colour: number) => void, dropOnColour: (colour: number, item: object) => void},
 *   say: (text: string) => void
 * }} deps
 * @returns {{render: () => void}}
 */
export function bindPalette({ container, colourInput, state, model, editor, countries, glyphIds, shownColourIndex, say }) {
  const doc = container.ownerDocument;
  let swatches = [];

  // The hover text is the country's name; a colour nobody has named shows the colour's own name.
  function nameOf(hex, index) {
    return countryName(model.countries.find((country) => country.colour === index), hex, index);
  }

  function swatch(hex, index) {
    const node = doc.createElement("button");
    node.type = "button";
    node.className = "swatch";
    node.style.backgroundColor = hex;
    node.title = nameOf(hex, index);
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
    const dropper = createEyeDropperButton({ doc, className: "swatch swatch-add swatch-eyedropper", onPick: takeColour, openPicker: () => colourInput.click() });
    container.replaceChildren(...swatches, add, dropper);
    mark();
  }

  // An eye dropper reads what the map shows, so a colour taken from a country's land is that country's colour and not a new one.
  function takeColour(hex) {
    const index = shownColourIndex(hex) ?? editor.addColour(hex);
    if (index === null) say(`The colour list is full: a map holds up to ${MAX_PALETTE} colours.`);
    else state.set({ colour: index });
  }

  colourInput.addEventListener("change", () => takeColour(colourInput.value));

  state.subscribe((value, changed) => {
    if (changed.includes("colour") || changed.includes("colour2")) mark();
  });
  model.onChange((notice) => {
    if (notice.all || notice.palette) render();
    else if (notice.countries) swatches.forEach((node, i) => (node.title = nameOf(model.palette[i], i + 1)));
  });
  render();
  return { render };
}
