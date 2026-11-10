// The Sandbox dialog: makes a new base map from scratch. index.html holds the <dialog>; this module fills
// it on first use. The person picks what to paint first (ocean or land) and how fine the cells are, paints on
// a coarse map (sandboxcells.js), then saves the base map as a file or opens an empty map over it to play
// or edit. All DOM comes from dialog.ownerDocument, so a test can hand it a fake document.

import { createSandboxGrid, sideFor, PAINTED } from "./sandboxcells.js";
import { readTheme } from "./layerimage.js";
import { dialogParts } from "./dialogparts.js";
import { bindTermTips } from "./termtip.js";
import { MAX_NAME } from "./model.js";

/** CSS pixels across the painting area. */
export const CANVAS_PX = 640;
const DEFAULT_NAME = "New base map";
const BRUSH_MAX = { broad: 32, fine: 128 };
const BRUSH_START = { broad: 8, fine: 32 };

/**
 * Wire the Sandbox to a <dialog>.
 * @param {{
 *   dialog: HTMLDialogElement,
 *   saveBase: (base: Uint8Array, name: string) => Promise<boolean>,
 *   useBase: (base: Uint8Array, name: string, mode: "view" | "edit") => Promise<boolean>
 * }} options `saveBase` downloads the base map as a map file; `useBase` opens an empty map over it and returns
 *   false when the person declined (the dialog then stays open, so the work is not lost).
 * @returns {{open: () => void, close: () => void}}
 */
export function createSandbox({ dialog, saveBase, useBase }) {
  const doc = dialog.ownerDocument;
  const { el, button, group, closeButton, canvasFor } = dialogParts(doc);
  let ui = null;
  let grid = null;
  let detail = "broad";
  let erasing = false;
  let busy = false;
  let last = null;
  let colours = { sea: 0, land: 0 };

  function build() {
    const heading = el("h2", "fd-title", "Sandbox: make a base map");

    const startPanel = el("div", "sb-panel");
    const lead = el("p", "sb-lead", "Choose what to paint first. The other kind of ground fills in by itself.");
    const startRow = group("Where to start", "fd-group");
    const oceanBtn = button("Start with ocean", () => begin("ocean"), "fd-btn fd-btn-primary");
    oceanBtn.setAttribute("data-term", "sandbox:ocean");
    const landBtn = button("Start with land", () => begin("land"), "fd-btn fd-btn-primary");
    landBtn.setAttribute("data-term", "sandbox:land");
    startRow.append(oceanBtn, landBtn);
    const detailRow = group("Detail", "fd-group");
    const detailBtn = button("", toggleDetail);
    detailBtn.setAttribute("data-term", "sandbox:detail");
    detailRow.append(el("span", "fd-caption", "Detail"), detailBtn);
    startPanel.append(lead, startRow, detailRow);

    const paintPanel = el("div", "sb-panel");
    const tools = group("Tools", "fd-group");
    const paintBtn = button("Paint", () => setErasing(false));
    paintBtn.setAttribute("data-term", "sandbox:paint");
    const eraseBtn = button("Erase", () => setErasing(true));
    eraseBtn.setAttribute("data-term", "sandbox:erase");
    const brush = el("input", "sb-brush");
    brush.setAttribute("type", "range");
    brush.setAttribute("min", "1");
    brush.setAttribute("aria-label", "Brush size in cells");
    brush.setAttribute("data-term", "sandbox:brush");
    const undoBtn = button("Undo", () => step("undo"));
    undoBtn.setAttribute("data-term", "sandbox:undo");
    const redoBtn = button("Redo", () => step("redo"));
    redoBtn.setAttribute("data-term", "sandbox:redo");
    const clearBtn = button("Clear", () => step("clear"));
    clearBtn.setAttribute("data-term", "sandbox:clear");
    const restartBtn = button("Start over", showStart);
    restartBtn.setAttribute("data-term", "sandbox:restart");
    tools.append(paintBtn, eraseBtn, brush, undoBtn, redoBtn, clearBtn, restartBtn);

    const canvas = canvasFor(CANVAS_PX, CANVAS_PX, "sb-canvas");
    // Square, and small enough that the tools above and the save row below stay on screen.
    canvas.node.style.width = `max(15rem, min(${CANVAS_PX}px, 100vh - 16rem, 100vw - 6rem))`;
    canvas.node.setAttribute("role", "img");
    canvas.node.setAttribute("aria-label", "The base map being painted");
    canvas.node.addEventListener("pointerdown", onDown);
    canvas.node.addEventListener("pointermove", onMove);
    canvas.node.addEventListener("pointerup", onUp);
    canvas.node.addEventListener("pointercancel", onUp);
    const cellCanvas = doc.createElement("canvas");

    const nameRow = group("Name and save", "fd-group");
    const nameInput = el("input", "sb-name");
    nameInput.setAttribute("type", "text");
    nameInput.setAttribute("aria-label", "Name of the base map");
    nameInput.setAttribute("maxlength", String(MAX_NAME));
    const saveBtn = button("Save base map", () => finish("save"));
    saveBtn.setAttribute("data-term", "sandbox:save");
    const playBtn = button("Play on it", () => finish("view"), "fd-btn fd-btn-primary");
    playBtn.setAttribute("data-term", "sandbox:play");
    const editBtn = button("Edit it", () => finish("edit"), "fd-btn fd-btn-primary");
    editBtn.setAttribute("data-term", "sandbox:edit");
    nameRow.append(nameInput, saveBtn, playBtn, editBtn);
    paintPanel.append(tools, canvas.node, nameRow);

    const status = el("p", "fd-status");
    status.setAttribute("role", "status");
    const body = el("div", "fd-body sb-body");
    body.append(closeButton(close), heading, startPanel, paintPanel, status);
    dialog.className = "fd";
    dialog.append(body);
    bindTermTips(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });

    return { heading, startPanel, paintPanel, detailBtn, paintBtn, eraseBtn, brush, undoBtn, redoBtn, clearBtn, canvas, cellCanvas, nameInput, saveBtn, playBtn, editBtn, status };
  }

  function say(text) {
    ui.status.textContent = text;
  }

  // The same sea and land colours the map itself is drawn in.
  function readColours() {
    const { packed } = readTheme(doc.defaultView.getComputedStyle(dialog));
    colours = { sea: packed.sea, land: packed.land };
  }

  function showStart() {
    grid = null;
    ui.startPanel.hidden = false;
    ui.paintPanel.hidden = true;
    ui.detailBtn.textContent = detail === "fine" ? "Detail: Fine" : "Detail: Broad";
    ui.detailBtn.setAttribute("aria-pressed", String(detail === "fine"));
    say("");
  }

  function toggleDetail() {
    detail = detail === "fine" ? "broad" : "fine";
    showStart();
  }

  function begin(start) {
    grid = createSandboxGrid({ start, side: sideFor(detail) });
    ui.startPanel.hidden = true;
    ui.paintPanel.hidden = false;
    ui.heading.textContent = start === "ocean" ? "Sandbox: paint the ocean" : "Sandbox: paint the land";
    ui.brush.setAttribute("max", String(BRUSH_MAX[detail]));
    ui.brush.value = String(BRUSH_START[detail]);
    ui.nameInput.value = DEFAULT_NAME;
    ui.paintBtn.textContent = start === "ocean" ? "Paint ocean" : "Paint land";
    ui.cellCanvas.width = grid.side;
    ui.cellCanvas.height = grid.side;
    setErasing(false);
    redraw();
  }

  function setErasing(value) {
    erasing = value;
    ui.paintBtn.setAttribute("aria-pressed", String(!value));
    ui.eraseBtn.setAttribute("aria-pressed", String(value));
  }

  function redraw() {
    const { side, cells, start } = grid;
    const g = ui.cellCanvas.getContext("2d");
    const image = g.createImageData(side, side);
    const pixels = new Uint32Array(image.data.buffer);
    const painted = start === "ocean" ? colours.sea : colours.land;
    const blank = start === "ocean" ? colours.land : colours.sea;
    for (let i = 0; i < pixels.length; i++) pixels[i] = cells[i] === PAINTED ? painted : blank;
    g.putImageData(image, 0, 0);
    const { ctx } = ui.canvas;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ui.cellCanvas, 0, 0, CANVAS_PX, CANVAS_PX);
    ui.undoBtn.disabled = !grid.canUndo();
    ui.redoBtn.disabled = !grid.canRedo();
    const share = Math.round(grid.landShare() * 100);
    say(`Land ${share}%, sea ${100 - share}%`);
  }

  function step(name) {
    if (grid[name]()) redraw();
  }

  function cellAt(event) {
    const box = ui.canvas.node.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * grid.side - 0.5,
      y: ((event.clientY - box.top) / box.height) * grid.side - 0.5,
    };
  }

  function onDown(event) {
    if (!grid || busy || event.button > 0) return;
    ui.canvas.node.setPointerCapture?.(event.pointerId);
    grid.beginStroke(erasing);
    last = cellAt(event);
    grid.dab(last.x, last.y, Number(ui.brush.value));
    redraw();
  }

  function onMove(event) {
    if (!last) return;
    const here = cellAt(event);
    grid.drag(last.x, last.y, here.x, here.y, Number(ui.brush.value));
    last = here;
    redraw();
  }

  function onUp(event) {
    if (!last) return;
    last = null;
    ui.canvas.node.releasePointerCapture?.(event.pointerId);
    grid.endStroke();
    redraw();
  }

  // Building the plane takes a moment, so the status is painted before the work starts.
  async function finish(what) {
    if (busy || !grid) return;
    busy = true;
    for (const node of [ui.saveBtn, ui.playBtn, ui.editBtn]) node.disabled = true;
    say("Building the base map...");
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const name = ui.nameInput.value.trim().slice(0, MAX_NAME) || DEFAULT_NAME;
      const base = grid.toBase();
      if (what === "save") {
        say((await saveBase(base, name)) ? `Saved ${name}.` : "The base map could not be saved.");
      } else if (await useBase(base, name, what)) {
        close();
      } else {
        say("");
      }
    } catch (error) {
      console.warn("sandbox: the base map was not built", error);
      say("The base map could not be built.");
    } finally {
      busy = false;
      for (const node of [ui.saveBtn, ui.playBtn, ui.editBtn]) node.disabled = false;
    }
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  return {
    open() {
      if (!ui) ui = build();
      readColours();
      ui.heading.textContent = "Sandbox: make a base map";
      showStart();
      dialog.setAttribute("aria-label", "Sandbox");
      if (!dialog.open) dialog.showModal();
    },
    close,
  };
}
