// Draws a grid of palette cells (a flag design or a crest) and turns it into a PNG. flagdesigner.js
// and crestmaker.js call cellsToPng for their Save PNG buttons; flagzoom.js calls drawCells for the
// enlarged hover picture. A flag cell of 0 is white; TRANSPARENT (a crest's surround) is left unpainted.

import { TRANSPARENT } from "./crestcells.js";

/** Pixels per cell in a saved flag: 120 cells wide makes a 960 pixel picture. */
export const FLAG_PNG_CELL = 8;
/** Pixels per cell in a saved crest: 58 cells wide makes a 928 pixel picture. */
export const CREST_PNG_CELL = 16;

/**
 * Paints a cell grid onto a canvas context, one filled square per cell.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Uint8Array} cells row-major palette indexes
 * @param {number} cols cells per row
 * @param {string[]} palette hex colours; cell value i is palette[i - 1]
 * @param {string} white the colour of cell value 0
 * @param {number} cell size of one cell in canvas pixels
 */
export function drawCells(ctx, cells, cols, palette, white, cell) {
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v === TRANSPARENT) continue;
    let colour = white;
    if (v !== 0) {
      colour = palette[v - 1];
      if (colour === undefined) {
        console.warn(`pngexport: palette has no colour ${v}; drawing it white`);
        colour = white;
      }
    }
    ctx.fillStyle = colour;
    ctx.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
  }
}

/**
 * Renders a cell grid at a whole number of pixels per cell and encodes it as a PNG.
 * @param {{cells: Uint8Array, cols: number, palette: string[], white: string, cell: number, doc?: Document}} options
 * @returns {Promise<Blob>}
 */
export function cellsToPng({ cells, cols, palette, white, cell, doc = document }) {
  const canvas = doc.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = (cells.length / cols) * cell;
  drawCells(canvas.getContext("2d"), cells, cols, palette, white, cell);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("pngexport: PNG encoding returned nothing"))), "image/png");
  });
}
