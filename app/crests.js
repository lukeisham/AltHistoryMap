// Connects the crest maker dialog to the map: adding a crest and editing one. A flag keeps its own
// copy of a crest's cells once stamped, so editing a crest here never changes a flag.

import { MAX_CRESTS } from "./model.js";
import { defaultCrest } from "./crestcells.js";
import { cleanFileName } from "./filesave.js";

// 1-based palette index of the darkest colour, so a new crest's outline shows against any field.
function darkestColour(palette) {
  const brightness = (hex) => 0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16);
  return palette.reduce((best, hex, i) => (brightness(hex) < brightness(palette[best]) ? i : best), 0) + 1;
}

/**
 * @param {{
 *   maker: {open: (start: object) => Promise<object | null>},
 *   model: {name: string, palette: string[], crests: object[]},
 *   state: {get: () => object, set: (patch: object) => void},
 *   editor: {editGate: () => boolean, addCrest: Function, updateCrest: Function},
 *   say: (text: string) => void
 * }} deps
 * @returns {{create: () => Promise<void>, edit: (index: number) => Promise<void>}}
 */
export function createCrests({ maker, model, state, editor, say }) {
  const fileNameFor = (index) => `${cleanFileName(model.name)}-crest${index === null ? "" : `-${index + 1}`}.png`;

  return {
    async create() {
      if (!editor.editGate()) return;
      if (model.crests.length >= MAX_CRESTS) {
        say(`The crest list is full: a map holds up to ${MAX_CRESTS} crests.`);
        return;
      }
      const { colour, colour2 } = state.get();
      const crest = await maker.open({ crest: { ...defaultCrest(colour, colour2), outline: darkestColour(model.palette) }, editing: false, fileName: fileNameFor(null) });
      if (!crest) return;
      const index = editor.addCrest(crest);
      if (index === null) say("The crest could not be added.");
      else state.set({ crest: index });
    },

    async edit(index) {
      if (!editor.editGate()) return;
      const start = model.crests[index];
      if (!start) {
        console.warn("crests: no crest at", index);
        return;
      }
      const crest = await maker.open({ crest: start, editing: true, fileName: fileNameFor(index) });
      if (crest && !editor.updateCrest(index, crest)) say("The changes to the crest could not be saved.");
    },
  };
}
