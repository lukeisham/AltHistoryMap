// The layer bar: an eye and a name for each layer, and Undo and Redo while editing. In View mode the
// eyes show or hide layers and a name shows that layer alone; in Edit mode a name picks the layer
// being edited. state.js applies the rules in layers.js.

import { LAYERS } from "./model.js";

const LABELS = { political: "Political", conflict: "Conflict", culture: "Culture" };

/**
 * @param {{
 *   root: HTMLElement,
 *   state: {get: () => object, set: (patch: object) => void, subscribe: Function, toggleView: (layer: string) => string},
 *   model: {canUndo: () => boolean, canRedo: () => boolean, onChange: Function},
 *   editor: {undo: () => boolean, redo: () => boolean},
 *   say: (text: string) => void
 * }} deps
 */
export function bindLayerBar({ root, state, model, editor, say }) {
  const part = (layer, selector) => root.querySelector(`[data-chip="${layer}"] ${selector}`);
  const chips = LAYERS.map((layer) => root.querySelector(`[data-chip="${layer}"]`));
  const names = LAYERS.map((layer) => part(layer, "[data-layer]"));
  const eyes = LAYERS.map((layer) => part(layer, "[data-eye]"));
  const undoButton = root.querySelector('[data-action="undo"]');
  const redoButton = root.querySelector('[data-action="redo"]');

  LAYERS.forEach((layer, i) => {
    names[i].addEventListener("click", () => {
      say("");
      state.set({ layer });
    });
    eyes[i].addEventListener("click", () => say(state.toggleView(layer)));
  });
  undoButton.addEventListener("click", () => editor.undo());
  redoButton.addEventListener("click", () => editor.redo());

  function syncLayers() {
    const { mode, layer, view } = state.get();
    const editing = mode === "edit";
    LAYERS.forEach((name, i) => {
      const shown = view.includes(name);
      chips[i].dataset.on = String(editing ? name === layer : shown);
      chips[i].dataset.edit = String(editing && name === layer);
      eyes[i].setAttribute("aria-pressed", String(shown));
      const last = shown && view.length === 1;
      eyes[i].setAttribute("aria-disabled", String(last));
      eyes[i].title = last ? "At least one layer stays on" : `${shown ? "Hide" : "Show"} ${LABELS[name]} (Shift+${i + 1})`;
      if (editing) {
        names[i].setAttribute("aria-pressed", String(name === layer));
        names[i].title = `Edit ${LABELS[name]} (${i + 1})`;
      } else {
        names[i].removeAttribute("aria-pressed");
        names[i].title = `Show ${LABELS[name]} alone (${i + 1})`;
      }
    });
  }
  function syncHistory() {
    undoButton.disabled = !model.canUndo();
    redoButton.disabled = !model.canRedo();
  }

  state.subscribe((value, changed) => {
    if (changed.includes("mode") || changed.includes("layer") || changed.includes("view")) syncLayers();
  });
  model.onChange(syncHistory);
  syncLayers();
  syncHistory();
}
