// Which layers can be on screen together, and the look each choice draws. Pure rules: state.js
// applies them, layerbar.js and keys.js ask them, render.js draws the look, recovery.js validates
// saved views against them.

import { LAYERS } from "./model.js";

/** The only combinations View mode offers, each in LAYERS order. Political and Culture never meet. */
export const ALLOWED_VIEWS = [["political"], ["conflict"], ["political", "conflict"], ["culture"], ["conflict", "culture"]];

/** Every look the renderer draws: the five views, and Culture over faded Political in Edit mode. */
export const LOOKS = [...ALLOWED_VIEWS.map((view) => view.join("+")), "editCulture"];

const ORDER = (layers) => LAYERS.filter((layer) => layers.includes(layer));

/**
 * @param {string[]} view
 * @returns {boolean} True when the view is one of ALLOWED_VIEWS, in LAYERS order.
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
 * Turns one layer on or off, switching another off when the rules need it.
 * @param {string[]} view The current allowed view.
 * @param {string} layer
 * @param {boolean} shown
 * @returns {{view: string[], note: string}} The new view, and a sentence for the message line when a
 *   second layer was switched off ("" when nothing was).
 */
export function toggleLayer(view, layer, shown) {
  if (!LAYERS.includes(layer)) {
    console.warn("layers: unknown layer", layer);
    return { view, note: "" };
  }
  const on = view.includes(layer);
  if (shown === on) return { view, note: "" };
  if (!shown) return view.length === 1 ? { view, note: "" } : { view: view.filter((l) => l !== layer), note: "" };
  if (layer === "culture") {
    const note = view.includes("political") ? "Political hidden: Culture never shares a view with it." : "";
    return { view: ORDER(["culture", ...view.filter((l) => l === "conflict")]), note };
  }
  if (layer === "political") {
    const note = view.includes("culture") ? "Culture hidden: it never shares a view with Political." : "";
    return { view: ORDER(["political", ...view.filter((l) => l === "conflict")]), note };
  }
  return { view: ORDER([...view, layer]), note: "" };
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
 * The look the renderer draws: the layer alone in Edit mode (Culture over faded Political), the
 * joined layers in View mode.
 * @param {{mode: string, layer: string, view: string[]}} screen
 * @returns {string} `political`, `conflict`, `political+conflict`, `culture`, `conflict+culture` or `editCulture`.
 */
export function lookFor({ mode, layer, view }) {
  if (mode === "edit") return layer === "culture" ? "editCulture" : layer;
  return view.join("+");
}

/**
 * @param {string} look
 * @returns {string[]} The layers whose marks and planes the look shows.
 */
export function layersOnScreen(look) {
  return look === "editCulture" ? ["culture"] : look.split("+");
}

/**
 * @param {string} look
 * @returns {string[]} The layers whose edits change a pixel of the look: a political edit repaints
 *   editCulture because Political shows through it.
 */
export function layersDrawn(look) {
  return look === "editCulture" ? ["political", "culture"] : look.split("+");
}
