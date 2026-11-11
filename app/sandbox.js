// The Sandbox page: makes a new base map from scratch. index.html holds the <dialog>; this module fills
// it on first use and shows it over the whole window. It opens on a blank sheet; the person picks how to
// create the ground (paint the ocean, or draw the land's border), draws rivers on it (sandboxcells.js
// holds the cells and the rivers), then saves the base map as a file or opens an empty map over it to play
// or edit. All DOM comes from dialog.ownerDocument, so a test can hand it a fake document.

import { createSandboxGrid, sideFor, PAINTED } from "./sandboxcells.js";
import { readTheme } from "./layerimage.js";
import { dialogParts } from "./dialogparts.js";
import { bindTermTips } from "./termtip.js";
import { MAX_NAME } from "./model.js";

/** Pixels across the sheet's own drawing surface; CSS scales it to the window. */
export const CANVAS_PX = 960;
const DEFAULT_NAME = "New base map";
const BRUSH_MAX = { broad: 32, fine: 128 };
const BRUSH_START = { broad: 8, fine: 32 };
// Drawn wider than a river is on the finished map, where it would be thinner than one sheet pixel.
const RIVER_LINE_PX = { narrow: 2, wide: 4 };
const CREATE_LABEL = { ocean: "Create by ocean", land: "Create by border" };
const BLANK_HINT = "Choose Create by ocean or Create by border to start.";

/**
 * Wire the Sandbox to a <dialog>.
 * @param {{
 *   dialog: HTMLDialogElement,
 *   saveBase: (base: Uint8Array, name: string) => Promise<boolean>,
 *   useBase: (base: Uint8Array, name: string, mode: "view" | "edit") => Promise<boolean>
 * }} options `saveBase` downloads the base map as a map file; `useBase` opens an empty map over it and returns
 *   false when the person declined (the page then stays open, so the work is not lost).
 * @returns {{open: () => void, close: () => void}}
 */
export function createSandbox({ dialog, saveBase, useBase }) {
  const doc = dialog.ownerDocument;
  const { el, button, group, closeButton, canvasFor } = dialogParts(doc);
  let ui = null;
  let grid = null;
  let detail = "broad";
  let tool = "paint";
  let riverWidth = "narrow";
  let busy = false;
  let last = null;
  let colours = { sea: 0, land: 0, water: "" };

  function termButton(label, term, onClick, className) {
    const node = button(label, onClick, className);
    node.setAttribute("data-term", term);
    return node;
  }

  function build() {
    const head = el("div", "sb-bar sb-head");
    const create = group("How to create the ground", "fd-group");
    const createBtns = {
      ocean: termButton(CREATE_LABEL.ocean, "sandbox:ocean", () => chooseCreate("ocean")),
      land: termButton(CREATE_LABEL.land, "sandbox:land", () => chooseCreate("land")),
    };
    create.append(createBtns.ocean, createBtns.land);
    const detailBtn = termButton("", "sandbox:detail", toggleDetail);
    head.append(el("h2", "fd-title", "Sandbox"), create, detailBtn);

    const tools = el("div", "sb-bar");
    const riverRow = group("Rivers", "fd-group");
    const riverBtn = termButton("River", "sandbox:river", () => setTool("river"));
    const widthBtns = {
      narrow: termButton("Narrow", "sandbox:narrow", () => setRiverWidth("narrow")),
      wide: termButton("Wide", "sandbox:wide", () => setRiverWidth("wide")),
    };
    riverRow.append(riverBtn, widthBtns.narrow, widthBtns.wide);
    const eraseBtn = termButton("Erase", "sandbox:erase", () => setTool("erase"));
    const brush = el("input", "sb-brush");
    brush.setAttribute("type", "range");
    brush.setAttribute("min", "1");
    brush.setAttribute("aria-label", "Brush size in cells");
    brush.setAttribute("data-term", "sandbox:brush");
    const undoBtn = termButton("Undo", "sandbox:undo", () => step("undo"));
    const redoBtn = termButton("Redo", "sandbox:redo", () => step("redo"));
    const clearBtn = termButton("Clear", "sandbox:clear", () => step("clear"));
    const restartBtn = termButton("Start over", "sandbox:restart", showBlank);
    tools.append(riverRow, eraseBtn, brush, undoBtn, redoBtn, clearBtn, restartBtn);

    const canvas = canvasFor(CANVAS_PX, CANVAS_PX, "sb-canvas");
    // The largest square the space between the bars allows; .sb-sheet is the container it measures.
    canvas.node.style.width = "min(100cqw, 100cqh)";
    canvas.node.setAttribute("role", "img");
    canvas.node.setAttribute("aria-label", "The base map being drawn");
    canvas.node.addEventListener("pointerdown", onDown);
    canvas.node.addEventListener("pointermove", onMove);
    canvas.node.addEventListener("pointerup", onUp);
    canvas.node.addEventListener("pointercancel", onUp);
    const cellCanvas = doc.createElement("canvas");
    const sheet = el("div", "sb-sheet");
    sheet.append(canvas.node);

    const nameRow = group("Name and save", "sb-bar");
    const nameInput = el("input", "sb-name");
    nameInput.setAttribute("type", "text");
    nameInput.setAttribute("aria-label", "Name of the base map");
    nameInput.setAttribute("maxlength", String(MAX_NAME));
    const saveBtn = termButton("Save base map", "sandbox:save", () => finish("save"));
    const playBtn = termButton("Play on it", "sandbox:play", () => finish("view"), "fd-btn fd-btn-primary");
    const editBtn = termButton("Edit it", "sandbox:edit", () => finish("edit"), "fd-btn fd-btn-primary");
    nameRow.append(nameInput, saveBtn, playBtn, editBtn);

    const status = el("p", "fd-status");
    status.setAttribute("role", "status");
    const body = el("div", "fd-body sb-body");
    body.append(closeButton(close), head, tools, sheet, nameRow, status);
    dialog.className = "fd sb-page";
    dialog.append(body);
    bindTermTips(dialog);

    const needsSheet = [riverBtn, widthBtns.narrow, widthBtns.wide, eraseBtn, brush, clearBtn, restartBtn, nameInput, saveBtn, playBtn, editBtn];
    return { createBtns, detailBtn, riverBtn, widthBtns, eraseBtn, brush, undoBtn, redoBtn, canvas, cellCanvas, nameInput, saveBtn, playBtn, editBtn, status, needsSheet };
  }

  function say(text) {
    ui.status.textContent = text;
  }

  // The same sea, land and river colours the map itself is drawn in.
  function readColours() {
    const { packed, css } = readTheme(doc.defaultView.getComputedStyle(dialog));
    colours = { sea: packed.sea, land: packed.land, water: css.water };
  }

  function showBlank() {
    grid = null;
    tool = "paint";
    ui.nameInput.value = DEFAULT_NAME;
    refresh();
  }

  function toggleDetail() {
    detail = detail === "fine" ? "broad" : "fine";
    refresh();
  }

  // The create button of the sheet in hand is its paint tool; the other one starts a new sheet, and is
  // shut once anything is drawn so a slip cannot throw the drawing away.
  function chooseCreate(start) {
    if (grid?.start === start) {
      setTool("paint");
      return;
    }
    grid = createSandboxGrid({ start, side: sideFor(detail) });
    tool = "paint";
    ui.brush.setAttribute("max", String(BRUSH_MAX[detail]));
    ui.brush.value = String(BRUSH_START[detail]);
    ui.cellCanvas.width = grid.side;
    ui.cellCanvas.height = grid.side;
    refresh();
  }

  function setTool(name) {
    tool = name;
    refresh({ cells: false });
  }

  function setRiverWidth(name) {
    riverWidth = name;
    tool = "river";
    refresh({ cells: false });
  }

  function drawCells() {
    const { side, cells, start } = grid;
    const g = ui.cellCanvas.getContext("2d");
    const image = g.createImageData(side, side);
    const pixels = new Uint32Array(image.data.buffer);
    const painted = start === "ocean" ? colours.sea : colours.land;
    const blank = start === "ocean" ? colours.land : colours.sea;
    for (let i = 0; i < pixels.length; i++) pixels[i] = cells[i] === PAINTED ? painted : blank;
    g.putImageData(image, 0, 0);
  }

  function drawSheet() {
    const { ctx } = ui.canvas;
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    if (!grid) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ui.cellCanvas, 0, 0, CANVAS_PX, CANVAS_PX);
    const scale = CANVAS_PX / grid.side;
    ctx.strokeStyle = colours.water;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const { points, width } of grid.rivers()) {
      ctx.lineWidth = RIVER_LINE_PX[width];
      ctx.beginPath();
      ctx.moveTo((points[0] + 0.5) * scale, (points[1] + 0.5) * scale);
      for (let k = 2; k < points.length; k += 2) ctx.lineTo((points[k] + 0.5) * scale, (points[k + 1] + 0.5) * scale);
      ctx.stroke();
    }
  }

  /** @param {{cells?: boolean}} [what] `cells: false` when only a river or a control changed, which skips the repaint of every cell. */
  function refresh({ cells = true } = {}) {
    const started = grid !== null;
    const drawn = started && (grid.canUndo() || grid.canRedo());
    for (const [start, node] of Object.entries(ui.createBtns)) {
      node.setAttribute("aria-pressed", String(started && grid.start === start && tool === "paint"));
      node.disabled = drawn && grid.start !== start;
    }
    ui.detailBtn.textContent = detail === "fine" ? "Detail: Fine" : "Detail: Broad";
    ui.detailBtn.setAttribute("aria-pressed", String(detail === "fine"));
    ui.detailBtn.disabled = started;
    for (const node of ui.needsSheet) node.disabled = !started;
    ui.riverBtn.setAttribute("aria-pressed", String(tool === "river"));
    for (const [name, node] of Object.entries(ui.widthBtns)) node.setAttribute("aria-pressed", String(riverWidth === name));
    ui.eraseBtn.setAttribute("aria-pressed", String(tool === "erase"));
    ui.undoBtn.disabled = !started || !grid.canUndo();
    ui.redoBtn.disabled = !started || !grid.canRedo();
    if (started && cells) drawCells();
    drawSheet();
    if (!started) {
      say(BLANK_HINT);
      return;
    }
    const share = Math.round(grid.landShare() * 100);
    say(`Land ${share}%, sea ${100 - share}%`);
  }

  function step(name) {
    if (grid?.[name]()) refresh();
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
    grid.beginStroke(tool, riverWidth);
    last = cellAt(event);
    grid.dab(last.x, last.y, Number(ui.brush.value));
    refresh({ cells: tool !== "river" });
  }

  function onMove(event) {
    if (!last) return;
    const here = cellAt(event);
    grid.drag(last.x, last.y, here.x, here.y, Number(ui.brush.value));
    last = here;
    refresh({ cells: tool !== "river" });
  }

  function onUp(event) {
    if (!last) return;
    last = null;
    ui.canvas.node.releasePointerCapture?.(event.pointerId);
    grid.endStroke();
    refresh();
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
      showBlank();
      dialog.setAttribute("aria-label", "Sandbox");
      if (!dialog.open) dialog.showModal();
    },
    close,
  };
}
