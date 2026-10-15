// The footer's scenario menu, built from the bundled scenario list.

import { loadScenarioIndex } from "./api.js";

const START_ID = "blank-world";

/**
 * A short year label for a scenario button, or an empty string when the title already holds it.
 * @param {{title: string, year: number | string}} entry
 * @returns {string}
 */
export function yearLabel({ title, year }) {
  const text = typeof year === "number" ? (year < 0 ? `${-year} BC` : `AD ${year}`) : String(year ?? "");
  if (!text || title.includes(text) || title.includes(String(year))) return "";
  return text;
}

/**
 * Puts the Blank world first, then the empires in file order.
 * @param {{id: string}[]} list
 * @returns {object[]}
 */
export function orderScenarios(list) {
  return [...list.filter((s) => s.id === START_ID), ...list.filter((s) => s.id !== START_ID)];
}

/**
 * Fills the scenario menu. Choosing an entry opens it and puts the menu back to its prompt, so the same
 * scenario can be chosen again.
 * @param {{container: HTMLSelectElement, actions: {openScenario: (entry: object) => void}, say: (text: string) => void}} deps
 * @returns {Promise<object[]>} The scenario list, empty when it could not be loaded.
 */
export async function bindScenarios({ container, actions, say }) {
  const doc = container.ownerDocument;
  const option = (text, value = "") => {
    const node = doc.createElement("option");
    node.value = value;
    node.textContent = text;
    return node;
  };
  let list;
  try {
    list = orderScenarios(await loadScenarioIndex());
  } catch (error) {
    console.warn("scenarios: list not loaded", error);
    say(error.message);
    container.replaceChildren(option("No scenarios available"));
    container.disabled = true;
    return [];
  }
  const prompt = option("Choose a scenario");
  const entries = list.map((entry) => {
    const year = yearLabel(entry);
    return option(year ? `${entry.title} (${year})` : entry.title, entry.id);
  });
  container.replaceChildren(prompt, ...entries);
  container.value = "";
  container.addEventListener("change", () => {
    const entry = list.find((candidate) => candidate.id === container.value);
    container.value = "";
    if (entry) actions.openScenario(entry);
  });
  return list;
}
