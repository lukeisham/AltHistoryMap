// The small menu that relations.js opens on a right-click: a heading and one button per choice. It
// closes on a choice, Escape, a press outside it, or when another menu opens, and each close settles
// choose() once. All DOM comes from box.ownerDocument, so a test can hand it a fake document.

/**
 * @param {{box: HTMLElement, stage: HTMLElement}} parts `box` is the hidden menu element in index.html; `stage` is the positioning parent.
 * @returns {{
 *   choose: (request: {x: number, y: number, title: string, options: {id: string, label: string, hint: string, current: boolean}[]}) => Promise<string | null>,
 *   hide: () => boolean
 * }}
 */
export function createRelationMenu({ box, stage }) {
  const doc = box.ownerDocument;
  let pending = null;

  function settle(choice) {
    if (!pending) return;
    const { resolve } = pending;
    pending = null;
    box.hidden = true;
    resolve(choice);
  }

  // Capture phase, so the press that dismisses the menu still reaches the map as the start of a pan.
  doc.addEventListener("pointerdown", (event) => {
    if (pending && !box.contains?.(event.target)) settle(null);
  }, true);
  box.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    settle(null);
  });

  function place(x, y) {
    const room = stage.getBoundingClientRect();
    const size = box.getBoundingClientRect();
    const margin = Number.parseFloat(doc.defaultView.getComputedStyle(box).marginLeft) || 0;
    box.style.setProperty("--at-x", String(Math.max(0, Math.min(x, room.width - size.width - 2 * margin))));
    box.style.setProperty("--at-y", String(Math.max(0, Math.min(y, room.height - size.height - 2 * margin))));
  }

  return {
    choose({ x, y, title, options }) {
      settle(null);
      const heading = doc.createElement("p");
      heading.className = "relation-title";
      heading.textContent = title;
      const buttons = options.map(({ id, label, hint, current }) => {
        const button = doc.createElement("button");
        button.className = "btn relation-option";
        button.setAttribute("type", "button");
        button.setAttribute("title", hint);
        button.setAttribute("aria-pressed", String(current));
        button.textContent = label;
        button.addEventListener("click", () => settle(id));
        return button;
      });
      box.replaceChildren(heading, ...buttons);
      box.hidden = false;
      place(x, y);
      buttons[0]?.focus();
      return new Promise((resolve) => {
        pending = { resolve };
      });
    },

    /** @returns {boolean} True when a menu was open. */
    hide() {
      const wasOpen = pending !== null;
      settle(null);
      return wasOpen;
    },
  };
}
