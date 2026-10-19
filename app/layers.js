// Which layers can be on screen together, and the look each choice draws. Pure rules: state.js
// applies them, layerbar.js and keys.js ask them, render.js draws the look, recovery.js validates
// saved views against them.

import { LAYERS } from "./model.js";

/** The only combinations View mode offers. Each layer stands alone: Culture's Edit look draws a faded Political under it. */
export const ALLOWED_VIEWS = [["political"], ["province"], ["culture"]];

/** Every look the renderer draws: the three views, and Culture over faded Political in Edit mode. */
export const LOOKS = [...ALLOWED_VIEWS.map((view) => view.join("+")), "editCulture"];

const NAMES = { political: "Political", province: "Province", culture: "Culture" };

/**
 * @param {string[]} view
 * @returns {boolean} True when the view is one of ALLOWED_VIEWS.
 */
export function isAllowedView(view) {
  return Array.isArray(view) && ALLOWED_VIEWS.some((allowed) => allowed.length === view.length && allowed.every((layer, i) => layer === view[i]));
}

/**
 * @param {string} layer
 * @returns {string[]} The view that shows only this layer.
 */
export function soloView(layer) {
  return [layer];
}

/**
 * Turns one layer on or off. Showing a layer replaces the view, since no layers share one.
 * @param {string[]} view The current allowed view.
 * @param {string} layer
 * @param {boolean} shown
 * @returns {{view: string[], note: string}} The new view, and a sentence for the message line when
 *   another layer was switched off ("" when nothing was).
 */
export function toggleLayer(view, layer, shown) {
  if (!LAYERS.includes(layer)) {
    console.warn("layers: unknown layer", layer);
    return { view, note: "" };
  }
  const on = view.includes(layer);
  if (shown === on) return { view, note: "" };
  if (!shown) return { view, note: "" };
  const hidden = view.map((name) => NAMES[name]).join(", ");
  return { view: soloView(layer), note: `${hidden} hidden: ${NAMES[layer]} never shares a view.` };
}

/**
 * Makes the layer being edited, the view and the mode agree. A view that is not allowed becomes the
 * edited layer alone; in View mode the edited layer must be on screen.
 * @param {"view" | "edit"} mode
 * @param {string} layer
 * @param {string[]} view
 * @returns {{layer: string, view: string[]}}
 */
export function settleLayers(mode, layer, view) {
  const settled = isAllowedView(view) ? view : soloView(layer);
  if (mode === "view" && !settled.includes(layer)) return { layer: settled[0], view: settled };
  return { layer, view: settled };
}

/**
 * The look the renderer draws: the edited layer in Edit mode (Culture over faded Political), the
 * viewed layer in View mode.
 * @param {{mode: string, layer: string, view: string[]}} screen
 * @returns {string} `political`, `province`, `culture` or `editCulture`.
 */
export function lookFor({ mode, layer, view }) {
  if (mode === "edit") return layer === "culture" ? "editCulture" : layer;
  return view.join("+");
}

/**
 * @param {string} look
 * @returns {string[]} The layers whose marks and planes the look shows: Province shows Political's
 *   cities, flags and labels as well as its own symbols.
 */
export function layersOnScreen(look) {
  if (look === "editCulture") return ["culture"];
  return look === "province" ? ["political", "province"] : [look];
}

/**
 * @param {string} look
 * @returns {string[]} The layers whose edits change a pixel of the look: a political edit repaints
 *   editCulture and province because Political shows through them.
 */
export function layersDrawn(look) {
  if (look === "editCulture") return ["political", "culture"];
  return look === "province" ? ["political", "province"] : [look];
}
