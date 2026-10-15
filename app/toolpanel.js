// The tool list and the brush size. The tools offered follow the layer on screen.

import { TOOLS_BY_LAYER, TOOL_LABELS, TOOL_HINTS, BRUSH_TOOLS, BRUSH_MIN, BRUSH_MAX, NAME_TAG_TOOLS, keyForTool } from "./tools.js";

/**
 * @param {{
 *   toolsEl: HTMLElement,
 *   brushInput: HTMLInputElement,
 *   brushValue: HTMLElement,
 *   flagsSection: HTMLElement,
 *   nameTagRow: HTMLElement,
 *   nameTagInput: HTMLInputElement,
 *   state: {get: () => object, set: (patch: object) => void, subscribe: Function}
 * }} deps `flagsSection` is shown only on the layer that has the Flag tool; `nameTagRow` only for a tool
 *   whose marker may go without a name tag.
 */
export function bindToolPanel({ toolsEl, brushInput, brushValue, flagsSection, nameTagRow, nameTagInput, state }) {
  const doc = toolsEl.ownerDocument;
  brushInput.min = String(BRUSH_MIN);
  brushInput.max = String(BRUSH_MAX);

  function buildTools(layer) {
    const buttons = TOOLS_BY_LAYER[layer].map((tool) => {
      const key = keyForTool(tool);
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "tool-button";
      button.dataset.tool = tool;
      button.title = TOOL_HINTS[tool];
      button.setAttribute("aria-label", TOOL_LABELS[tool]);
      if (key) button.setAttribute("aria-keyshortcuts", key);
      const name = doc.createElement("span");
      name.textContent = TOOL_LABELS[tool];
      button.append(name);
      if (key) {
        const hint = doc.createElement("kbd");
        hint.className = "tool-key";
        hint.textContent = key;
        button.append(hint);
      }
      button.addEventListener("click", () => state.set({ tool }));
      return button;
    });
    toolsEl.replaceChildren(...buttons);
  }

  function syncPressed() {
    const { tool } = state.get();
    for (const button of toolsEl.children) button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
  }

  function syncBrush() {
    const { brush, tool } = state.get();
    brushInput.value = String(brush);
    brushValue.textContent = `${brush} px`;
    brushInput.disabled = !BRUSH_TOOLS.includes(tool);
  }

  function syncNameTag() {
    const { tool, nameTag } = state.get();
    nameTagRow.hidden = !NAME_TAG_TOOLS.includes(tool);
    nameTagInput.checked = nameTag;
  }

  brushInput.addEventListener("input", () => state.set({ brush: Number(brushInput.value) }));
  nameTagInput.addEventListener("change", () => state.set({ nameTag: nameTagInput.checked }));
  state.subscribe((value, changed) => {
    if (changed.includes("layer")) {
      buildTools(value.layer);
      flagsSection.hidden = !TOOLS_BY_LAYER[value.layer].includes("flag");
    }
    if (changed.includes("layer") || changed.includes("tool")) syncPressed();
    if (changed.includes("brush") || changed.includes("tool")) syncBrush();
    if (changed.includes("nameTag") || changed.includes("tool")) syncNameTag();
  });

  const { layer } = state.get();
  buildTools(layer);
  flagsSection.hidden = !TOOLS_BY_LAYER[layer].includes("flag");
  syncPressed();
  syncBrush();
  syncNameTag();
}
