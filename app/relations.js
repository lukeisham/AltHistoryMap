// Right-click on painted land chooses how that colour answers to the colour holding the nearest
// capital: Client State, Dominion, Colony, or None. stage.js calls menuAt on a right-button click;
// the choice is stored as the country's `relation` and `overlord` (countrydata.js) through
// editor.setCountry, and layerimage.js shades the colour by the relation. relationmenu.js draws the
// menu. A colour that touches the capital's colour is the home country's own land, so it is refused.

import { RELATIONS, countryName, relationLoops } from "./countrydata.js";
import { termFor } from "./terms.js";

const NONE = { id: "none", label: "None" };

/**
 * The capital nearest a grid pixel, ignoring capitals that stand for `except` or for no colour.
 * @param {{capital?: boolean, nation?: number, x: number, y: number}[]} markers
 * @param {number} x grid pixel
 * @param {number} y grid pixel
 * @param {number} except palette index that cannot be the answer
 * @returns {number} the palette index the nearest capital stands for, or 0 when there is none
 */
export function nearestCapitalColour(markers, x, y, except) {
  let best = 0;
  let bestDistance = Infinity;
  for (const marker of markers) {
    if (!marker.capital || !marker.nation || marker.nation === except) continue;
    const distance = (marker.x - x) ** 2 + (marker.y - y) ** 2;
    if (distance < bestDistance) {
      best = marker.nation;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * @param {Uint8Array} political n * n palette indexes
 * @param {number} n side of the plane
 * @param {number} a palette index
 * @param {number} b palette index
 * @returns {boolean} True when a pixel of `a` shares an edge with a pixel of `b`.
 */
export function coloursTouch(political, n, a, b) {
  const meets = (p, q) => (p === a && q === b) || (p === b && q === a);
  for (let y = 0, i = 0; y < n; y++) {
    for (let x = 0; x < n; x++, i++) {
      const here = political[i];
      if (here !== a && here !== b) continue;
      if (x + 1 < n && meets(here, political[i + 1])) return true;
      if (y + 1 < n && meets(here, political[i + n])) return true;
    }
  }
  return false;
}

/**
 * @param {{
 *   model: {n: number, palette: string[], countries: object[], markers: object[], planes: {political: Uint8Array}},
 *   editor: {editGate: () => boolean, setCountry: (colour: number, patch: object) => boolean},
 *   menu: {choose: (request: {x: number, y: number, title: string, options: object[]}) => Promise<string | null>},
 *   say: (text: string) => void
 * }} deps
 * @returns {{menuAt: (pixel: {x: number, y: number, inside: boolean}, at: {x: number, y: number}) => Promise<boolean>}}
 */
export function createRelations({ model, editor, menu, say }) {
  const recordOf = (colour) => model.countries.find((country) => country.colour === colour) ?? null;
  const nameOf = (colour) => countryName(recordOf(colour), model.palette, colour);

  // Why this colour cannot take a relationship now, or null when it can.
  function refusal(colour, overlord) {
    if (!overlord) return "Make a city a capital first: a country answers to the colour holding the nearest capital.";
    if (coloursTouch(model.planes.political, model.n, colour, overlord)) {
      return `${nameOf(colour)} touches ${nameOf(overlord)}, the colour holding the nearest capital, so it cannot be its client state, dominion or colony.`;
    }
    if (relationLoops(model.countries, colour, overlord)) return `${nameOf(overlord)} already answers to ${nameOf(colour)}, so that would make a loop.`;
    return null;
  }

  return {
    /**
     * @param {{x: number, y: number, inside: boolean}} pixel grid pixel that was right-clicked
     * @param {{x: number, y: number}} at stage-local screen point for the menu
     * @returns {Promise<boolean>} True when the click was on painted land and was handled.
     */
    async menuAt(pixel, at) {
      const colour = pixel.inside ? model.planes.political[pixel.y * model.n + pixel.x] : 0;
      if (colour === 0) return false;
      if (!editor.editGate()) {
        say("Switch to Edit mode to set a relationship.");
        return true;
      }
      const overlord = nearestCapitalColour(model.markers, pixel.x, pixel.y, colour);
      const current = recordOf(colour)?.relation ?? "";
      const reason = refusal(colour, overlord);
      if (reason && !current) {
        say(reason);
        return true;
      }
      const kinds = reason ? [] : RELATIONS;
      const options = [...kinds, ...(current ? [NONE] : [])].map(({ id, label }) => ({ id, label, hint: termFor(`relation:${id}`)?.text ?? "", current: id === current }));
      const title = reason ? nameOf(colour) : `${nameOf(colour)} answers to ${nameOf(overlord)}`;
      const choice = await menu.choose({ x: at.x, y: at.y, title, options });
      if (choice === null) return true;
      const patch = choice === "none" ? { relation: "", overlord: 0 } : { relation: choice, overlord };
      say(editor.setCountry(colour, patch) ? "" : "That relationship could not be saved.");
      return true;
    },
  };
}
