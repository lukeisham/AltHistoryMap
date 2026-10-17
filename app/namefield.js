// The small name entry that opens at a click, for placing and renaming markers. A page prompt would
// block the page and cannot be styled or tested.

/**
 * @param {{form: HTMLFormElement, input: HTMLInputElement, submit: HTMLButtonElement, cancelButton: HTMLButtonElement, stage: HTMLElement}} parts
 * @returns {{ask: (options: {x: number, y: number, value: string, confirmLabel: string, allowEmpty?: boolean, avoid?: {x: number, y: number, width: number, height: number}}) => Promise<string | null>, cancel: () => void, isOpen: () => boolean}}
 */
export function createNameField({ form, input, submit, cancelButton, stage }) {
  let pending = null;
  let allowEmpty = false;

  function settle(result) {
    if (!pending) return;
    const { resolve } = pending;
    pending = null;
    form.hidden = true;
    resolve(result);
  }

  // With a box to avoid, the entry sits just below it, or just above when there is no room below.
  function position(x, y, avoid) {
    const room = stage.getBoundingClientRect();
    const box = form.getBoundingClientRect();
    if (avoid) {
      const gap = Number.parseFloat(getComputedStyle(form).marginTop) || 0;
      x = avoid.x;
      y = avoid.y + avoid.height + gap;
      if (y + box.height > room.height) y = avoid.y - box.height - gap;
    }
    form.style.setProperty("--at-x", String(Math.max(0, Math.min(x, room.width - box.width))));
    form.style.setProperty("--at-y", String(Math.max(0, Math.min(y, room.height - box.height))));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (name || allowEmpty) settle(name);
  });
  cancelButton.addEventListener("click", () => settle(null));
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    settle(null);
  });
  // Tabbing or clicking away abandons the entry; moving between its own controls does not.
  form.addEventListener("focusout", (event) => {
    if (pending && !form.contains(event.relatedTarget)) settle(null);
  });

  return {
    ask({ x, y, value, confirmLabel, avoid, allowEmpty: emptyOk = false }) {
      settle(null);
      allowEmpty = emptyOk;
      input.required = !emptyOk;
      submit.textContent = confirmLabel;
      input.value = value;
      form.hidden = false;
      position(x, y, avoid);
      input.focus();
      input.select();
      return new Promise((resolve) => {
        pending = { resolve };
      });
    },

    /** Closes the field without placing anything. */
    cancel() {
      settle(null);
    },

    /** @returns {boolean} */
    isOpen: () => pending !== null,
  };
}
