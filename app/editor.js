// Every change the screen makes to the map goes through here, and every operation starts with
// editGate(). View mode therefore cannot alter the map whatever pointer or key handler calls in.

import { LAND, WATER } from "./model.js";
import { GLYPHS } from "./glyphs.js";
import { PLACING_TOOLS, NAME_TAG_TOOLS } from "./tools.js";

const LAND_ONLY = "Painting, filling and borders work on dry land only, not on the sea, rivers or lakes.";
const DEFAULT_NAMES = { city: "City", flag: "Flag", label: "Label" };

/**
 * @param {{
 *   model: object,
 *   state: {get: () => object, set: (patch: object) => void},
 *   say: (text: string) => void
 * }} deps
 * @returns {object} Edit operations; each returns false (or null) and does nothing outside Edit mode.
 */
export function createEditor({ model, state, say }) {
  let stroking = false;

  // View mode is a normal state for pointer and key handlers, so refusing here is quiet by design.
  function editGate() {
    return state.get().mode === "edit";
  }

  function isLand(x, y) {
    const bits = model.base[y * model.n + x];
    return (bits & LAND) !== 0 && (bits & WATER) === 0;
  }

  function strokeOptions() {
    const { tool, layer, colour, colour2, brush } = state.get();
    return { tool, layer, colour, colour2, size: brush };
  }

  const editor = {
    editGate,

    /**
     * Starts one paint stroke at a pixel.
     * @param {{x: number, y: number}} pixel
     * @returns {boolean} True when a stroke is open.
     */
    beginStroke(pixel) {
      if (!editGate()) return false;
      if (!isLand(pixel.x, pixel.y)) say(LAND_ONLY);
      stroking = model.beginStroke(strokeOptions());
      if (stroking) model.strokeTo(pixel.x, pixel.y);
      return stroking;
    },

    /** @param {{x: number, y: number}} pixel */
    strokeTo(pixel) {
      if (!editGate() || !stroking) return;
      model.strokeTo(pixel.x, pixel.y);
    },

    /** Closes the stroke; the whole drag becomes one undo step. */
    endStroke() {
      if (!stroking) return;
      stroking = false;
      model.endStroke();
    },

    /**
     * Fills the connected area under a pixel with the chosen colour (or claim, on Conflict).
     * @param {{x: number, y: number}} pixel
     * @returns {number} Pixels changed.
     */
    fill(pixel) {
      if (!editGate()) return 0;
      const { layer, colour, colour2 } = state.get();
      if (!isLand(pixel.x, pixel.y)) {
        say(LAND_ONLY);
        return 0;
      }
      return model.fill(layer, pixel.x, pixel.y, colour, colour2);
    },

    /**
     * Places a marker of the current placing tool.
     * @param {{x: number, y: number}} pixel
     * @param {string} name
     * @returns {object | null} The marker, or null.
     */
    place(pixel, name) {
      if (!editGate()) return null;
      const { tool, layer, colour, design, glyph } = state.get();
      if (!PLACING_TOOLS.includes(tool)) {
        console.warn("editor: place called with a tool that places nothing", tool);
        return null;
      }
      const spec = { type: tool, x: pixel.x, y: pixel.y, name, colour };
      if (tool === "flag") spec.design = design;
      if (tool === "symbol") Object.assign(spec, { glyph, layer });
      return model.addMarker(spec);
    },

    /**
     * Whether placing the current tool should ask for a name: always for a label, otherwise only while
     * the Name tag option is on.
     * @returns {boolean}
     */
    asksForName() {
      const { tool, nameTag } = state.get();
      return !NAME_TAG_TOOLS.includes(tool) || nameTag;
    },

    /**
     * The name a new marker starts with: its type, or the symbol's own label.
     * @returns {string}
     */
    defaultName() {
      const { tool, glyph } = state.get();
      if (tool === "symbol") return GLYPHS.find((g) => g.id === glyph)?.label ?? "Symbol";
      return DEFAULT_NAMES[tool] ?? "Marker";
    },

    /** @returns {boolean} */
    moveMarker(id, pixel) {
      return editGate() && model.moveMarker(id, pixel.x, pixel.y);
    },

    /**
     * Moves a marker's name tag, as an offset in screen pixels from where the tag sits by default.
     * @returns {boolean}
     */
    moveTag(id, dx, dy) {
      return editGate() && model.editMarker(id, { tagDx: dx, tagDy: dy });
    },

    /** @returns {boolean} */
    renameMarker(id, name) {
      return editGate() && model.editMarker(id, { name });
    },

    /** @returns {boolean} */
    deleteMarker(id) {
      if (!editGate()) return false;
      const removed = model.deleteMarker(id);
      if (removed && state.get().selected === id) state.set({ selected: null });
      return removed;
    },

    /** Deletes the selected marker, if any. @returns {boolean} */
    deleteSelected() {
      const { selected } = state.get();
      return selected !== null && editor.deleteMarker(selected);
    },

    /** @returns {number | null} The new colour's palette index. */
    addColour(hex) {
      return editGate() ? model.addColour(hex) : null;
    },

    /** @returns {number | null} The new design's index. */
    addDesign(cells) {
      return editGate() ? model.addDesign(cells) : null;
    },

    /** @returns {boolean} */
    updateDesign(index, cells) {
      return editGate() && model.updateDesign(index, cells);
    },

    /** @returns {boolean} */
    undo() {
      return editGate() && model.undo();
    },

    /** @returns {boolean} */
    redo() {
      return editGate() && model.redo();
    },
  };
  return editor;
}
