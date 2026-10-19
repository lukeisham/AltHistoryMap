// A flag design shrunk to a 24 x 16 grid of blocks, each the average colour of the design cells it
// covers. markers.js draws a placed flag from these and flagstrip.js draws its thumbnails, so a flag is
// 384 rectangles however fine its design is; flagzoom.js and the designer draw the full cells.

import { FLAG_W, FLAG_H, LEGACY_FLAG_SCALE } from "./model.js";
import { parseColour, unpackColour } from "./layerimage.js";

export const BLOCK_COLS = FLAG_W / LEGACY_FLAG_SCALE;
export const BLOCK_ROWS = FLAG_H / LEGACY_FLAG_SCALE;

// Designs are replaced, never edited in place, so the array itself identifies its blocks. The key
// notices a palette or theme change that leaves the same design looking different.
const cache = new WeakMap();

function channelsOf(index, palette, white) {
  const css = index === 0 ? white : palette[index - 1];
  const packed = parseColour(css);
  if (packed === null) {
    console.warn(`flagblocks: no usable colour for palette index ${index}; using black`);
    return { r: 0, g: 0, b: 0 };
  }
  return unpackColour(packed);
}

/**
 * @param {Uint8Array} design FLAG_W * FLAG_H palette indexes
 * @param {string[]} palette hex colours; design value i is palette[i - 1]
 * @param {string} white the colour of design value 0
 * @returns {string[]} BLOCK_COLS * BLOCK_ROWS CSS colours, row-major
 */
export function flagBlocks(design, palette, white) {
  const key = `${white}|${palette.join(",")}`;
  const hit = cache.get(design);
  if (hit?.key === key) return hit.blocks;

  const table = [0, ...palette.map((_, i) => i + 1)].map((index) => channelsOf(index, palette, white));
  const area = LEGACY_FLAG_SCALE ** 2;
  const blocks = [];
  for (let by = 0; by < BLOCK_ROWS; by++) {
    for (let bx = 0; bx < BLOCK_COLS; bx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = by * LEGACY_FLAG_SCALE; y < (by + 1) * LEGACY_FLAG_SCALE; y++) {
        for (let x = bx * LEGACY_FLAG_SCALE; x < (bx + 1) * LEGACY_FLAG_SCALE; x++) {
          const channels = table[design[y * FLAG_W + x]] ?? table[0];
          r += channels.r;
          g += channels.g;
          b += channels.b;
        }
      }
      blocks.push(`rgb(${Math.round(r / area)},${Math.round(g / area)},${Math.round(b / area)})`);
    }
  }
  cache.set(design, { key, blocks });
  return blocks;
}
