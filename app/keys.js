// Keyboard shortcuts for the whole page. Layer keys work in both modes; everything that changes
// the map goes through the editor, which refuses outside Edit mode.

import { LAYERS } from "./model.js";
import { TOOL_KEYS, TOOLS_BY_LAYER } from "./tools.js";

const TEXT_INPUT_TYPES = ["text", "search", "email", "url", "tel", "password", "number"];
const PAN_TARGETS = ["BODY", "CANVAS"];

/**
 * True when the key press belongs to a text field or an open dialog, where typing must not
 * trigger shortcuts.
 * @param {{tagName?: string, type?: string, isContentEditable?: boolean, closest?: (selector: string) => unknown} | null} target
 * @returns {boolean}
 */
export function isTypingTarget(target) {
  if (!target?.tagName) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  if (target.tagName === "INPUT" && TEXT_INPUT_TYPES.includes(target.type ?? "text")) return true;
  return Boolean(target.closest?.("dialog"));
}

// Shift turns a digit key into a symbol, so the key position identifies it then.
// Key position (`code`) wins so the top-row keys work on layouts whose unshifted digit row types symbols.
function layerKeyIndex(event) {
  const position = /^Digit([1-3])$/.exec(event.code ?? "");
  if (position) return Number(position[1]) - 1;
  if (event.shiftKey) return -1;
  return /^[1-3]$/.test(event.key) ? Number(event.key) - 1 : -1;
}

/**
 * @param {{
 *   state: {get: () => object, set: (patch: object) => void},
 *   editor: {undo: () => boolean, redo: () => boolean, deleteSelected: () => boolean},
 *   dismiss: () => boolean,
 *   say: (text: string) => void
 * }} deps `dismiss` closes the marker popover and clears the selection; it returns true when it did.
 *   `say` shows the note when a layer toggle switches another layer off.
 * @returns {{onKeyDown: (event: KeyboardEvent) => void, onKeyUp: (event: KeyboardEvent) => void, onBlur: () => void, isPanHeld: () => boolean}}
 */
export function createKeys({ state, editor, dismiss, say }) {
  let panHeld = false;

  function modified(event) {
    const key = event.key.toLowerCase();
    if (key === "z") return event.shiftKey ? editor.redo() : editor.undo();
    if (key === "y") return editor.redo();
    return false;
  }

  function escape() {
    if (dismiss()) return true;
    const { mode, tool } = state.get();
    if (mode !== "edit" || tool === null) return false;
    state.set({ tool: null });
    return true;
  }

  function plain(event) {
    const { key } = event;
    const layer = LAYERS[layerKeyIndex(event)];
    if (layer) {
      if (!event.shiftKey) {
        say("");
        state.set({ layer });
      }
      else if (state.get().mode === "view") say(state.toggleView(layer));
      else return false;
      return true;
    }
    if (key === "Delete" || key === "Backspace") return editor.deleteSelected();
    if (key === "Escape") return escape();
    const tool = TOOL_KEYS[key.toUpperCase()];
    const { mode, layer: current } = state.get();
    if (key.length === 1 && tool && mode === "edit" && TOOLS_BY_LAYER[current].includes(tool)) {
      state.set({ tool });
      return true;
    }
    return false;
  }

  return {
    onKeyDown(event) {
      if (isTypingTarget(event.target)) return;
      if (event.key === " " && !event.ctrlKey && !event.metaKey && PAN_TARGETS.includes(event.target?.tagName)) {
        panHeld = true;
        event.preventDefault();
        return;
      }
      if (event.altKey) return;
      const handled = event.ctrlKey || event.metaKey ? modified(event) : plain(event);
      if (handled) event.preventDefault();
    },

    onKeyUp(event) {
      if (event.key === " ") panHeld = false;
    },

    onBlur() {
      panHeld = false;
    },

    /** @returns {boolean} True while Space is held, which turns a drag into a pan. */
    isPanHeld: () => panHeld,
  };
}
