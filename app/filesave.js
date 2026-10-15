// Browser file hand-off: downloads a map as a .ahmap file and opens a file picker for one.
// A page cannot overwrite a file, so every Save is a new download.

import { encodeMap, decodeMap } from "./mapfile.js";

export const EXTENSION = ".ahmap";
const MAX_FILE_NAME = 60;
const REVOKE_DELAY_MS = 1000;

/**
 * Keeps letters, digits, spaces, hyphens and underscores, at most 60 characters.
 * @param {string} name
 * @returns {string} "map" when nothing is left.
 */
export function cleanFileName(name) {
  const kept = String(name ?? "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .slice(0, MAX_FILE_NAME)
    .trim();
  return kept || "map";
}

/**
 * Encodes a map and starts a browser download of it.
 * @param {object} data The shape of model.snapshot().
 * @param {string} name The wanted file name, without extension.
 * @returns {Promise<string>} The clean name, without extension.
 */
export async function downloadMap(data, name) {
  const clean = cleanFileName(name);
  downloadBlob(await encodeMap(data), `${clean}${EXTENSION}`);
  return clean;
}

/**
 * Starts a browser download of a blob under the given file name.
 * @param {Blob} blob
 * @param {string} fileName
 */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari starts the download after the click returns, so the URL must outlive it briefly.
  const timer = setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  timer.unref?.();
}

/**
 * Opens the browser's file picker for a map file.
 * @returns {Promise<File | null>} Null when the person cancels.
 */
export function pickMapFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = EXTENSION;
    input.hidden = true;
    const done = (file) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => done(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => done(null));
    document.body.append(input);
    input.click();
  });
}

/**
 * Reads and validates a picked map file.
 * @param {File | Blob} file
 * @param {string[]} glyphIds Every valid symbol glyph id.
 * @returns {Promise<object>} See decodeMap.
 */
export function readMapFile(file, glyphIds) {
  return decodeMap(file, glyphIds);
}
