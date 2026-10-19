// The map stage: single-pointer input over the canvas, the zoom buttons, the live readout, and the
// marker popovers. Wheel, pinch and the zoom keys belong to the renderer. Every tool path starts
// with editor.editGate(), so View mode can only pan, zoom and read.

import { STROKE_TOOLS, BRUSH_TOOLS, PLACING_TOOLS } from "./tools.js";
import { hasDragItem, readDragItem } from "./dragitem.js";

const CLICK_SLOP = 4;
const DOUBLE_CLICK_ZOOM = 2;
const MIDDLE_BUTTON = 1;
const RIGHT_BUTTON = 2;
const BORDER_BRUSH = 1;

/**
 * What a press on the map starts.
 * @param {{mode: string, tool: string | null}} view
 * @param {boolean} onMarker True when the press landed on a marker of the layer on screen.
 * @param {boolean} [onTag] True when it landed on a name tag instead.
 * @returns {"pan" | "paint" | "fill" | "place" | "move" | "tag"}
 */
export function intentFor({ mode, tool }, onMarker, onTag = false) {
  if (mode !== "edit") return "pan";
  if (tool !== null && STROKE_TOOLS.includes(tool)) return "paint";
  if (tool === "fill") return "fill";
  if (onMarker) return "move";
  if (onTag) return "tag";
  return tool === null ? "pan" : "place";
}

/**
 * @param {{mode: string, tool: string | null}} view
 * @param {string | null} interaction The drag in progress, if any.
 * @returns {"grab" | "grabbing" | "crosshair" | "copy"}
 */
export function cursorFor({ mode, tool }, interaction) {
  if (interaction === "pan" || interaction === "move" || interaction === "tag") return "grabbing";
  if (mode !== "edit" || tool === null) return "grab";
  return PLACING_TOOLS.includes(tool) ? "copy" : "crosshair";
}

/**
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   renderer: object,
 *   model: object,
 *   state: {get: () => object, set: (patch: object) => void, subscribe: Function},
 *   editor: object,
 *   nameField: {ask: Function, cancel: () => void},
 *   markerInfo: {show: Function, hide: () => boolean, isOpen: () => boolean, onRename: Function, onDelete: Function},
 *   designs: {editFlag: (marker: object) => void},
 *   say: (text: string) => void,
 *   glyphIds: string[],
 *   isPanHeld: () => boolean,
 *   readout: {coord: HTMLElement, zoom: HTMLElement},
 *   zoomButtons: {zoomIn: HTMLElement, zoomOut: HTMLElement, home: HTMLElement}
 * }} deps
 * @returns {{refresh: () => void, dismiss: () => boolean}} `refresh` re-reads the map name and the readout;
 *   `dismiss` clears the selection and popover, returning true when there was one.
 */
export function createStage(deps) {
  const { canvas, renderer, model, state, editor, nameField, markerInfo, designs, say, glyphIds, isPanHeld, readout, zoomButtons } = deps;
  let drag = null;
  let hover = null;
  let readoutQueued = false;

  const local = (event) => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  function updateReadout() {
    readoutQueued = false;
    const text = renderer.readout(hover);
    readout.coord.textContent = text.coord;
    readout.zoom.textContent = text.zoom;
  }

  function scheduleReadout() {
    if (readoutQueued) return;
    readoutQueued = true;
    // After the renderer's own handler for the same event has applied the new view.
    requestAnimationFrame(updateReadout);
  }

  function setCursor() {
    canvas.dataset.cursor = cursorFor(state.get(), drag?.kind ?? null);
  }

  function syncBrush() {
    const { mode, tool, brush } = state.get();
    if (mode !== "edit") renderer.setBrush(null);
    else if (BRUSH_TOOLS.includes(tool)) renderer.setBrush(brush);
    else renderer.setBrush(tool === "border" ? BORDER_BRUSH : null);
  }

  // ---- selection and the marker popover ----

  function select(marker) {
    state.set({ selected: marker.id });
    const view = renderer.viewport;
    markerInfo.show({
      marker,
      x: view.x + (marker.x + 0.5) * view.k,
      y: view.y + (marker.y + 0.5) * view.k,
      editable: state.get().mode === "edit",
    });
  }

  function dismiss() {
    const had = markerInfo.isOpen() || state.get().selected !== null;
    state.set({ selected: null });
    markerInfo.hide();
    nameField.cancel();
    return Boolean(had);
  }

  async function nameThenPlace(point) {
    const pixel = renderer.toGrid(point.x, point.y);
    if (!pixel.inside) return;
    const { tool } = state.get();
    let name = "";
    if (editor.asksForName()) {
      name = await nameField.ask({ x: point.x, y: point.y, value: editor.defaultName(), confirmLabel: "Place" });
      canvas.focus();
      // A different tool picked while the field was open means the person moved on.
      if (name === null || state.get().tool !== tool) return;
    }
    if (!editor.place(pixel, name)) say("That could not be placed.");
  }

  async function rename(id, x, y, avoid) {
    if (!editor.editGate()) return;
    const marker = model.markers.find((m) => m.id === id);
    if (!marker) return;
    const name = await nameField.ask({ x, y, avoid, value: marker.name, confirmLabel: "Rename", allowEmpty: marker.type !== "label" });
    if (name !== null && editor.renameMarker(id, name)) {
      dismiss();
      return;
    }
    if (model.markers.includes(marker)) select(marker);
  }

  markerInfo.onRename(rename);
  markerInfo.onCapital((id, capital) => {
    editor.setCapital(id, capital);
    const marker = model.markers.find((m) => m.id === id);
    if (marker) select(marker);
  });
  markerInfo.onDelete((id) => {
    editor.deleteMarker(id);
    markerInfo.hide();
  });

  function isSelectionGone() {
    const { selected } = state.get();
    return selected !== null && !model.markers.some((m) => m.id === selected);
  }

  // ---- pointer ----

  function pixelAt(point) {
    return renderer.toGrid(point.x, point.y);
  }

  // How far the press was from the marker's pixel, so a marker dragged by its flag cloth does not jump to the pointer.
  function grabOffset(marker, point) {
    const view = renderer.viewport;
    return { x: point.x - (view.x + (marker.x + 0.5) * view.k), y: point.y - (view.y + (marker.y + 0.5) * view.k) };
  }

  function startTool(kind, point, hit) {
    if (!editor.editGate()) return false;
    const pixel = pixelAt(point);
    if (kind === "paint" && pixel.inside) drag.began = editor.beginStroke(pixel);
    else if (kind === "fill" && pixel.inside) editor.fill(pixel);
    else if (kind === "move") select(hit);
    return true;
  }

  function onPointerDown(event) {
    if (drag) finish(drag.pointerId, false);
    if (renderer.pinching) return;
    const panning = event.button === MIDDLE_BUTTON || event.button === RIGHT_BUTTON || isPanHeld();
    if (!panning && event.button !== 0) return;
    nameField.cancel();
    const point = local(event);
    const markerHit = renderer.hitTest(point.x, point.y);
    const tagHit = markerHit ? null : renderer.hitTag(point.x, point.y);
    const hit = markerHit ?? tagHit;
    const kind = panning ? "pan" : intentFor(state.get(), markerHit !== null, tagHit !== null);
    drag = { kind, pointerId: event.pointerId, button: event.button, start: point, last: point, moved: false, hit, began: false, target: null, grab: null, tagTo: null };
    if (hit) drag.grab = grabOffset(hit, point);
    canvas.setPointerCapture(event.pointerId);
    if (kind !== "pan" && !startTool(kind, point, hit)) drag.kind = "pan";
    if (kind === "move" || kind === "tag" || kind === "pan") markerInfo.hide();
    setCursor();
  }

  function dragTo(event, point) {
    if (!drag.moved && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > CLICK_SLOP) drag.moved = true;
    const pixel = pixelAt(point);
    if (drag.kind === "pan" && drag.moved) {
      renderer.panBy(point.x - drag.last.x, point.y - drag.last.y);
      drag.last = point;
    } else if (drag.kind === "paint" && editor.editGate() && pixel.inside) {
      if (drag.began) editor.strokeTo(pixel);
      else drag.began = editor.beginStroke(pixel);
    } else if (drag.kind === "move" && drag.moved) {
      const target = pixelAt({ x: point.x - drag.grab.x, y: point.y - drag.grab.y });
      if (!target.inside) return;
      drag.target = target;
      renderer.setPreview({ id: drag.hit.id, x: target.x, y: target.y });
    } else if (drag.kind === "tag" && drag.moved) {
      drag.tagTo = {
        dx: Math.round(drag.hit.tagDx + point.x - drag.start.x),
        dy: Math.round(drag.hit.tagDy + point.y - drag.start.y),
      };
      renderer.setPreview({ id: drag.hit.id, tagDx: drag.tagTo.dx, tagDy: drag.tagTo.dy });
    }
  }

  function onPointerMove(event) {
    const point = local(event);
    const pixel = pixelAt(point);
    hover = pixel.inside ? pixel : null;
    renderer.setHover(hover);
    scheduleReadout();
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (renderer.pinching) {
      finish(drag.pointerId, false);
      return;
    }
    dragTo(event, point);
  }

  // `commit` is false when the press was cancelled or a second finger arrived: nothing is selected or placed.
  function finish(pointerId, commit) {
    const done = drag;
    drag = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    setCursor();
    if (done.kind === "move" || done.kind === "tag") renderer.setPreview(null);
    if (done.kind === "paint") {
      editor.endStroke();
      return;
    }
    if (!commit) return;
    if (done.kind === "move" && done.moved) {
      if (done.target && editor.moveMarker(done.hit.id, done.target)) select(done.hit);
    } else if (done.kind === "tag" && done.moved) {
      if (done.tagTo && editor.moveTag(done.hit.id, done.tagTo.dx, done.tagTo.dy)) select(done.hit);
    } else if (!done.moved && done.button === 0 && done.kind !== "fill") {
      clicked(done);
    }
  }

  function clicked(done) {
    if (done.hit) {
      select(done.hit);
      return;
    }
    dismiss();
    if (done.kind === "place") nameThenPlace(done.start);
  }

  function onPointerUp(event) {
    if (drag && drag.pointerId === event.pointerId) finish(event.pointerId, true);
  }

  function onPointerCancel(event) {
    if (drag && drag.pointerId === event.pointerId) finish(event.pointerId, false);
  }

  function onDoubleClick(event) {
    const point = local(event);
    if (state.get().mode !== "edit") {
      renderer.zoomAt(DOUBLE_CLICK_ZOOM, point.x, point.y);
      markerInfo.hide();
      scheduleReadout();
      return;
    }
    const hit = renderer.hitTest(point.x, point.y);
    if (hit?.type === "flag") designs.editFlag(hit);
  }

  function onDragOver(event) {
    if (!hasDragItem(event) || !editor.editGate()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  // A dropped panel item is placed exactly as if its button had been clicked and then the map clicked at the drop.
  function onDrop(event) {
    if (!hasDragItem(event)) return;
    event.preventDefault();
    if (!editor.editGate()) return;
    const item = readDragItem(event, { glyphIds, designCount: model.designs.length });
    if (!item) return;
    const tool = item.kind;
    state.set(item.kind === "symbol" ? { tool, glyph: item.glyph } : { tool, design: item.design });
    if (state.get().tool !== tool) {
      say("That item is not available on this layer.");
      return;
    }
    nameThenPlace(local(event));
  }

  function onPointerLeave() {
    hover = null;
    renderer.setHover(null);
    scheduleReadout();
  }

  function onViewChange() {
    markerInfo.hide();
    scheduleReadout();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("dblclick", onDoubleClick);
  canvas.addEventListener("dragover", onDragOver);
  canvas.addEventListener("drop", onDrop);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", onViewChange, { passive: true });
  canvas.addEventListener("keydown", onViewChange);
  zoomButtons.zoomIn.addEventListener("click", () => {
    renderer.zoomIn();
    onViewChange();
  });
  zoomButtons.zoomOut.addEventListener("click", () => {
    renderer.zoomOut();
    onViewChange();
  });
  zoomButtons.home.addEventListener("click", () => {
    renderer.zoomHome();
    onViewChange();
  });
  if (globalThis.ResizeObserver) new ResizeObserver(scheduleReadout).observe(canvas);

  state.subscribe((value, changed) => {
    if (changed.includes("selected")) renderer.setSelected(value.selected);
    if (changed.includes("mode") || changed.includes("layer") || changed.includes("view")) dismiss();
    if (changed.includes("mode") || changed.includes("tool") || changed.includes("brush")) syncBrush();
    if (changed.includes("mode") || changed.includes("tool")) setCursor();
  });

  model.onChange((notice) => {
    if (notice.all) dismiss();
    else if (notice.markers && isSelectionGone()) dismiss();
    else if (notice.markers && markerInfo.isOpen()) {
      // A capital can turn back into a city under a brush; the open popover must say so.
      const marker = model.markers.find((m) => m.id === state.get().selected);
      if (marker) select(marker);
    }
  });

  syncBrush();
  setCursor();

  return {
    refresh() {
      canvas.setAttribute("aria-label", `${model.name}. World map. Arrow keys move the map, plus and minus zoom.`);
      scheduleReadout();
    },
    dismiss,
  };
}
