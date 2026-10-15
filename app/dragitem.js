// What a symbol, shape or flag design carries when it is dragged from the tool panel onto the map.
// symbols.js and flagstrip.js start the drag; stage.js reads the drop. The map file accepts any
// glyph id and design index it is given, so the reader here checks them before anything is placed.

export const ITEM_TYPE = "application/x-althistorymap-item";

/**
 * Starts a drag that carries a panel item.
 * @param {DragEvent} event
 * @param {{kind: "symbol", glyph: string} | {kind: "flag", design: number}} item
 */
export function setDragItem(event, item) {
  event.dataTransfer.setData(ITEM_TYPE, JSON.stringify(item));
  event.dataTransfer.effectAllowed = "copy";
}

/**
 * @param {DragEvent} event
 * @returns {boolean} True when the drag carries a panel item (its contents are not readable until the drop).
 */
export function hasDragItem(event) {
  return Boolean(event.dataTransfer?.types.includes(ITEM_TYPE));
}

/**
 * Reads and checks a dropped panel item.
 * @param {DragEvent} event
 * @param {{glyphIds: string[], designCount: number}} known What the map can place.
 * @returns {{kind: "symbol", glyph: string} | {kind: "flag", design: number} | null} Null when nothing valid was dropped.
 */
export function readDragItem(event, { glyphIds, designCount }) {
  const text = event.dataTransfer?.getData(ITEM_TYPE);
  if (!text) return null;
  let item;
  try {
    item = JSON.parse(text);
  } catch (error) {
    console.warn("dragitem: the dropped item was not readable", error);
    return null;
  }
  if (item?.kind === "symbol" && glyphIds.includes(item.glyph)) return { kind: "symbol", glyph: item.glyph };
  if (item?.kind === "flag" && Number.isInteger(item.design) && item.design >= -1 && item.design < designCount) {
    return { kind: "flag", design: item.design };
  }
  console.warn("dragitem: the dropped item is not one the map can place", item);
  return null;
}
