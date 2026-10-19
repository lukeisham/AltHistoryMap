// The screen's own small store: mode, layer, tool, colours, brush, symbol, flag design, crest, selection, city colour.
// Map data never lives here; that is model.js.

import { layersOnScreen, lookFor, settleLayers, soloView, toggleLayer } from "./layers.js";
import { toolForLayer } from "./tools.js";

/**
 * A store with change notices. Every listener gets the new value and the names of the keys that changed.
 * @param {object} initial
 * @returns {{get: () => object, set: (patch: object) => void, subscribe: (fn: (value: object, changed: string[]) => void) => () => void}}
 */
export function createStore(initial) {
  let value = { ...initial };
  const listeners = new Set();
  return {
    get: () => value,
    set(patch) {
      const changed = Object.keys(patch).filter((key) => value[key] !== patch[key]);
      if (changed.length === 0) return;
      value = { ...value, ...patch };
      for (const fn of listeners) fn(value, changed);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const sameView = (a, b) => a.length === b.length && a.every((layer, i) => layer === b[i]);
const onScreen = ({ mode, layer, view }) => layersOnScreen(lookFor({ mode, layer, view }));

/**
 * The screen store. `layer` is the layer being edited; `view` is what View mode shows (layers.js
 * holds the rules). Setting `layer` in View mode shows that layer alone. A change keeps the tool
 * valid for the layer and clears the selection when a layer leaves the screen, since its marker may have gone with it.
 * @param {{mode: string, layer: string, view?: string[], glyph: string}} initial
 * @returns {ReturnType<typeof createStore> & {toggleView: (layer: string) => string}} `toggleView`
 *   shows or hides one layer in View mode and returns the note to say, or "".
 */
export function createAppState(initial) {
  const wanted = initial.view?.includes(initial.layer) ? initial.view : soloView(initial.layer);
  const start = settleLayers(initial.mode, initial.layer, wanted);
  const store = createStore({
    tool: toolForLayer(start.layer, initial.tool ?? "paint"),
    colour: 1,
    colour2: 2,
    brush: 1,
    design: -1,
    crest: -1,
    nameTag: true,
    capital: false,
    cityColour: "neutral",
    selected: null,
    ...initial,
    ...start,
  });
  const set = (patch) => {
    const now = store.get();
    const mode = patch.mode ?? now.mode;
    let view = patch.view ?? now.view;
    if (mode === "view" && ("layer" in patch ? !("view" in patch) : now.mode !== "view" && !view.includes(now.layer))) {
      view = soloView(patch.layer ?? now.layer);
    }
    const settled = settleLayers(mode, patch.layer ?? now.layer, view);
    if (sameView(settled.view, now.view)) settled.view = now.view;
    const tool = "tool" in patch ? patch.tool : now.tool;
    const next = { ...patch, ...settled, tool: toolForLayer(settled.layer, tool) };
    const after = onScreen({ mode, ...settled });
    if (!onScreen(now).every((name) => after.includes(name))) next.selected = null;
    store.set(next);
  };
  const toggleView = (layer) => {
    const { mode, view } = store.get();
    if (mode !== "view") return "";
    const result = toggleLayer(view, layer, !view.includes(layer));
    set({ view: result.view });
    return result.note;
  };
  return { ...store, set, toggleView };
}

/**
 * Pulls the chosen colours and flag design back inside what the map holds, after an undo or after
 * a whole map is swapped in.
 * @param {ReturnType<typeof createStore>} state
 * @param {{palette: string[], designs: unknown[], crests: unknown[]}} model
 */
export function keepSelectionsValid(state, model) {
  const { colour, colour2, design, crest } = state.get();
  const count = model.palette.length;
  const patch = {};
  if (colour > count) patch.colour = 1;
  if (colour2 > count) patch.colour2 = Math.min(2, count) || 1;
  if (design >= model.designs.length) patch.design = -1;
  if (crest >= model.crests.length) patch.crest = -1;
  state.set(patch);
}
