// The one line where errors and confirmations appear. It is an aria-live region, so a screen
// reader announces each change; nothing ever uses alert().

/**
 * @param {HTMLElement} line The element with role="status".
 * @returns {{say: (text: string) => void, clear: () => void}}
 */
export function createMessages(line) {
  return {
    say(text) {
      line.textContent = text;
    },
    clear() {
      line.textContent = "";
    },
  };
}
