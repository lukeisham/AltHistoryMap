// The small popover beside a clicked marker: its type and name, and in Edit mode Rename and Delete.

const TYPE_LABELS = { city: "City", flag: "Flag", label: "Label", symbol: "Symbol" };
const NO_NAME = "No name tag";

/**
 * @param {{
 *   box: HTMLElement, name: HTMLElement, kind: HTMLElement, actions: HTMLElement,
 *   renameButton: HTMLButtonElement, deleteButton: HTMLButtonElement, stage: HTMLElement
 * }} parts
 * @returns {{show: (options: {marker: object, x: number, y: number, editable: boolean}) => void, hide: () => boolean, isOpen: () => boolean, onRename: (fn: (id: number, x: number, y: number) => void) => void, onDelete: (fn: (id: number) => void) => void}}
 */
export function createMarkerInfo({ box, name, kind, actions, renameButton, deleteButton, stage }) {
  let shown = null;
  let renameFn = () => console.warn("markerinfo: no rename handler");
  let deleteFn = () => console.warn("markerinfo: no delete handler");

  renameButton.addEventListener("click", () => {
    if (shown) renameFn(shown.id, shown.x, shown.y);
  });
  deleteButton.addEventListener("click", () => {
    if (shown) deleteFn(shown.id);
  });

  return {
    show({ marker, x, y, editable }) {
      shown = { id: marker.id, x, y };
      name.textContent = marker.name || NO_NAME;
      renameButton.textContent = marker.name ? "Rename" : "Add name";
      kind.textContent = TYPE_LABELS[marker.type] ?? marker.type;
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

    /** @param {(id: number, x: number, y: number) => void} fn Called with the marker and where the popover is. */
    onRename(fn) {
      renameFn = fn;
    },

    /** @param {(id: number) => void} fn */
    onDelete(fn) {
      deleteFn = fn;
    },
  };
}
