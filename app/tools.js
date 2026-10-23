// Which tools each layer offers and which key picks each tool. Pure data: toolpanel.js draws the
// buttons from it, keys.js reads TOOL_KEYS, state.js repairs the current tool after a layer switch.

export const TOOLS_BY_LAYER = {
  political: ["paint", "erase", "fill", "border", "city", "colony", "flag", "label", "symbol"],
  province: ["paint", "erase", "fill", "symbol"],
  culture: ["paint", "erase", "fill", "symbol"],
};

export const TOOL_KEYS = {
  P: "paint",
  E: "erase",
  F: "fill",
  B: "border",
  C: "city",
  O: "colony",
  G: "flag",
  L: "label",
  S: "symbol",
};

export const TOOL_LABELS = {
  paint: "Paint",
  erase: "Erase",
  fill: "Fill",
  border: "Border",
  city: "City",
  colony: "Colony",
  flag: "Flag",
  label: "Label",
  symbol: "Symbol",
};

export const TOOL_HINTS = {
  paint: "Colour land with the chosen colour",
  erase: "Return land to the bare map",
  fill: "Fill a connected area with the chosen colour",
  border: "Draw a border line on land",
  city: "Click the map to place a named city",
  colony: "Click the map to place a named colony",
  flag: "Click the map to place a named flag",
  label: "Click the map to place free text",
  symbol: "Click the map to place the chosen symbol",
};

/** Tools that colour pixels while the pointer drags. */
export const STROKE_TOOLS = ["paint", "erase", "border"];
/** Stroke tools whose width follows the brush size. */
export const BRUSH_TOOLS = ["paint", "erase"];
/** Tools that put a marker on the map. */
export const PLACING_TOOLS = ["city", "colony", "flag", "label", "symbol"];
/** Placing tools whose marker may go without a name tag; a label is its text. */
export const NAME_TAG_TOOLS = ["city", "colony", "flag", "symbol"];

export const BRUSH_MIN = 1;
export const BRUSH_MAX = 16;

/**
 * The tool to use on a layer: the wanted one if the layer offers it, else the layer's first tool.
 * Null (nothing chosen, markers can be moved) stays null.
 * @param {string} layer
 * @param {string | null} tool
 * @returns {string | null}
 */
export function toolForLayer(layer, tool) {
  const offered = TOOLS_BY_LAYER[layer];
  if (!offered) {
    console.warn("tools: unknown layer", layer);
    return tool;
  }
  if (tool === null) return null;
  return offered.includes(tool) ? tool : offered[0];
}

/**
 * @param {string} tool
 * @returns {string | undefined} The key letter that picks the tool.
 */
export function keyForTool(tool) {
  return Object.keys(TOOL_KEYS).find((key) => TOOL_KEYS[key] === tool);
}
