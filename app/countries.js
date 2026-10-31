// Connects countries to the screen: opening the Key Facts pop-up for a colour, and turning a dropped
// crest or flag into a link on the country that owns the colour. A country is a political palette
// colour (see countrydata.js); its crest and flag are indexes into the map's lists, so a crest edited
// later shows its new look on the country.

import { countryName } from "./countrydata.js";

/**
 * @param {{
 *   facts: {open: (start: {colour: number, name: string, record: object | null, editable: boolean}) => Promise<object | null>},
 *   model: {n: number, palette: string[], countries: object[], planes: {political: Uint8Array}},
 *   editor: {editGate: () => boolean, setCountry: (colour: number, patch: object) => boolean},
 *   say: (text: string) => void
 * }} deps
 * @returns {{
 *   open: (colour: number) => Promise<void>,
 *   showAt: (pixel: {x: number, y: number, inside: boolean}) => boolean,
 *   dropOnLand: (pixel: {x: number, y: number, inside: boolean}, item: object) => void,
 *   dropOnColour: (colour: number, item: object) => void
 * }}
 */
export function createCountries({ facts, model, editor, say }) {
  const recordOf = (colour) => model.countries.find((country) => country.colour === colour) ?? null;
  const nameOf = (colour) => countryName(recordOf(colour), model.palette, colour);
  const colourAt = ({ x, y }) => model.planes.political[y * model.n + x];

  // The pop-up resolves with the edited facts, or null when the person backs out or only looked.
  async function open(colour) {
    if (!Number.isInteger(colour) || colour < 1 || colour > model.palette.length) {
      console.warn("countries: no colour", colour);
      return;
    }
    const result = await facts.open({ colour, name: nameOf(colour), record: recordOf(colour), editable: editor.editGate() });
    if (result && !editor.setCountry(colour, result)) say("The key facts could not be saved.");
  }

  function link(colour, item) {
    if (!editor.editGate()) return;
    if (item.kind === "flag" && item.design < 0) {
      say("Drag a flag design, not the plain flag, onto a country.");
      return;
    }
    const patch = item.kind === "crest" ? { crest: item.crest } : { flag: item.design };
    const what = item.kind === "crest" ? `crest ${item.crest + 1}` : `flag design ${item.design + 1}`;
    if (editor.setCountry(colour, patch)) say(`${nameOf(colour)} now has ${what}.`);
    else say("That could not be given to the country.");
  }

  return {
    open,

    /** @returns {boolean} True when painted land was under the pixel and its pop-up was opened. */
    showAt(pixel) {
      const colour = pixel.inside ? colourAt(pixel) : 0;
      if (colour === 0) return false;
      open(colour);
      return true;
    },

    /** A crest dropped on the map: the Political paint under it says which country. */
    dropOnLand(pixel, item) {
      const colour = pixel.inside ? colourAt(pixel) : 0;
      if (colour === 0) {
        say("Drop it on painted land, or on a colour, to give it to a country.");
        return;
      }
      link(colour, item);
    },

    /** A crest or flag design dropped on a colour swatch. */
    dropOnColour(colour, item) {
      link(colour, item);
    },
  };
}
