// The flag designer dialog. interface.js owns the <dialog>; this module fills it on first use and
// resolves open() with the edited cells, or null when the person backs out.
// Link app/flagdesigner.css beside it. All DOM comes from dialog.ownerDocument, so a test can
// hand it a fake document.

import { FLAG_W, FLAG_H } from "./model.js";
import { blankCells, floodFill, pencilLine, starterLayout } from "./flagcells.js";

/** CSS pixels per design pixel on the editing canvas. */
export const GRID_PX = 16;
/** CSS pixels per design pixel in the preview: the size a placed flag is shown at. */
export const PREVIEW_PX = 1.5;
export const HISTORY_LIMIT = 50;

const TOOLS = [
  { id: "pencil", label: "Pencil" },
  { id: "erase", label: "Erase" },
  { id: "fill", label: "Fill" },
];
const STARTERS = [
  { kind: "plain", label: "Plain" },
  { kind: "stripes-h", label: "Stripes (horizontal)" },
  { kind: "stripes-v", label: "Stripes (vertical)" },
  { kind: "cross", label: "Cross" },
  { kind: "saltire", label: "Saltire" },
];
const ARROWS = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

/**
 * Wire a flag designer to a <dialog>.
 * @param {{dialog: HTMLDialogElement, getPalette: () => string[]}} options getPalette returns
 *   hex colours; plane value i is palette[i - 1], 0 is white. It is re-read on every open().
 * @returns {{
 *   open: (design: {cells: Uint8Array|null, colour: number, colour2: number, editing: boolean}) => Promise<Uint8Array|null>,
 *   close: () => void
 * }}
 */
export function createFlagDesigner({ dialog, getPalette }) {
  const doc = dialog.ownerDocument;
  let ui = null;

  let palette = [];
  let cells = blankCells();
  let history = [];
  let tool = "pencil";
  let mirror = false;
  let pen = 1;
  let pen2 = 1;
  let cursor = { x: 0, y: 0 };
  let cursorShown = false;
  let stroke = null;
  let opener = null;
  let pending = null;
  let theme = { line: "#ccc", white: "#fff", focus: "#a80", guide: "#666" };

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

  function build() {
    const body = el("div", "fd-body");
    const heading = el("h2", "fd-title");

    const toolRow = el("div", "fd-row");
    const toolGroup = group("Tool", "fd-group");
    const toolButtons = TOOLS.map(({ id, label }) => {
      const node = button(label, () => setTool(id));
      toolGroup.append(node);
      return { id, node };
    });
    const mirrorBtn = button("Mirror", () => setMirror(!mirror));
    const undoBtn = button("Undo", undo);
    const clearBtn = button("Clear", () => commit(blankCells()));
    toolRow.append(toolGroup, mirrorBtn, undoBtn, clearBtn);

    const stage = el("div", "fd-stage");
    const main = canvasFor(FLAG_W * GRID_PX, FLAG_H * GRID_PX, "fd-canvas");
    main.node.setAttribute("tabindex", "0");
    main.node.setAttribute("role", "application");
    const side = el("div", "fd-side");
    const preview = canvasFor(FLAG_W * PREVIEW_PX, FLAG_H * PREVIEW_PX, "fd-preview");
    preview.node.setAttribute("role", "img");
    preview.node.setAttribute("aria-label", "Preview at placed size");
    side.append(el("span", "fd-caption", "Preview"), preview.node);
    stage.append(main.node, side);

    const status = el("p", "fd-status");
    status.setAttribute("role", "status");

    const swatchRow = group("Colours. Click for the pen colour, Shift-click for the second colour.", "fd-swatches");

    const starterGroup = group("Starter layouts, using the pen colour and the second colour", "fd-group");
    for (const { kind, label } of STARTERS) {
      starterGroup.append(button(label, () => commit(starterLayout(kind, pen, pen2))));
    }

    const actions = el("div", "fd-actions");
    const cancelBtn = button("Cancel", () => settle(null));
    const confirmBtn = button("", () => settle(new Uint8Array(cells)), "fd-btn fd-btn-primary");
    actions.append(cancelBtn, confirmBtn);

    body.append(heading, toolRow, stage, status, swatchRow, starterGroup, actions);
    dialog.className = "fd";
    dialog.append(body);

    main.node.addEventListener("pointerdown", onPointerDown);
    main.node.addEventListener("pointermove", onPointerMove);
    main.node.addEventListener("pointerup", onPointerEnd);
    main.node.addEventListener("pointercancel", onPointerEnd);
    main.node.addEventListener("keydown", onKeyDown);
    // A mouse press also focuses the canvas; only keyboard focus should show the cursor cell.
    main.node.addEventListener("focus", () => showCursor(main.node.matches?.(":focus-visible") ?? true));
    main.node.addEventListener("blur", () => showCursor(false));
    dialog.addEventListener("close", () => settle(null));
    // The padding-free dialog is covered by .fd-body, so a click that lands on the dialog itself hit the backdrop.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) settle(null);
    });

    return {
      heading, toolButtons, mirrorBtn, undoBtn, swatchRow, status, confirmBtn,
      main, preview,
    };
  }

  function readTheme() {
    const style = doc.defaultView.getComputedStyle(dialog);
    const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    theme = {
      line: read("--line", theme.line),
      white: read("--flag-white", theme.white),
      focus: read("--focus", theme.focus),
      guide: read("--ink-2", theme.guide),
    };
  }

  function colourOf(index) {
    if (index === 0) return theme.white;
    const hex = palette[index - 1];
    if (hex === undefined) {
      console.warn(`flagdesigner: palette has no colour ${index}; drawing it white`);
      return theme.white;
    }
    return hex;
  }

  function paintCells(ctx, px, withGrid) {
    for (let y = 0; y < FLAG_H; y++) {
      for (let x = 0; x < FLAG_W; x++) {
        ctx.fillStyle = colourOf(cells[y * FLAG_W + x]);
        ctx.fillRect(x * px, y * px, px, px);
      }
    }
    if (!withGrid) return;
    ctx.fillStyle = theme.line;
    for (let x = 0; x <= FLAG_W; x++) ctx.fillRect(Math.min(x * px, FLAG_W * px - 1), 0, 1, FLAG_H * px);
    for (let y = 0; y <= FLAG_H; y++) ctx.fillRect(0, Math.min(y * px, FLAG_H * px - 1), FLAG_W * px, 1);
  }

  function redraw() {
    const { ctx } = ui.main;
    paintCells(ctx, GRID_PX, true);
    if (mirror) {
      ctx.strokeStyle = theme.guide;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo((FLAG_W / 2) * GRID_PX, 0);
      ctx.lineTo((FLAG_W / 2) * GRID_PX, FLAG_H * GRID_PX);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (cursorShown) {
      ctx.strokeStyle = theme.focus;
      ctx.lineWidth = 2;
      ctx.strokeRect(cursor.x * GRID_PX + 1, cursor.y * GRID_PX + 1, GRID_PX - 2, GRID_PX - 2);
    }
    paintCells(ui.preview.ctx, PREVIEW_PX, false);
    ui.undoBtn.disabled = history.length === 0;
  }

  function describeCanvas() {
    const name = TOOLS.find((t) => t.id === tool).label;
    ui.main.node.setAttribute(
      "aria-label",
      `Flag canvas, ${FLAG_W} columns by ${FLAG_H} rows. ${name} tool${mirror ? ", mirror on" : ""}. `
        + "Arrow keys move the cursor. Space or Enter paints.",
    );
  }

  function setTool(id) {
    tool = id;
    for (const { id: toolId, node } of ui.toolButtons) node.setAttribute("aria-pressed", String(toolId === id));
    describeCanvas();
  }

  function setMirror(on) {
    mirror = on;
    ui.mirrorBtn.setAttribute("aria-pressed", String(on));
    describeCanvas();
    redraw();
  }

  function renderSwatches() {
    const nodes = palette.map((hex, i) => {
      const index = i + 1;
      const node = el("button", "fd-swatch");
      node.setAttribute("type", "button");
      node.style.backgroundColor = hex;
      node.setAttribute("title", hex);
      node.addEventListener("click", (event) => {
        if (event.shiftKey) pen2 = index;
        else pen = index;
        markSwatches();
      });
      return node;
    });
    ui.swatchRow.replaceChildren(...nodes);
    ui.swatches = nodes;
    markSwatches();
  }

  function markSwatches() {
    ui.swatches.forEach((node, i) => {
      const index = i + 1;
      const isPen = index === pen;
      const isSecond = index === pen2;
      node.setAttribute("aria-pressed", String(isPen));
      const marks = [isPen ? "1" : "", isSecond ? "2" : ""].filter(Boolean).join(" ");
      node.setAttribute("data-mark", marks);
      const roles = [isPen ? "pen colour" : "", isSecond ? "second colour" : ""].filter(Boolean).join(", ");
      node.setAttribute("aria-label", `Colour ${index}, ${palette[i]}${roles ? `, ${roles}` : ""}`);
    });
  }

  function say(text) {
    ui.status.textContent = text;
  }

  function sameCells(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  function pushHistory(snapshot) {
    history.push(snapshot);
    if (history.length > HISTORY_LIMIT) history.shift();
  }

  function commit(next) {
    if (sameCells(cells, next)) return;
    pushHistory(cells);
    cells = next;
    redraw();
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return;
    cells = previous;
    redraw();
  }

  function applyAt(x, y) {
    if (tool === "fill") return floodFill(cells, x, y, pen);
    return pencilLine(cells, x, y, x, y, tool === "erase" ? 0 : pen, mirror);
  }

  function cellFromPointer(event) {
    const rect = ui.main.node.getBoundingClientRect();
    const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));
    return {
      x: clamp(Math.floor(((event.clientX - rect.left) / rect.width) * FLAG_W), FLAG_W),
      y: clamp(Math.floor(((event.clientY - rect.top) / rect.height) * FLAG_H), FLAG_H),
    };
  }

  function onPointerDown(event) {
    const { x, y } = cellFromPointer(event);
    cursor = { x, y };
    showCursor(false);
    if (tool === "fill") {
      commit(applyAt(x, y));
      return;
    }
    ui.main.node.setPointerCapture(event.pointerId);
    stroke = { before: cells, last: { x, y } };
    cells = applyAt(x, y);
    redraw();
  }

  function onPointerMove(event) {
    if (!stroke) return;
    const { x, y } = cellFromPointer(event);
    if (x === stroke.last.x && y === stroke.last.y) return;
    cells = pencilLine(cells, stroke.last.x, stroke.last.y, x, y, tool === "erase" ? 0 : pen, mirror);
    stroke.last = { x, y };
    redraw();
  }

  function onPointerEnd(event) {
    if (!stroke) return;
    ui.main.node.releasePointerCapture?.(event.pointerId);
    if (!sameCells(stroke.before, cells)) pushHistory(stroke.before);
    stroke = null;
    redraw();
  }

  function showCursor(on) {
    cursorShown = on;
    if (ui) redraw();
  }

  function onKeyDown(event) {
    const step = ARROWS[event.key];
    if (step) {
      event.preventDefault();
      cursor = {
        x: Math.max(0, Math.min(FLAG_W - 1, cursor.x + step[0])),
        y: Math.max(0, Math.min(FLAG_H - 1, cursor.y + step[1])),
      };
      cursorShown = true;
      say(`Column ${cursor.x + 1}, row ${cursor.y + 1}`);
      redraw();
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      cursorShown = true;
      commit(applyAt(cursor.x, cursor.y));
    }
  }

  function settle(result) {
    if (!pending) return;
    const { resolve } = pending;
    pending = null;
    stroke = null;
    resolve(result);
    if (dialog.open) dialog.close();
    opener?.focus?.();
    opener = null;
  }

  function clampColour(index, fallback) {
    return Number.isInteger(index) && index >= 1 && index <= palette.length ? index : fallback;
  }

  return {
    open({ cells: start, colour, colour2, editing }) {
      if (pending) settle(null);
      palette = [...getPalette()];
      if (!ui) ui = build();
      readTheme();

      if (start && start.length === FLAG_W * FLAG_H) {
        cells = new Uint8Array(start);
      } else {
        if (start) console.warn(`flagdesigner: expected ${FLAG_W * FLAG_H} cells, got ${start.length}; starting blank`);
        cells = blankCells();
      }
      history = [];
      stroke = null;
      pen = clampColour(colour, 1);
      pen2 = clampColour(colour2, Math.min(2, palette.length) || 1);
      cursor = { x: 0, y: 0 };
      cursorShown = false;
      mirror = false;

      ui.heading.textContent = editing ? "Edit flag design" : "New flag design";
      ui.confirmBtn.textContent = editing ? "Save changes" : "Add to library";
      ui.mirrorBtn.setAttribute("aria-pressed", "false");
      renderSwatches();
      setTool("pencil");
      say("");
      redraw();

      opener = doc.activeElement;
      dialog.setAttribute("aria-label", ui.heading.textContent);
      dialog.showModal();
      return new Promise((resolve) => {
        pending = { resolve };
      });
    },

    close() {
      settle(null);
    },
  };
}
