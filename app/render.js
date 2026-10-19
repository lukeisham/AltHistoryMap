// Draws the model on the interface's canvas. interface.js owns the canvas element and single-pointer
// input (drag-pan, double-click, editing) and calls this renderer's viewport and query methods;
// the renderer owns the view, the wheel, pinch and keys, and everything drawn.

import { LOOKS, layersDrawn, layersOnScreen } from "./layers.js";
import { createLayerImage, createRiverOverview, makeCanvas, makeSource, readTheme } from "./layerimage.js";
import { createGlyphLibrary, drawMarkers, drawSelection, hitMarker, hitTag } from "./markers.js";
import {
  BUTTON_ZOOM,
  KEY_PAN,
  SINGLE_PIXEL_K,
  brushOutline,
  homeViewport,
  panViewport,
  readoutText,
  resizeViewport,
  screenToGrid,
  zoomViewport,
} from "./viewport.js";

export { pixelColour } from "./layerimage.js";
export { clampViewport, fadeFactor } from "./viewport.js";

const WHEEL_SENSITIVITY = 0.0022;
// Trackpad pinch arrives as ctrl+wheel with deltas about five times smaller than a mouse wheel.
const PINCH_SENSITIVITY = 0.011;
const LINE_HEIGHT = 16;
const MAX_STAGE = 4096;
const BRUSH_FROM_K = 4;
const GRID_ALPHA = 0.14;
const BRUSH_WIDTH = 1.5;
const FILE_NAME_LIMIT = 80;
const ILLEGAL_FILE_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/**
 * File name for a PNG export.
 * @param {string} mapName
 * @param {string} look
 * @returns {string} `<map name>-<layer>.png`, the layer on view (`culture` for the Edit look of
 *   Culture), with characters that file systems reject removed.
 */
export function pngFileName(mapName, look) {
  const cleaned = String(mapName ?? "").replace(ILLEGAL_FILE_CHARS, "").replace(/\s+/g, " ").trim().slice(0, FILE_NAME_LIMIT).trim();
  return `${cleaned || "map"}-${look === "editCulture" ? "culture" : look}.png`;
}

function toBlob(canvas) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("render: PNG encoding returned nothing"))), "image/png");
  });
}

function drawGrid(ctx, scene, first, last) {
  const { vp, stage, theme } = scene;
  ctx.beginPath();
  for (let g = first.x; g <= last.x; g++) {
    const x = vp.x + g * vp.k;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, stage.h);
  }
  for (let g = first.y; g <= last.y; g++) {
    const y = vp.y + g * vp.k;
    ctx.moveTo(0, y);
    ctx.lineTo(stage.w, y);
  }
  ctx.globalAlpha = GRID_ALPHA;
  ctx.lineWidth = 1;
  ctx.strokeStyle = theme.css.ink;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBrush(ctx, scene) {
  const { vp, theme, hover, brush } = scene;
  const edges = brushOutline(brush);
  const left = vp.x + hover.x * vp.k;
  const top = vp.y + hover.y * vp.k;
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of edges) {
    ctx.moveTo(left + x0 * vp.k, top + y0 * vp.k);
    ctx.lineTo(left + x1 * vp.k, top + y1 * vp.k);
  }
  ctx.lineWidth = BRUSH_WIDTH * 2;
  ctx.strokeStyle = theme.css.land;
  ctx.stroke();
  ctx.lineWidth = BRUSH_WIDTH;
  ctx.strokeStyle = theme.css.ink;
  ctx.stroke();
}

// Rivers are one grid pixel wide, so zoomed out they fall below a screen pixel; the overlay redraws them wider.
function drawRivers(ctx, scene, first, last) {
  const { vp } = scene;
  const level = scene.rivers.levelFor(vp.k, scene.theme.packed.water);
  if (!level) return;
  const { canvas, scale } = level;
  const x0 = Math.floor(first.x / scale);
  const y0 = Math.floor(first.y / scale);
  const x1 = Math.min(canvas.width, Math.ceil(last.x / scale));
  const y1 = Math.min(canvas.height, Math.ceil(last.y / scale));
  if (x1 <= x0 || y1 <= y0) return;
  const cell = scale * vp.k;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, vp.x + x0 * cell, vp.y + y0 * cell, (x1 - x0) * cell, (y1 - y0) * cell);
}

/**
 * One frame onto a context whose transform already maps CSS pixels. Shared by the screen and PNG
 * export; `interactive` adds the grid, brush outline and selection ring.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene Stage, view, layer picture, theme and marker data.
 * @param {boolean} interactive
 */
function drawFrame(ctx, scene, interactive) {
  const { stage, vp, n } = scene;
  ctx.fillStyle = scene.theme.css.sea;
  ctx.fillRect(0, 0, stage.w, stage.h);

  const first = {
    x: Math.max(0, Math.floor(-vp.x / vp.k)),
    y: Math.max(0, Math.floor(-vp.y / vp.k)),
  };
  const last = {
    x: Math.min(n, Math.ceil((stage.w - vp.x) / vp.k)),
    y: Math.min(n, Math.ceil((stage.h - vp.y) / vp.k)),
  };
  if (last.x > first.x && last.y > first.y) {
    ctx.imageSmoothingEnabled = vp.k < 1;
    if (vp.k < 1) ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      scene.layerCanvas,
      first.x,
      first.y,
      last.x - first.x,
      last.y - first.y,
      vp.x + first.x * vp.k,
      vp.y + first.y * vp.k,
      (last.x - first.x) * vp.k,
      (last.y - first.y) * vp.k,
    );
    drawRivers(ctx, scene, first, last);
    if (interactive && vp.k >= SINGLE_PIXEL_K) drawGrid(ctx, scene, first, last);
  }
  if (interactive && scene.brush && scene.hover && vp.k >= BRUSH_FROM_K) drawBrush(ctx, scene);
  drawMarkers(ctx, scene);
  if (interactive && scene.selected != null) {
    const marker = scene.markers.find((m) => m.id === scene.selected);
    if (marker) drawSelection(ctx, scene, marker);
  }
}

/**
 * Attaches a renderer to a canvas. The canvas must fill its parent through CSS (the parent's
 * client size is the stage); the renderer sets only the canvas's pixel size.
 * @param {{canvas: HTMLCanvasElement, model: object, glyphs: {id: string, label: string, path: string}[]}} options
 * @returns {object} The renderer.
 */
export function createRenderer({ canvas, model, glyphs }) {
  const n = model.n;
  const ctx = canvas.getContext("2d");
  const glyphLibrary = createGlyphLibrary(glyphs);
  const layerImage = createLayerImage(n);
  const rivers = createRiverOverview(n, model.base);
  const disposers = [];

  let look = "political";
  let cityColour = "neutral";
  let theme = readTheme(getComputedStyle(canvas));
  let stage = { w: 0, h: 0 };
  let dpr = 1;
  let vp = { x: 0, y: 0, k: 1, kFit: 1 };
  let brush = null;
  let hover = null;
  let selected = null;
  let preview = null;
  let needsRebuild = true;
  let dirty = null;
  let frameRequest = 0;

  canvas.style.touchAction = "none";

  function scheduleFrame() {
    if (frameRequest) return;
    frameRequest = requestAnimationFrame(frame);
  }

  function setView(next) {
    vp = next;
    scheduleFrame();
  }

  function readStageSize() {
    const parent = canvas.parentElement;
    return {
      w: Math.min(MAX_STAGE, Math.round(parent?.clientWidth ?? 0)),
      h: Math.min(MAX_STAGE, Math.round(parent?.clientHeight ?? 0)),
    };
  }

  function syncSize() {
    const next = readStageSize();
    const nextDpr = globalThis.devicePixelRatio || 1;
    if (next.w === 0 || next.h === 0) return;
    if (next.w === stage.w && next.h === stage.h && nextDpr === dpr) return;
    vp = resizeViewport(vp, stage, next, n);
    stage = next;
    dpr = nextDpr;
    canvas.width = Math.round(stage.w * dpr);
    canvas.height = Math.round(stage.h * dpr);
  }

  function flushLayerImage() {
    if (!needsRebuild && !dirty) return;
    const src = makeSource(model, theme);
    if (needsRebuild) layerImage.rebuild(look, src);
    else layerImage.update(look, src, dirty);
    needsRebuild = false;
    dirty = null;
  }

  function scene() {
    return {
      stage,
      vp,
      n,
      layers: layersOnScreen(look),
      layerCanvas: layerImage.canvas,
      rivers,
      theme,
      markers: model.markers,
      cityColour,
      political: model.planes.political,
      designs: model.designs,
      palette: model.palette,
      glyphs: glyphLibrary,
      brush,
      hover,
      selected,
      preview,
    };
  }

  function frame() {
    frameRequest = 0;
    syncSize();
    if (stage.w === 0 || stage.h === 0) return;
    flushLayerImage();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(ctx, scene(), true);
  }

  function invalidate() {
    needsRebuild = true;
    scheduleFrame();
  }

  function refreshTheme() {
    theme = readTheme(getComputedStyle(canvas));
    invalidate();
  }

  function onModelChange(notice) {
    if (notice.all || notice.palette) {
      needsRebuild = true;
    } else if (notice.rect) {
      if (!layersDrawn(look).includes(notice.layer)) return;
      if (!needsRebuild) dirty = dirty ? unionRect(dirty, notice.rect) : { ...notice.rect };
    } else if (!notice.markers && !notice.history) {
      console.warn("render: unknown model notice", notice);
    }
    scheduleFrame();
  }

  function zoomAt(factor, sx, sy) {
    if (!(factor > 0) || !Number.isFinite(factor)) {
      console.warn("render: zoom factor must be a positive number", factor);
      return;
    }
    if (stage.w === 0) return;
    setView(zoomViewport(vp, factor, sx, sy, stage, n));
  }

  function panBy(dx, dy) {
    if (stage.w === 0) return;
    setView(panViewport(vp, dx, dy, stage, n));
  }

  // ---- input: wheel, pinch, keys ----

  function localPoint(event) {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function onWheel(event) {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? stage.h : 1;
    const sensitivity = event.ctrlKey ? PINCH_SENSITIVITY : WHEEL_SENSITIVITY;
    const point = localPoint(event);
    zoomAt(Math.exp(-event.deltaY * unit * sensitivity), point.x, point.y);
  }

  const touches = new Map();
  let pinch = null;

  function pinchState() {
    const [a, b] = [...touches.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onPointerDown(event) {
    if (event.pointerType !== "touch") return;
    touches.set(event.pointerId, localPoint(event));
    if (touches.size === 2) pinch = pinchState();
  }

  function onPointerMove(event) {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, localPoint(event));
    if (touches.size !== 2 || !pinch) return;
    const now = pinchState();
    if (pinch.distance > 0) zoomAt(now.distance / pinch.distance, now.x, now.y);
    panBy(now.x - pinch.x, now.y - pinch.y);
    pinch = now;
  }

  function onPointerEnd(event) {
    touches.delete(event.pointerId);
    if (touches.size < 2) pinch = null;
  }

  const KEY_ACTIONS = {
    "+": () => renderer.zoomIn(),
    "=": () => renderer.zoomIn(),
    "-": () => renderer.zoomOut(),
    _: () => renderer.zoomOut(),
    ArrowLeft: () => panBy(KEY_PAN, 0),
    ArrowRight: () => panBy(-KEY_PAN, 0),
    ArrowUp: () => panBy(0, KEY_PAN),
    ArrowDown: () => panBy(0, -KEY_PAN),
  };

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = KEY_ACTIONS[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  }

  const renderer = {
    /**
     * Shows another look.
     * @param {string} next One of LOOKS in layers.js.
     */
    setLook(next) {
      if (!LOOKS.includes(next)) {
        console.warn("render: unknown look", next);
        return;
      }
      look = next;
      invalidate();
    },

    /**
     * @param {"neutral" | "nation"} next How a city's centre dot is coloured: ink, or the political colour under it.
     */
    setCityColour(next) {
      if (next !== "neutral" && next !== "nation") {
        console.warn("render: unknown city colour", next);
        return;
      }
      cityColour = next;
      scheduleFrame();
    },

    /** @returns {string} The look on screen. */
    getLook() {
      return look;
    },

    /**
     * Shows the edit-mode brush outline under the hover pixel.
     * @param {number | null} diameter Null hides it.
     */
    setBrush(diameter) {
      brush = diameter;
      scheduleFrame();
    },

    /**
     * @param {{x: number, y: number} | null} pixel Grid pixel under the pointer.
     */
    setHover(pixel) {
      hover = pixel;
      if (brush) scheduleFrame();
    },

    /**
     * @param {number | null} markerId Marker to ring; null clears it.
     */
    setSelected(markerId) {
      selected = markerId;
      scheduleFrame();
    },

    /**
     * Shows a marker somewhere other than where it is stored, while it is being dragged.
     * @param {{id: number, x?: number, y?: number, tagDx?: number, tagDy?: number} | null} fields Null ends the preview.
     */
    setPreview(fields) {
      preview = fields;
      scheduleFrame();
    },

    /** @returns {{x: number, y: number, k: number, kFit: number}} Screen offset of the grid corner, and the zoom. */
    get viewport() {
      return { ...vp };
    },

    /** @returns {boolean} True while two fingers are down, so single-pointer drag should stand down. */
    get pinching() {
      return pinch !== null;
    },

    /**
     * Multiplies the zoom, keeping the point under (sx, sy) fixed.
     * @param {number} factor
     * @param {number} sx CSS pixels from the canvas's left edge.
     * @param {number} sy CSS pixels from the canvas's top edge.
     */
    zoomAt,

    /** Zooms in about the stage centre. */
    zoomIn() {
      zoomAt(BUTTON_ZOOM, stage.w / 2, stage.h / 2);
    },

    /** Zooms out about the stage centre. */
    zoomOut() {
      zoomAt(1 / BUTTON_ZOOM, stage.w / 2, stage.h / 2);
    },

    /** Shows the whole world. */
    zoomHome() {
      if (stage.w === 0) return;
      setView(homeViewport(stage, n));
    },

    /**
     * Moves the view so content follows a dragging pointer.
     * @param {number} dxCss
     * @param {number} dyCss
     */
    panBy,

    /**
     * @param {number} sx
     * @param {number} sy
     * @returns {{x: number, y: number, inside: boolean}} Grid pixel (clamped to the grid) under a canvas point.
     */
    toGrid(sx, sy) {
      return screenToGrid(vp, sx, sy, n);
    },

    /**
     * @param {number} sx
     * @param {number} sy
     * @returns {object | null} The nearest marker within reach that is drawn.
     */
    hitTest(sx, sy) {
      return hitMarker(model.markers, layersOnScreen(look), vp, sx, sy);
    },

    /**
     * @param {number} sx
     * @param {number} sy
     * @returns {object | null} The marker whose name tag is under the point, when the tag is showing.
     */
    hitTag(sx, sy) {
      return hitTag(model.markers, layersOnScreen(look), vp, sx, sy, (text, size) => {
        ctx.font = `${size}px ${theme.font}`;
        return ctx.measureText(text).width;
      });
    },

    /**
     * @param {{x: number, y: number} | null} pixel Null when the pointer is off the map.
     * @returns {{coord: string, zoom: string}}
     */
    readout(pixel) {
      return readoutText(pixel, vp, n);
    },

    /** @returns {Promise<Blob>} PNG of the current view at stage size times device pixel ratio. */
    async exportPng() {
      if (stage.w === 0 || stage.h === 0) throw new Error("render: the map has no size to export");
      flushLayerImage();
      const out = makeCanvas(Math.round(stage.w * dpr), Math.round(stage.h * dpr));
      const outCtx = out.getContext("2d");
      outCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(outCtx, scene(), false);
      return toBlob(out);
    },

    /** Re-reads the colour tokens and repaints. */
    refreshTheme,

    /** Rebuilds the layer picture and redraws. */
    invalidate,

    /** Removes every listener and observer. */
    destroy() {
      for (const dispose of disposers.splice(0)) dispose();
      if (frameRequest) cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    },
  };

  disposers.push(model.onChange(onModelChange));
  listen(canvas, "wheel", onWheel, { passive: false });
  listen(canvas, "pointerdown", onPointerDown);
  listen(canvas, "pointermove", onPointerMove);
  listen(canvas, "pointerup", onPointerEnd);
  listen(canvas, "pointercancel", onPointerEnd);
  listen(canvas, "keydown", onKeyDown);

  const parent = canvas.parentElement;
  if (typeof ResizeObserver !== "undefined" && parent) {
    const observer = new ResizeObserver(() => {
      syncSize();
      scheduleFrame();
    });
    observer.observe(parent);
    disposers.push(() => observer.disconnect());
  } else {
    console.warn("render: no ResizeObserver; the map will not follow stage size changes");
  }

  syncSize();
  scheduleFrame();
  return renderer;
}

function unionRect(a, b) {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}
