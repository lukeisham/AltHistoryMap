// The small popover beside a clicked marker: its type and name, and in Edit mode Rename and Delete.

const TYPE_LABELS = { city: "City", flag: "Flag", label: "Label", symbol: "Symbol" };
const NO_NAME = "No name tag";

/**
 * @param {{
 *   box: HTMLElement, name: HTMLElement, kind: HTMLElement, actions: HTMLElement,
 *   renameButton: HTMLButtonElement, capitalButton: HTMLButtonElement, colonyButton: HTMLButtonElement, deleteButton: HTMLButtonElement, closeButton: HTMLButtonElement, stage: HTMLElement
 * }} parts
 * @returns {{show: (options: {marker: object, x: number, y: number, editable: boolean}) => void, hide: () => boolean, isOpen: () => boolean, onRename: (fn: (id: number, x: number, y: number, avoid: {x: number, y: number, width: number, height: number}) => void) => void, onDelete: (fn: (id: number) => void) => void}}
 */
export function createMarkerInfo({ box, name, kind, actions, renameButton, capitalButton, colonyButton, deleteButton, closeButton, stage }) {
  let shown = null;
  let renameFn = () => console.warn("markerinfo: no rename handler");
  let deleteFn = () => console.warn("markerinfo: no delete handler");
  let capitalFn = () => console.warn("markerinfo: no capital handler");
  let colonyFn = () => console.warn("markerinfo: no colony handler");

  closeButton.addEventListener("click", () => {
    shown = null;
    box.hidden = true;
  });
  renameButton.addEventListener("click", () => {
    if (!shown) return;
    const room = stage.getBoundingClientRect();
    const at = box.getBoundingClientRect();
    renameFn(shown.id, shown.x, shown.y, { x: at.left - room.left, y: at.top - room.top, width: at.width, height: at.height });
  });
  capitalButton.addEventListener("click", () => {
    if (shown) capitalFn(shown.id, !shown.capital);
  });
  colonyButton.addEventListener("click", () => {
    if (shown) colonyFn(shown.id, !shown.colony);
  });
  deleteButton.addEventListener("click", () => {
    if (shown) deleteFn(shown.id);
  });

  return {
    show({ marker, x, y, editable }) {
      shown = { id: marker.id, x, y, capital: marker.capital === true, colony: marker.colony === true };
      name.textContent = marker.name || NO_NAME;
      renameButton.textContent = marker.name ? "Rename" : "Add name";
      kind.textContent = marker.capital ? "Capital" : marker.colony ? "Colony" : (TYPE_LABELS[marker.type] ?? marker.type);
      capitalButton.hidden = marker.type !== "city";
      capitalButton.textContent = marker.capital ? "Make city" : "Make capital";
      colonyButton.hidden = marker.type !== "city";
      colonyButton.textContent = marker.colony ? "Make city" : "Make colony";
      actions.hidden = !editable;
      box.hidden = false;
      // The CSS margin keeps the popover off the marker; the clamp must leave room for it.
      const margin = Number.parseFloat(getComputedStyle(box).marginLeft) || 0;
      const room = stage.getBoundingClientRect();
      const size = box.getBoundingClientRect();
      box.style.setProperty("--at-x", String(Math.max(0, Math.min(x, room.width - size.width - 2 * margin))));
      box.style.setProperty("--at-y", String(Math.max(0, Math.min(y, room.height - size.height - 2 * margin))));
    },

    /** @returns {boolean} True when a popover was open. */
    hide() {
      const wasOpen = shown !== null;
      shown = null;
      box.hidden = true;
      return wasOpen;
    },

    /** @returns {boolean} */
    isOpen: () => shown !== null,

    /** @param {(id: number, x: number, y: number, avoid: {x: number, y: number, width: number, height: number}) => void} fn Called with the marker, where the popover is, and the popover's box so the name entry can stay clear of it. */
    onRename(fn) {
      renameFn = fn;
    },

    /** @param {(id: number, capital: boolean) => void} fn Called with the city and whether it should become a capital. */
    onCapital(fn) {
      capitalFn = fn;
    },

    /** @param {(id: number, colony: boolean) => void} fn Called with the city and whether it should become a colony. */
    onColony(fn) {
      colonyFn = fn;
    },

    /** @param {(id: number) => void} fn */
    onDelete(fn) {
      deleteFn = fn;
    },
  };
}
