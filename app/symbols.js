// The symbol grid: each preset glyph drawn as a small SVG in the text colour. A button can also be
// dragged onto the map to place that symbol where it is dropped.

import { setDragItem } from "./dragitem.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * @param {{
 *   container: HTMLElement,
 *   glyphs: {id: string, label: string, path: string, solid?: boolean}[],
 *   state: {get: () => object, set: (patch: object) => void, subscribe: Function}
 * }} deps Choosing a glyph also chooses the Symbol tool.
 */
export function bindSymbols({ container, glyphs, state }) {
  const doc = container.ownerDocument;

  function icon({ path, solid }) {
    const svg = doc.createElementNS(SVG_NS, "svg");
    // The Lucide set is drawn on a 24-unit box with a 2-unit round stroke; render.js draws it the same way.
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", solid ? "currentColor" : "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", "symbol-icon");
    svg.setAttribute("aria-hidden", "true");
    const shape = doc.createElementNS(SVG_NS, "path");
    shape.setAttribute("d", path);
    svg.append(shape);
    return svg;
  }

  const buttons = glyphs.map((glyph) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "symbol-button";
    button.dataset.glyph = glyph.id;
    button.title = glyph.label;
    button.setAttribute("aria-label", glyph.label);
    button.draggable = true;
    button.append(icon(glyph));
    button.addEventListener("click", () => state.set({ glyph: glyph.id, tool: "symbol" }));
    button.addEventListener("dragstart", (event) => setDragItem(event, { kind: "symbol", glyph: glyph.id }));
    return button;
  });
  container.replaceChildren(...buttons);

  function mark() {
    const { glyph } = state.get();
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.glyph === glyph));
  }
  state.subscribe((value, changed) => {
    if (changed.includes("glyph")) mark();
  });
  mark();
}
