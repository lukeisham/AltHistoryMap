// Connects the flag designer dialog to the map: adding a design, editing one, and the entry point
// for a double-clicked flag. Editing a design changes every flag that uses it, because markers
// store only the design's index.

import { MAX_DESIGNS } from "./model.js";

/**
 * @param {{
 *   designer: {open: (design: object) => Promise<Uint8Array | null>},
 *   model: {designs: Uint8Array[]},
 *   state: {get: () => object, set: (patch: object) => void},
 *   editor: {editGate: () => boolean, addDesign: Function, updateDesign: Function},
 *   say: (text: string) => void
 * }} deps
 * @returns {{create: () => Promise<void>, edit: (index: number) => Promise<void>, editFlag: (marker: {design: number}) => Promise<void>}}
 */
export function createDesigns({ designer, model, state, editor, say }) {
  async function create() {
    if (!editor.editGate()) return;
    if (model.designs.length >= MAX_DESIGNS) {
      say(`The flag list is full: a map holds up to ${MAX_DESIGNS} designs.`);
      return;
    }
    const { colour, colour2 } = state.get();
    const cells = await designer.open({ cells: null, colour, colour2, editing: false });
    if (!cells) return;
    const index = editor.addDesign(cells);
    if (index === null) say("The flag design could not be added.");
    else state.set({ design: index, tool: "flag" });
  }

  async function edit(index) {
    if (!editor.editGate()) return;
    const design = model.designs[index];
    if (!design) {
      console.warn("designs: no flag design at", index);
      return;
    }
    const { colour, colour2 } = state.get();
    const cells = await designer.open({ cells: design, colour, colour2, editing: true });
    if (cells && !editor.updateDesign(index, cells)) say("The changes to the flag design could not be saved.");
  }

  return {
    create,
    edit,
    async editFlag(marker) {
      if (marker.design < 0) {
        say("This flag has no design yet. Add or choose a design in the Flags list, then place a new flag.");
        return;
      }
      await edit(marker.design);
    },
  };
}
