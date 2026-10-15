// The only file that calls fetch(): the base map and the bundled scenarios.

import { N } from "./model.js";
import { collectBounded, StreamLimitError } from "./streams.js";

const BASEMAP_MAGIC = "AHBASE01";
const SCENARIO_ID = /^[a-z0-9-]+$/;

/**
 * Runs a promise while reporting loading, ready or error to a callback.
 * @template T
 * @param {Promise<T>} promise
 * @param {(state: "loading" | "ready" | "error", error?: Error) => void} setState
 * @returns {Promise<T>} The same result; a failure is reported then thrown again.
 */
export async function withState(promise, setState) {
  setState("loading");
  try {
    const value = await promise;
    setState("ready");
    return value;
  } catch (error) {
    setState("error", error);
    throw error;
  }
}

async function get(url, what) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Could not load ${what}. Check the connection and try again.`, { cause: error });
  }
  if (!response.ok) throw new Error(`Could not load ${what} (the server said ${response.status}).`);
  return response;
}

/**
 * Loads the base map: one byte per pixel with the LAND, RIVER, LAKE and COAST bits.
 * @param {string} [url]
 * @returns {Promise<Uint8Array>} Exactly N*N bytes.
 */
export async function loadBasemap(url = "data/basemap.bin") {
  const bytes = new Uint8Array(await (await get(url, "the base map")).arrayBuffer());
  const magic = new TextEncoder().encode(BASEMAP_MAGIC);
  if (bytes.length < magic.length || magic.some((b, i) => bytes[i] !== b)) {
    throw new Error("The base map file is not the right kind of file.");
  }
  let pixels;
  try {
    const inflated = new Blob([bytes.subarray(magic.length)]).stream().pipeThrough(new DecompressionStream("deflate"));
    pixels = await collectBounded(inflated, N * N);
  } catch (error) {
    if (error instanceof StreamLimitError) throw new Error("The base map file is larger than expected.");
    throw new Error("The base map file is damaged.", { cause: error });
  }
  if (pixels.length !== N * N) throw new Error("The base map file is damaged or cut short.");
  return pixels;
}

/**
 * Loads the list of bundled scenarios.
 * @param {string} [url]
 * @returns {Promise<{id: string, title: string, year: number | string, note: string}[]>}
 */
export async function loadScenarioIndex(url = "data/scenarios/index.json") {
  const list = await (await get(url, "the scenario list")).json();
  if (!Array.isArray(list)) throw new Error("The scenario list is not valid.");
  const valid = [];
  for (const entry of list) {
    if (typeof entry?.id === "string" && SCENARIO_ID.test(entry.id) && typeof entry.title === "string") {
      valid.push({ id: entry.id, title: entry.title, year: entry.year, note: String(entry.note ?? "") });
    } else {
      console.warn("scenario list entry skipped", entry);
    }
  }
  return valid;
}

/**
 * Loads one bundled scenario file.
 * @param {string} id Lower-case letters, digits and hyphens only.
 * @returns {Promise<Blob>} The .ahmap file, for decodeMap.
 */
export async function loadScenarioBlob(id) {
  if (typeof id !== "string" || !SCENARIO_ID.test(id)) throw new Error("That scenario name is not valid.");
  return (await get(`data/scenarios/${id}.ahmap`, "the scenario")).blob();
}
