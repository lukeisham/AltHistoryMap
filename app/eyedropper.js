// The eye-dropper button beside every + swatch. Where the browser has window.EyeDropper it reads one colour
// from anywhere on screen and hands it to onPick, the same path as the colour a + picker returns; where it
// does not, the click opens that + picker instead, so the button never does nothing. palette.js,
// flagdesigner.js and crestmaker.js each place one.

const ICON =
  '<svg viewBox="0 0 24 24" class="eyedropper-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';
const LABEL = "Pick a colour from the screen";

/**
 * @param {{
 *   doc: Document,
 *   className: string,
 *   onPick: (hex: string) => void,
 *   openPicker: () => void,
 *   getDropper?: () => (new () => {open: () => Promise<{sRGBHex: string}>}) | undefined
 * }} options `onPick` receives the sampled `#rrggbb`; `openPicker` opens the + colour input; `getDropper` is read on each click.
 * @returns {HTMLButtonElement}
 */
export function createEyeDropperButton({ doc, className, onPick, openPicker, getDropper = () => globalThis.EyeDropper }) {
  const button = doc.createElement("button");
  button.setAttribute("type", "button");
  button.className = className;
  button.setAttribute("aria-label", LABEL);
  button.setAttribute("title", LABEL);
  button.innerHTML = ICON;
  button.addEventListener("click", async () => {
    const Dropper = getDropper();
    if (!Dropper) {
      openPicker();
      return;
    }
    try {
      const { sRGBHex } = await new Dropper().open();
      onPick(sRGBHex);
    } catch (error) {
      if (error?.name !== "AbortError") console.warn("eyedropper: could not read a colour", error);
    }
  });
  return button;
}
