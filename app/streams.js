// Shared by mapfile.js and api.js: reads a decompressing stream into one buffer without ever
// holding more than a stated limit, so a hostile "zip bomb" cannot exhaust memory.

export class StreamLimitError extends Error {}

/**
 * Reads a stream to the end into one Uint8Array.
 * @param {ReadableStream<Uint8Array>} readable
 * @param {number} limit Largest total size allowed; the stream is cancelled beyond it.
 * @param {{size: number, check: (head: Uint8Array) => void}} [prefix] Called once with the first
 *   `size` bytes as soon as they arrive, so a wrong file type fails before the rest is inflated.
 * @returns {Promise<Uint8Array>}
 */
export async function collectBounded(readable, limit, prefix) {
  const reader = readable.getReader();
  const chunks = [];
  let total = 0;
  let checked = !prefix;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) throw new StreamLimitError("stream is larger than the limit");
      chunks.push(value);
      if (!checked && total >= prefix.size) {
        checked = true;
        prefix.check(join(chunks, Math.min(total, prefix.size)));
      }
    }
  } catch (error) {
    reader.cancel().catch(() => {});
    throw error;
  }
  if (!checked) prefix.check(join(chunks, total));
  return join(chunks, total);
}

function join(chunks, length) {
  if (chunks.length === 1 && chunks[0].length === length) return chunks[0];
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    if (at >= length) break;
    const part = chunk.length > length - at ? chunk.subarray(0, length - at) : chunk;
    out.set(part, at);
    at += part.length;
  }
  return out;
}
