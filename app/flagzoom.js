// The enlarged flag that follows the pointer over a placed flag or a Flags-list thumbnail.
// stage.js shows it for a flag marker under the pointer and flagstrip.js for a thumbnail; both hide
// it again when the pointer leaves, a drag starts or the view moves.
// Link app/flagzoom.css beside it.

import { FLAG_W, FLAG_H } from "./model.js";
import { drawCells } from "./pngexport.js";

/** CSS pixels per design cell in the enlarged picture: 24 cells wide makes it 192 px. */
export const ZOOM_CELL = 8;
const GAP = 16;

/**
 * @param {{box: HTMLElement, canvas: HTMLCanvasElement, getPalette: () => string[]}} parts `box` holds
 *   `canvas`; getPalette returns the map's hex colours.
 * @returns {{
 *   show: (flag: {cells: Uint8Array | null, colour: string, x: number, y: number}) => void,
 *   hide: () => void
 * }} `show` draws the design (or, with cells null, a plain pennant in `colour`) beside the client point (x, y).
 */
export function createFlagZoom({ box, canvas, getPalette }) {
  const doc = box.ownerDocument;
  const scale = doc.defaultView?.devicePixelRatio || 1;
  canvas.width = Math.round(FLAG_W * ZOOM_CELL * scale);
  canvas.height = Math.round(FLAG_H * ZOOM_CELL * scale);
  canvas.style.width = `${FLAG_W * ZOOM_CELL}px`;
  canvas.style.height = `${FLAG_H * ZOOM_CELL}px`;

  function paint(cells, colour) {
    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const w = FLAG_W * ZOOM_CELL;
    const h = FLAG_H * ZOOM_CELL;
    ctx.clearRect(0, 0, w, h);
    if (cells) {
      const white = doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue("--flag-white").trim();
      drawCells(ctx, cells, FLAG_W, getPalette(), white, ZOOM_CELL);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
  }

  return {
    show({ cells, colour, x, y }) {
      paint(cells, colour);
      box.hidden = false;
      const view = doc.defaultView;
      const w = FLAG_W * ZOOM_CELL;
      const h = FLAG_H * ZOOM_CELL;
      // Flips to the other side of the pointer when it would run off the window.
      const left = x + GAP + w > view.innerWidth ? x - GAP - w : x + GAP;
      const top = y + GAP + h > view.innerHeight ? y - GAP - h : y + GAP;
      box.style.setProperty("--at-x", String(Math.max(0, left)));
      box.style.setProperty("--at-y", String(Math.max(0, top)));
    },

    hide() {
      box.hidden = true;
    },
  };
}
