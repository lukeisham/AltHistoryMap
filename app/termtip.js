// The pop-up that explains a heraldic or flag term when the pointer rests on it, or when it has keyboard
// focus. Any element carrying data-term="<group>:<id>" (see terms.js) gets one. The pop-up lives inside the
// dialog it serves, because a modal dialog sits above everything outside it.
// Link app/termtip.css beside it.

import { termFor } from "./terms.js";

const SHOW_DELAY_MS = 250;
const GAP = 6;
let tipCount = 0;

/**
 * Wire term pop-ups to everything inside `root` that has a data-term.
 * @param {HTMLElement} root a dialog (or any container) whose descendants carry data-term
 * @returns {{hide: () => void}}
 */
export function bindTermTips(root) {
  const doc = root.ownerDocument;
  const tip = doc.createElement("div");
  tip.className = "term-tip";
  tip.id = `term-tip-${++tipCount}`;
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  const heading = doc.createElement("strong");
  const body = doc.createElement("span");
  tip.append(heading, body);
  root.append(tip);

  let timer = null;
  let current = null;

  function termNode(event) {
    return event.target?.closest?.("[data-term]") ?? null;
  }

  function place(target) {
    const view = doc.defaultView;
    const anchor = target.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    const fitsBelow = anchor.bottom + GAP + size.height <= view.innerHeight;
    const top = fitsBelow ? anchor.bottom + GAP : Math.max(0, anchor.top - GAP - size.height);
    const left = Math.max(0, Math.min(anchor.left, view.innerWidth - size.width - GAP));
    tip.style.setProperty("--at-x", String(left));
    tip.style.setProperty("--at-y", String(top));
  }

  function show(target) {
    const term = termFor(target.getAttribute("data-term"));
    if (!term) {
      console.warn("termtip: no definition for", target.getAttribute("data-term"));
      return;
    }
    heading.textContent = term.name;
    body.textContent = term.text;
    tip.hidden = false;
    target.setAttribute("aria-describedby", tip.id);
    current = target;
    place(target);
  }

  function hide() {
    clearTimeout(timer);
    timer = null;
    tip.hidden = true;
    current?.removeAttribute?.("aria-describedby");
    current = null;
  }

  root.addEventListener("pointerover", (event) => {
    const target = termNode(event);
    if (!target || target === current) return;
    hide();
    timer = setTimeout(() => show(target), SHOW_DELAY_MS);
  });
  root.addEventListener("pointerout", (event) => {
    if (termNode(event)) hide();
  });
  root.addEventListener("focusin", (event) => {
    const target = termNode(event);
    if (!target) return;
    hide();
    show(target);
  });
  root.addEventListener("focusout", hide);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
  root.addEventListener("pointerdown", hide);
  root.addEventListener("close", hide);

  return { hide };
}
