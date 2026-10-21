// The map file byte format: gzip of magic, header length, JSON header, then five raw planes.
// Everything read from a file is validated before any of it is returned, so a bad file can never
// leave the open map half replaced.

import {
  N,
  PLANE_NAMES,
  MAX_PALETTE,
  MAX_DESIGNS,
  MAX_CRESTS,
  MAX_NAME,
  MAX_TAG_OFFSET,
  FLAG_W,
  FLAG_H,
  LEGACY_FLAG_SCALE,
  LAYERS,
  MARKER_TYPES,
} from "./model.js";
import { collectBounded, StreamLimitError } from "./streams.js";
import { normaliseCrest } from "./crestcells.js";
import { normaliseCountry } from "./countrydata.js";
import { upscaleLegacyFlag } from "./flagcells.js";

export const MAGIC = "AHMAP001";
export const SAVED_WITH = "ahm-1";
const MAGIC_BYTES = new TextEncoder().encode(MAGIC);
const PLANE_BYTES = N * N;
const DESIGN_CELLS = FLAG_W * FLAG_H;
const LEGACY_DESIGN_CELLS = DESIGN_CELLS / LEGACY_FLAG_SCALE ** 2;
const MAX_HEADER = 4 * 1024 * 1024;
const HEX = /^#[0-9a-f]{6}$/;
const DEFAULT_NAME = "Untitled map";
const LEGACY_FIGHTING = 255;

/** A file could not be read or written; the message is plain English for the person using the app. */
export class MapFileError extends Error {}

const NOT_OURS = "This file is not an AltHistoryMap file";
const DAMAGED = "This file is damaged or cut short";

/**
 * Turns a map into a gzip-compressed .ahmap Blob.
 * @param {{name: string, origin: string | null, palette: string[], markers: object[], designs: Uint8Array[], crests?: object[], countries?: object[], planes: object}} data
 *   The shape of model.snapshot().
 * @returns {Promise<Blob>}
 */
export async function encodeMap(data) {
  const header = buildHeader(data);
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, headerBytes.length, false);
  const planes = PLANE_NAMES.map((name) => {
    const plane = data.planes?.[name];
    if (!(plane instanceof Uint8Array) || plane.length !== PLANE_BYTES) {
      throw new MapFileError("This map is incomplete and cannot be saved");
    }
    return plane;
  });
  // The Blob copies its parts here, before any await, so edits made while compressing are not saved half-way.
  const raw = new Blob([MAGIC_BYTES, length, headerBytes, ...planes]);
  const gzip = raw.stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(gzip).blob();
}

function buildHeader(data) {
  const header = {
    format: 1,
    name: String(data.name ?? DEFAULT_NAME).slice(0, MAX_NAME) || DEFAULT_NAME,
    origin: data.origin ?? null,
    palette: [...data.palette],
    markers: data.markers.map((m) => ({
      id: m.id,
      type: m.type,
      x: m.x,
      y: m.y,
      name: m.name,
      colour: m.colour,
      glyph: m.glyph ?? "",
      design: m.design ?? -1,
      layer: m.layer ?? "political",
      tagDx: m.tagDx ?? 0,
      tagDy: m.tagDy ?? 0,
      capital: m.capital === true,
      colony: m.colony === true,
      nation: m.nation ?? 0,
    })),
    flags: data.designs.map((d) => Array.from(d)),
    crests: (data.crests ?? []).map((crest) => ({ ...crest })),
    countries: (data.countries ?? []).map((country) => ({ ...country })),
    savedWith: SAVED_WITH,
  };
  try {
    checkHeader(header, null);
  } catch (error) {
    if (error instanceof MapFileError) throw new MapFileError(`This map cannot be saved. ${error.message}`);
    throw error;
  }
  return header;
}

/**
 * Reads and validates a map file. Nothing is returned unless the whole file is valid.
 * @param {Blob | ArrayBuffer | Uint8Array} source The gzip bytes.
 * @param {string[]} glyphIds Every valid symbol glyph id.
 * @returns {Promise<{name: string, origin: string | null, palette: string[], markers: object[], designs: Uint8Array[], crests: object[], countries: object[], planes: object}>}
 *   Ready for model.replace(); the planes are views of one buffer.
 * @throws {MapFileError} On any problem with the file.
 */
export async function decodeMap(source, glyphIds) {
  if (!Array.isArray(glyphIds)) throw new TypeError("decodeMap needs the array of valid glyph ids");
  const blob = source instanceof Blob ? source : new Blob([source]);
  const gzipMagic = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (gzipMagic[0] !== 0x1f || gzipMagic[1] !== 0x8b) throw new MapFileError(NOT_OURS);

  let bytes;
  try {
    const inflated = blob.stream().pipeThrough(new DecompressionStream("gzip"));
    const limit = MAGIC_BYTES.length + 4 + MAX_HEADER + PLANE_NAMES.length * PLANE_BYTES;
    bytes = await collectBounded(inflated, limit, { size: MAGIC_BYTES.length, check: checkMagic });
  } catch (error) {
    if (error instanceof MapFileError) throw error;
    if (error instanceof StreamLimitError) throw new MapFileError("This file is larger than an AltHistoryMap file can be");
    throw new MapFileError(DAMAGED);
  }

  const headerAt = MAGIC_BYTES.length + 4;
  if (bytes.length < headerAt) throw new MapFileError(DAMAGED);
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset + MAGIC_BYTES.length, 4).getUint32(0, false);
  if (headerLength > MAX_HEADER || bytes.length !== headerAt + headerLength + PLANE_NAMES.length * PLANE_BYTES) {
    throw new MapFileError(DAMAGED);
  }

  let header;
  try {
    header = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(headerAt, headerAt + headerLength)));
  } catch {
    throw new MapFileError("The details at the start of this file are damaged");
  }
  const checked = checkHeader(header, new Set(glyphIds));

  const planes = {};
  let offset = headerAt + headerLength;
  for (const name of PLANE_NAMES) {
    const plane = bytes.subarray(offset, offset + PLANE_BYTES);
    if (!planeIsLegal(plane, name, checked.palette.length)) {
      throw new MapFileError(
        name === "border" ? "The borders in this file are not valid" : "A colour in this file's map is not valid",
      );
    }
    planes[name] = plane;
    offset += PLANE_BYTES;
  }
  // Older files hold claims and fighting in these two planes, which no layer draws now.
  planes.reserved.fill(0);
  for (let i = 0; i < PLANE_BYTES; i++) {
    if (planes.province[i] === LEGACY_FIGHTING) planes.province[i] = 0;
  }
  return { ...checked, planes };
}

function checkMagic(head) {
  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (head[i] !== MAGIC_BYTES[i]) throw new MapFileError(NOT_OURS);
  }
}

// A 256-entry lookup keeps the check to one array read per pixel, which matters for 84 MB.
function planeIsLegal(plane, name, paletteLength) {
  const legal = new Uint8Array(256);
  if (name === "border") {
    legal[0] = 1;
    legal[1] = 1;
  } else {
    legal.fill(1, 0, paletteLength + 1);
    if (name === "province") legal[LEGACY_FIGHTING] = 1;
  }
  for (let i = 0; i < plane.length; i++) {
    if (legal[plane[i]] === 0) return false;
  }
  return true;
}

function isInt(v) {
  return Number.isInteger(v);
}

// glyphs === null skips the glyph check (used when writing, where the glyph list is not known).
function checkHeader(h, glyphs) {
  if (!h || typeof h !== "object" || Array.isArray(h)) throw new MapFileError(NOT_OURS);
  if (h.format !== 1) throw new MapFileError("This file was made by a different version of AltHistoryMap");

  const name = h.name ?? DEFAULT_NAME;
  if (typeof name !== "string" || name.length > MAX_NAME) throw new MapFileError("The map name in this file is not valid");
  const origin = h.origin ?? null;
  if (origin !== null && (typeof origin !== "string" || origin.length > MAX_NAME)) {
    throw new MapFileError("The scenario name in this file is not valid");
  }

  const { palette } = h;
  if (!Array.isArray(palette) || palette.length > MAX_PALETTE) throw new MapFileError("The colour list in this file is not valid");
  for (const colour of palette) {
    if (typeof colour !== "string" || !HEX.test(colour)) throw new MapFileError("A colour in this file is not valid");
  }

  const flags = h.flags ?? [];
  if (!Array.isArray(flags) || flags.length > MAX_DESIGNS) throw new MapFileError("The flag designs in this file are not valid");
  const designs = flags.map((cells) => {
    const isLegacy = Array.isArray(cells) && cells.length === LEGACY_DESIGN_CELLS;
    if (!Array.isArray(cells) || (cells.length !== DESIGN_CELLS && !isLegacy)) throw new MapFileError("A flag design in this file is not valid");
    const design = new Uint8Array(cells.length);
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i];
      if (!isInt(v) || v < 0 || v > palette.length) throw new MapFileError("A flag design in this file uses a colour that is not valid");
      design[i] = v;
    }
    return isLegacy ? upscaleLegacyFlag(design) : design;
  });

  // Files saved before crests existed have no such key.
  const crestList = h.crests ?? [];
  if (!Array.isArray(crestList) || crestList.length > MAX_CRESTS) throw new MapFileError("The crests in this file are not valid");
  const crests = crestList.map((crest) => {
    const clean = normaliseCrest(crest, palette.length);
    if (!clean) throw new MapFileError("A crest in this file is not valid");
    return clean;
  });

  // Files saved before countries existed have no such key.
  const countryList = h.countries ?? [];
  if (!Array.isArray(countryList) || countryList.length > palette.length) throw new MapFileError("The countries in this file are not valid");
  const countries = countryList.map((country) => {
    const clean = normaliseCountry(country, palette.length, designs.length, crests.length);
    if (!clean) throw new MapFileError("A country in this file is not valid");
    return clean;
  });
  if (new Set(countries.map((country) => country.colour)).size !== countries.length) throw new MapFileError("A country in this file is listed twice");

  if (!Array.isArray(h.markers)) throw new MapFileError("The markers in this file are not valid");
  const seen = new Set();
  const markers = h.markers.map((m) => checkMarker(m, palette.length, designs.length, glyphs, seen));

  return { name, origin, palette: [...palette], markers, designs, crests, countries };
}

function checkMarker(m, paletteLength, designCount, glyphs, seen) {
  const bad = (what) => new MapFileError(`A marker in this file ${what}`);
  if (!m || typeof m !== "object") throw bad("is not valid");
  if (!isInt(m.id) || m.id < 1 || seen.has(m.id)) throw bad("has a missing or repeated number");
  seen.add(m.id);
  if (!MARKER_TYPES.includes(m.type)) throw bad("has an unknown type");
  if (!isInt(m.x) || !isInt(m.y) || m.x < 0 || m.y < 0 || m.x >= N || m.y >= N) throw bad("is outside the map");
  const minName = m.type === "label" ? 1 : 0;
  if (typeof m.name !== "string" || m.name.length < minName || m.name.length > MAX_NAME) throw bad("has a name that is not valid");
  const tagDx = m.tagDx ?? 0;
  const tagDy = m.tagDy ?? 0;
  if (![tagDx, tagDy].every((v) => isInt(v) && Math.abs(v) <= MAX_TAG_OFFSET)) throw bad("has a name tag that is out of place");
  if (!isInt(m.colour) || m.colour < 1 || m.colour > paletteLength) throw bad("uses a colour that is not valid");

  const isSymbol = m.type === "symbol";
  const layer = (m.layer === "conflict" ? "province" : m.layer) ?? (isSymbol ? undefined : "political");
  if (!LAYERS.includes(layer) || (!isSymbol && layer !== "political")) throw bad("is on a layer it cannot be on");

  const capital = m.capital ?? false;
  const colony = m.colony ?? false;
  if (typeof colony !== "boolean" || (colony && (m.type !== "city" || capital))) throw bad("is a colony but is not a city, or is also a capital");
  const nation = m.nation ?? 0;
  if (typeof capital !== "boolean" || (capital && m.type !== "city")) throw bad("is a capital but is not a city");
  if (!isInt(nation) || nation < 0 || nation > paletteLength) throw bad("has a nation colour that is not valid");

  let glyph = "";
  if (isSymbol) {
    if (typeof m.glyph !== "string" || (glyphs && !glyphs.has(m.glyph)) || m.glyph === "") throw bad("uses a symbol that is not known");
    glyph = m.glyph;
  }
  let design = -1;
  if (m.type === "flag") {
    design = m.design ?? -1;
    if (!isInt(design) || design < -1 || design >= designCount) throw bad("uses a flag design that is not in the file");
  }
  return { id: m.id, type: m.type, x: m.x, y: m.y, name: m.name, colour: m.colour, glyph, design, layer, tagDx, tagDy, capital, colony, nation };
}

/**
 * Returns a copy of freshly decoded scenario data named and tagged as an editable copy.
 * @param {{name: string, origin: string | null}} data
 * @param {{id: string, title: string}} scenario
 * @returns {object} New object; `data` is not changed.
 */
export function asScenarioCopy(data, scenario) {
  const suffix = " (copy)";
  const title = String(scenario.title).slice(0, MAX_NAME - suffix.length);
  return { ...data, name: `${title}${suffix}`, origin: scenario.id };
}
