// The one place map data lives and changes. render.js reads the planes and listens to onChange;
// interface.js calls every edit operation; mapfile.js reads snapshot() and calls replace().

export const N = 4096;
export const LAND = 1;
export const RIVER = 2;
export const LAKE = 4;
export const COAST = 8;
export const WATER = RIVER | LAKE;
export const FIGHTING = 255;
export const FLAG_W = 24;
export const FLAG_H = 16;
export const MAX_PALETTE = 254;
export const MAX_DESIGNS = 64;
export const MAX_NAME = 60;
export const MAX_TAG_OFFSET = 2000;
export const LAYERS = ["political", "conflict", "culture"];
export const MARKER_TYPES = ["city", "flag", "label", "symbol"];
export const PLANE_NAMES = ["political", "culture", "claimA", "claimB", "border"];
export const DEFAULT_PALETTE = ["#b5473b", "#c98b2b", "#d9c04a", "#5c8a4d", "#3f7f9c", "#6c5a9e", "#8a5a3c", "#4a4a4a"];

const MAX_LAT = 85.0511;
const MAX_STEPS = 100;
const MAX_ENTRIES = 8_000_000;
const HEX = /^#[0-9a-f]{6}$/;

// Mercator limits the world to a square, so rows and columns share one scale.
/**
 * Longitude/latitude to fractional grid coordinates (pixel centres sit at +0.5).
 * @param {number} lon
 * @param {number} lat
 * @param {number} [n]
 * @returns {{x: number, y: number}}
 */
export function project(lon, lat, n = N) {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2) * n,
  };
}

/**
 * Fractional grid coordinates back to longitude/latitude.
 * @param {number} x
 * @param {number} y
 * @param {number} [n]
 * @returns {{lon: number, lat: number}}
 */
export function unproject(x, y, n = N) {
  const lon = (x / n) * 360 - 180;
  const lat = ((2 * Math.atan(Math.exp(Math.PI * (1 - (2 * y) / n))) - Math.PI / 2) * 180) / Math.PI;
  return { lon, lat };
}

/**
 * The grid pixel that holds a longitude/latitude, clamped to the grid.
 * @param {number} lon
 * @param {number} lat
 * @param {number} [n]
 * @returns {{x: number, y: number}}
 */
export function pixelAt(lon, lat, n = N) {
  const p = project(lon, lat, n);
  return { x: clampInt(Math.floor(p.x), n), y: clampInt(Math.floor(p.y), n) };
}

function clampInt(v, n) {
  return Math.max(0, Math.min(n - 1, v));
}

function growable(Type) {
  let data = new Type(1024);
  let len = 0;
  return {
    push(v) {
      if (len === data.length) {
        const bigger = new Type(len * 2);
        bigger.set(data);
        data = bigger;
      }
      data[len++] = v;
    },
    get length() {
      return len;
    },
    trimmed() {
      return data.slice(0, len);
    },
  };
}

/**
 * Offsets of a filled disc of diameter d, centred on a pixel; d = 1 is the pixel alone.
 * The brush outline in the renderer reads the same shape.
 * @param {number} d
 * @returns {number[]} Flat [dx, dy, dx, dy, ...].
 */
export function discOffsets(d) {
  const offsets = [];
  const reach = Math.ceil(d / 2);
  const limit = (d * d) / 4;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (dx * dx + dy * dy <= limit) offsets.push(dx, dy);
    }
  }
  return offsets;
}

/**
 * Builds an empty map over a base plane.
 * @param {Uint8Array} base Read-only plane with LAND, RIVER, LAKE and COAST bits; length n*n.
 * @param {number} [n] Grid side; only tests use a size other than N.
 * @returns {object} The model.
 */
export function createModel(base, n = N) {
  const listeners = new Set();
  const undoStack = [];
  const redoStack = [];
  let entryTotal = 0;
  let nextId = 1;
  let stroke = null;

  const model = {
    n,
    base,
    name: "Untitled map",
    origin: null,
    planes: emptyPlanes(n),
    palette: [...DEFAULT_PALETTE],
    markers: [],
    designs: [],
    revision: 0,
    savedRevision: 0,
  };

  function emptyPlanes(side) {
    return Object.fromEntries(PLANE_NAMES.map((name) => [name, new Uint8Array(side * side)]));
  }

  function notify(notice) {
    for (const fn of listeners) fn(notice);
  }

  function warn(message, detail) {
    console.warn(`model: ${message}`, detail);
    return null;
  }

  function fail(message, detail) {
    warn(message, detail);
    return false;
  }

  // ---- history ----

  function pushStep(step) {
    undoStack.push(step);
    entryTotal += step.cost;
    redoStack.length = 0;
    while (undoStack.length > MAX_STEPS || (entryTotal > MAX_ENTRIES && undoStack.length > 1)) {
      entryTotal -= undoStack.shift().cost;
    }
    model.revision++;
    notify(step.notice);
  }

  function stepPixels(recorder) {
    const parts = [];
    for (const [plane, log] of recorder.logs) {
      parts.push({ plane, idx: log.idx.trimmed(), old: log.old.trimmed(), nv: log.nv });
    }
    const notice = { layer: recorder.layer, rect: recorder.rect };
    return {
      cost: recorder.count,
      notice,
      undo() {
        for (const p of parts) {
          const arr = model.planes[p.plane];
          for (let k = 0; k < p.idx.length; k++) arr[p.idx[k]] = p.old[k];
        }
      },
      redo() {
        for (const p of parts) {
          const arr = model.planes[p.plane];
          for (let k = 0; k < p.idx.length; k++) arr[p.idx[k]] = p.nv;
        }
      },
    };
  }

  function stepOf(cost, notice, undo, redo) {
    return { cost, notice, undo, redo };
  }

  // ---- pixel recording ----

  function startRecording(layer) {
    return { layer, logs: new Map(), count: 0, rect: null };
  }

  function touch(rec, x0, y0, x1, y1) {
    const r = rec.rect;
    if (!r) {
      rec.rect = { x0, y0, x1, y1 };
      return;
    }
    if (x0 < r.x0) r.x0 = x0;
    if (y0 < r.y0) r.y0 = y0;
    if (x1 > r.x1) r.x1 = x1;
    if (y1 > r.y1) r.y1 = y1;
  }

  function writePixel(rec, plane, i, value) {
    const arr = model.planes[plane];
    if (arr[i] === value) return;
    let log = rec.logs.get(plane);
    if (!log) {
      log = { idx: growable(Int32Array), old: growable(Uint8Array), nv: value };
      rec.logs.set(plane, log);
    }
    log.idx.push(i);
    log.old.push(arr[i]);
    arr[i] = value;
    rec.count++;
  }

  function finishRecording(rec) {
    if (rec.count === 0) return false;
    pushStep(stepPixels(rec));
    return true;
  }

  function writeTool(rec, tool, layer, i, colour, colour2) {
    switch (tool) {
      case "paint":
        writePixel(rec, layer === "culture" ? "culture" : "political", i, colour);
        break;
      case "claim":
        writePixel(rec, "claimA", i, colour);
        writePixel(rec, "claimB", i, colour2);
        break;
      case "fighting":
        writePixel(rec, "claimA", i, FIGHTING);
        writePixel(rec, "claimB", i, 0);
        break;
      case "border":
        writePixel(rec, "border", i, 1);
        break;
      case "erase":
        if (layer === "political") {
          writePixel(rec, "political", i, 0);
          writePixel(rec, "border", i, 0);
        } else if (layer === "culture") {
          writePixel(rec, "culture", i, 0);
        } else {
          writePixel(rec, "claimA", i, 0);
          writePixel(rec, "claimB", i, 0);
        }
        break;
    }
  }

  const TOOL_LAYERS = {
    paint: ["political", "culture"],
    claim: ["conflict"],
    fighting: ["conflict"],
    border: ["political"],
    erase: LAYERS,
  };

  function isPaintable(bits) {
    return (bits & LAND) !== 0 && (bits & WATER) === 0;
  }

  function validColour(c) {
    return Number.isInteger(c) && c >= 1 && c <= model.palette.length;
  }

  function stamp(x, y) {
    const { rec, offsets, tool, layer, colour, colour2 } = stroke;
    let x0 = n;
    let y0 = n;
    let x1 = -1;
    let y1 = -1;
    for (let k = 0; k < offsets.length; k += 2) {
      const px = x + offsets[k];
      const py = y + offsets[k + 1];
      if (px < 0 || py < 0 || px >= n || py >= n) continue;
      const i = py * n + px;
      if (!isPaintable(base[i])) continue;
      writeTool(rec, tool, layer, i, colour, colour2);
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
    }
    if (x1 >= 0) touch(rec, x0, y0, x1, y1);
  }

  // Bresenham between samples so a fast drag leaves no gap.
  function line(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      stamp(x, y);
      if (x === x1 && y === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // ---- public operations ----

  Object.assign(model, {
    /**
     * Subscribes to changes. A notice is {layer, rect:{x0,y0,x1,y1}} for pixels, {markers:true} for
     * markers and designs, {palette:true} for a new colour, or {all:true} when the map is replaced.
     * @param {(notice: object) => void} fn
     * @returns {() => void} Unsubscribe function.
     */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** @returns {boolean} True when there are unsaved edits. */
    isDirty() {
      return model.revision !== model.savedRevision;
    },

    /** Marks the current revision as saved. */
    markSaved() {
      model.savedRevision = model.revision;
    },

    /** @returns {boolean} */
    canUndo() {
      return undoStack.length > 0;
    },

    /** @returns {boolean} */
    canRedo() {
      return redoStack.length > 0;
    },

    /** @returns {boolean} True when a step was undone. */
    undo() {
      const step = undoStack.pop();
      if (!step) return false;
      step.undo();
      entryTotal -= step.cost;
      redoStack.push(step);
      model.revision++;
      notify(step.notice);
      return true;
    },

    /** @returns {boolean} True when a step was redone. */
    redo() {
      const step = redoStack.pop();
      if (!step) return false;
      step.redo();
      undoStack.push(step);
      entryTotal += step.cost;
      model.revision++;
      notify(step.notice);
      return true;
    },

    /**
     * Starts one stroke (one undo step). Tools: paint, erase, claim, fighting, border.
     * @param {{tool: string, layer: string, colour?: number, colour2?: number, size?: number}} opts
     * @returns {boolean} False when the options are not valid for the tool.
     */
    beginStroke({ tool, layer, colour = 0, colour2 = 0, size = 1 }) {
      if (stroke) endStroke();
      if (!TOOL_LAYERS[tool]?.includes(layer)) return fail("tool does not apply to layer", { tool, layer });
      const needsColour = tool === "paint" || tool === "claim";
      if (needsColour && !validColour(colour)) return fail("colour not in palette", colour);
      if (tool === "claim" && !validColour(colour2)) return fail("second colour not in palette", colour2);
      const diameter = tool === "border" ? 1 : Math.max(1, Math.min(16, Math.round(size)));
      stroke = {
        tool,
        layer,
        colour,
        colour2,
        offsets: discOffsets(diameter),
        rec: startRecording(layer),
        last: null,
      };
      return true;
    },

    /**
     * Extends the open stroke to a pixel; the first call stamps in place.
     * @param {number} x
     * @param {number} y
     */
    strokeTo(x, y) {
      if (!stroke) return void warn("strokeTo without beginStroke", { x, y });
      const px = clampInt(Math.round(x), n);
      const py = clampInt(Math.round(y), n);
      if (stroke.last) line(stroke.last.x, stroke.last.y, px, py);
      else stamp(px, py);
      stroke.last = { x: px, y: py };
    },

    /** Closes the open stroke and records it as one undo step.
     * @returns {boolean} True when anything changed. */
    endStroke() {
      return endStroke();
    },

    /**
     * Four-connected flood fill over land, replacing the start pixel's value.
     * @param {string} layer
     * @param {number} x
     * @param {number} y
     * @param {number} colour Palette index written (claim A for Conflict).
     * @param {number} [colour2] Claim B colour for Conflict.
     * @returns {number} Pixels changed.
     */
    fill(layer, x, y, colour, colour2 = 0) {
      if (!LAYERS.includes(layer)) return warn("unknown layer", layer) ?? 0;
      if (!validColour(colour) || (layer === "conflict" && !validColour(colour2))) {
        return warn("fill colour not in palette", { colour, colour2 }) ?? 0;
      }
      if (x < 0 || y < 0 || x >= n || y >= n || !isPaintable(base[y * n + x])) return 0;
      const { political, culture, claimA, claimB } = model.planes;
      const plane = layer === "culture" ? culture : political;
      const valueAt =
        layer === "conflict" ? (i) => (claimA[i] << 8) | claimB[i] : (i) => plane[i];
      const target = valueAt(y * n + x);
      const replacement = layer === "conflict" ? (colour << 8) | colour2 : colour;
      if (target === replacement) return 0;

      const rec = startRecording(layer);
      const seen = new Uint8Array(n * n);
      let stack = new Int32Array(1 << 16);
      let top = 0;
      const push = (i) => {
        if (top === stack.length) {
          const bigger = new Int32Array(top * 2);
          bigger.set(stack);
          stack = bigger;
        }
        stack[top++] = i;
      };
      const start = y * n + x;
      seen[start] = 1;
      push(start);
      let x0 = x;
      let x1 = x;
      let y0 = y;
      let y1 = y;
      while (top > 0) {
        const i = stack[--top];
        const px = i % n;
        const py = (i - px) / n;
        if (!(base[i] & WATER)) {
          if (layer === "conflict") {
            writePixel(rec, "claimA", i, colour);
            writePixel(rec, "claimB", i, colour2);
          } else {
            writePixel(rec, layer === "culture" ? "culture" : "political", i, colour);
          }
          if (px < x0) x0 = px;
          if (px > x1) x1 = px;
          if (py < y0) y0 = py;
          if (py > y1) y1 = py;
        }
        if (px > 0) visit(i - 1);
        if (px < n - 1) visit(i + 1);
        if (py > 0) visit(i - n);
        if (py < n - 1) visit(i + n);
      }
      // A river is crossed without being coloured, so a fill reaches both banks.
      function visit(j) {
        if (seen[j] || !(base[j] & LAND)) return;
        if (!(base[j] & RIVER) && valueAt(j) !== target) return;
        seen[j] = 1;
        push(j);
      }
      touch(rec, x0, y0, x1, y1);
      const changed = rec.count;
      finishRecording(rec);
      return changed;
    },

    /**
     * Adds a colour to the palette (or finds it) and returns its 1-based index.
     * @param {string} hex `#rrggbb`
     * @returns {number | null} Null when the palette is full or the colour is malformed.
     */
    addColour(hex) {
      const colour = String(hex).toLowerCase();
      if (!HEX.test(colour)) return warn("bad colour", hex);
      const found = model.palette.indexOf(colour);
      if (found >= 0) return found + 1;
      if (model.palette.length >= MAX_PALETTE) return warn("palette is full", colour);
      model.palette.push(colour);
      const index = model.palette.length;
      pushStep(
        stepOf(
          1,
          { palette: true },
          () => model.palette.pop(),
          () => model.palette.push(colour),
        ),
      );
      return index;
    },

    /**
     * Adds a marker. City, flag and label always belong to Political. A city, flag or symbol may have an
     * empty name, which means it carries no name tag; a label is its text, so it must have one.
     * @param {{type: string, x: number, y: number, name: string, colour: number, glyph?: string, design?: number, layer?: string, tagDx?: number, tagDy?: number}} spec
     * @returns {object | null} The marker, or null when the spec is invalid.
     */
    addMarker(spec) {
      const marker = checkedMarker(spec);
      if (!marker) return null;
      marker.id = nextId++;
      model.markers.push(marker);
      pushStep(
        stepOf(
          1,
          { markers: true },
          () => removeFromList(marker.id),
          () => model.markers.push(marker),
        ),
      );
      return marker;
    },

    /**
     * Moves a marker to a pixel.
     * @param {number} id
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    moveMarker(id, x, y) {
      const marker = findMarker(id);
      if (!marker || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= n || y >= n) {
        return fail("cannot move marker", { id, x, y });
      }
      const from = { x: marker.x, y: marker.y };
      if (from.x === x && from.y === y) return true;
      marker.x = x;
      marker.y = y;
      pushStep(
        stepOf(
          1,
          { markers: true },
          () => Object.assign(marker, from),
          () => Object.assign(marker, { x, y }),
        ),
      );
      return true;
    },

    /**
     * Changes a marker's name, colour, glyph, flag design or name tag offset.
     * @param {number} id
     * @param {{name?: string, colour?: number, glyph?: string, design?: number, tagDx?: number, tagDy?: number}} patch
     * @returns {boolean}
     */
    editMarker(id, patch) {
      const marker = findMarker(id);
      if (!marker) return fail("no such marker", id);
      const next = checkedMarker({ ...marker, ...patch });
      if (!next) return false;
      const before = pickEditable(marker);
      const after = pickEditable(next);
      if (JSON.stringify(before) === JSON.stringify(after)) return true;
      Object.assign(marker, after);
      pushStep(
        stepOf(
          1,
          { markers: true },
          () => Object.assign(marker, before),
          () => Object.assign(marker, after),
        ),
      );
      return true;
    },

    /**
     * Removes a marker.
     * @param {number} id
     * @returns {boolean}
     */
    deleteMarker(id) {
      const index = model.markers.findIndex((m) => m.id === id);
      if (index < 0) return fail("no such marker", id);
      const [marker] = model.markers.splice(index, 1);
      pushStep(
        stepOf(
          1,
          { markers: true },
          () => model.markers.splice(index, 0, marker),
          () => removeFromList(marker.id),
        ),
      );
      return true;
    },

    /**
     * Adds a flag design (384 palette indexes, row-major, 0 = white).
     * @param {Uint8Array} cells
     * @returns {number | null} The design's index, or null when invalid or the library is full.
     */
    addDesign(cells) {
      const design = checkedDesign(cells);
      if (!design) return null;
      if (model.designs.length >= MAX_DESIGNS) return warn("flag library is full", MAX_DESIGNS);
      model.designs.push(design);
      const index = model.designs.length - 1;
      pushStep(
        stepOf(
          1,
          { markers: true },
          () => model.designs.pop(),
          () => model.designs.push(design),
        ),
      );
      return index;
    },

    /**
     * Replaces a design; every flag that uses it changes with it.
     * @param {number} index
     * @param {Uint8Array} cells
     * @returns {boolean}
     */
    updateDesign(index, cells) {
      const design = checkedDesign(cells);
      const old = model.designs[index];
      if (!design || !old) return fail("cannot update design", index);
      model.designs[index] = design;
      pushStep(
        stepOf(
          1,
          { markers: true },
          () => (model.designs[index] = old),
          () => (model.designs[index] = design),
        ),
      );
      return true;
    },

    /**
     * Replaces the whole map (Open, scenario, restore). Clears history and the dirty flag.
     * @param {{name: string, origin: string | null, palette: string[], markers: object[], designs: Uint8Array[], planes: object}} data
     */
    replace(data) {
      stroke = null;
      model.name = data.name;
      model.origin = data.origin;
      model.palette = data.palette;
      model.markers = data.markers;
      model.designs = data.designs;
      model.planes = data.planes;
      clearWater(model.planes);
      nextId = model.markers.reduce((top, m) => Math.max(top, m.id), 0) + 1;
      undoStack.length = 0;
      redoStack.length = 0;
      entryTotal = 0;
      model.revision = 0;
      model.savedRevision = 0;
      notify({ all: true });
    },

    /** @returns {object} References to the live map content, for the map file writer. */
    snapshot() {
      const { name, origin, palette, markers, designs, planes } = model;
      return { name, origin, palette, markers, designs, planes };
    },
  });

  function endStroke() {
    if (!stroke) return false;
    const changed = finishRecording(stroke.rec);
    stroke = null;
    return changed;
  }

  // Water is never painted, so a map written before that rule (or by a scenario script) is cleaned on the way in.
  function clearWater(planes) {
    const layers = PLANE_NAMES.map((name) => planes[name]);
    for (let i = 0; i < base.length; i++) {
      if (!(base[i] & WATER)) continue;
      for (const plane of layers) plane[i] = 0;
    }
  }

  function pickEditable({ name, colour, glyph, design, tagDx, tagDy }) {
    return { name, colour, glyph, design, tagDx, tagDy };
  }

  function findMarker(id) {
    return model.markers.find((m) => m.id === id);
  }

  function removeFromList(id) {
    const index = model.markers.findIndex((m) => m.id === id);
    if (index >= 0) model.markers.splice(index, 1);
  }

  function checkedMarker(spec) {
    const name = String(spec.name ?? "").trim().slice(0, MAX_NAME);
    if (!MARKER_TYPES.includes(spec.type)) return warn("unknown marker type", spec.type);
    if (!name && spec.type === "label") return warn("a label needs its text", spec);
    if (!Number.isInteger(spec.x) || !Number.isInteger(spec.y) || spec.x < 0 || spec.y < 0 || spec.x >= n || spec.y >= n) {
      return warn("marker outside the grid", spec);
    }
    if (!validColour(spec.colour)) return warn("marker colour not in palette", spec.colour);
    const isSymbol = spec.type === "symbol";
    if (isSymbol && !spec.glyph) return warn("symbol needs a glyph", spec);
    const design = spec.type === "flag" ? (spec.design ?? -1) : -1;
    if (design !== -1 && !(Number.isInteger(design) && design >= 0 && design < model.designs.length)) {
      return warn("unknown flag design", design);
    }
    const layer = isSymbol && LAYERS.includes(spec.layer) ? spec.layer : "political";
    const tagDx = spec.tagDx ?? 0;
    const tagDy = spec.tagDy ?? 0;
    if (![tagDx, tagDy].every((v) => Number.isInteger(v) && Math.abs(v) <= MAX_TAG_OFFSET)) {
      return warn("name tag offset must be a whole number of pixels within reach", { tagDx, tagDy });
    }
    return {
      id: spec.id,
      type: spec.type,
      x: spec.x,
      y: spec.y,
      name,
      colour: spec.colour,
      glyph: isSymbol ? spec.glyph : "",
      design,
      layer,
      tagDx,
      tagDy,
    };
  }

  function checkedDesign(cells) {
    if (!cells || cells.length !== FLAG_W * FLAG_H) return warn("design must have 384 cells", cells?.length);
    const design = Uint8Array.from(cells);
    if (design.some((v) => v > model.palette.length)) return warn("design colour not in palette", null);
    return design;
  }

  return model;
}
