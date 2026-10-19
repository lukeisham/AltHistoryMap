// The small element builders the flag designer and the crest maker share. Everything comes from the
// document handed in, so a test can pass a fake one.

/**
 * @param {Document} doc
 * @returns {{
 *   el: (tag: string, className?: string, text?: string) => HTMLElement,
 *   button: (label: string, onClick: () => void, className?: string) => HTMLButtonElement,
 *   group: (label: string, className: string) => HTMLElement,
 *   canvasFor: (cssW: number, cssH: number, className: string) => {node: HTMLCanvasElement, ctx: CanvasRenderingContext2D}
 * }}
 */
export function dialogParts(doc) {
  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, onClick, className = "fd-btn") {
    const node = el("button", className, label);
    node.setAttribute("type", "button");
    node.addEventListener("click", onClick);
    return node;
  }

  function group(label, className) {
    const node = el("div", className);
    node.setAttribute("role", "group");
    node.setAttribute("aria-label", label);
    return node;
  }

  // Backing store sized for the screen's pixel density so cell edges stay sharp.
  function canvasFor(cssW, cssH, className) {
    const dpr = doc.defaultView?.devicePixelRatio || 1;
    const node = el("canvas", className);
    node.width = Math.round(cssW * dpr);
    node.height = Math.round(cssH * dpr);
    node.style.width = `${cssW}px`;
    const ctx = node.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { node, ctx };
  }

  return { el, button, group, canvasFor };
}
