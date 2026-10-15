import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { N } from "../app/model.js";
import { loadBasemap, loadScenarioIndex, loadScenarioBlob, withState } from "../app/api.js";

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const body = routes[url];
    if (body === undefined) return { ok: false, status: 404 };
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
      json: async () => JSON.parse(Buffer.from(body).toString()),
      blob: async () => new Blob([body]),
    };
  };
  fn.calls = calls;
  return fn;
}

function withFetch(routes, body) {
  const original = globalThis.fetch;
  globalThis.fetch = fakeFetch(routes);
  return Promise.resolve(body(globalThis.fetch)).finally(() => {
    globalThis.fetch = original;
  });
}

function basemapFile(magic, pixels) {
  return new Uint8Array(Buffer.concat([Buffer.from(magic), deflateSync(pixels)]));
}

test("loadBasemap reads AHBASE01 plus zlib bytes into N*N pixels", async () => {
  const pixels = new Uint8Array(N * N);
  pixels[5] = 1;
  pixels[N * N - 1] = 9;
  const got = await withFetch({ "data/basemap.bin": basemapFile("AHBASE01", pixels) }, () => loadBasemap());
  assert.equal(got.length, N * N);
  assert.equal(got[5], 1);
  assert.equal(got[N * N - 1], 9);
});

test("loadBasemap rejects a bad magic, a short map and a missing file", async () => {
  const pixels = new Uint8Array(N * N);
  await withFetch({ a: basemapFile("AHBASE99", pixels) }, () => assert.rejects(loadBasemap("a"), /not the right kind/));
  await withFetch({ b: basemapFile("AHBASE01", new Uint8Array(100)) }, () => assert.rejects(loadBasemap("b"), /cut short/));
  await withFetch({ c: basemapFile("AHBASE01", new Uint8Array(N * N + 1)) }, () => assert.rejects(loadBasemap("c"), /larger than expected/));
  await withFetch({ d: new Uint8Array([65, 72, 66, 65, 83, 69, 48, 49, 1, 2, 3]) }, () => assert.rejects(loadBasemap("d"), /damaged/));
  await withFetch({}, () => assert.rejects(loadBasemap("missing"), /404/));
});

test("loadScenarioIndex keeps valid entries and warns about the rest", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const index = Buffer.from(JSON.stringify([{ id: "rome-117", title: "Rome", year: 117, note: "n" }, { id: "Bad Id", title: "x" }]));
  const list = await withFetch({ "data/scenarios/index.json": new Uint8Array(index) }, () => loadScenarioIndex());
  assert.deepEqual(list, [{ id: "rome-117", title: "Rome", year: 117, note: "n" }]);
  assert.equal(warn.mock.callCount(), 1);
});

test("loadScenarioBlob fetches by id and rejects a bad id before any request", async () => {
  await withFetch({ "data/scenarios/rome-117.ahmap": new Uint8Array([1, 2, 3]) }, async (fetchFn) => {
    const blob = await loadScenarioBlob("rome-117");
    assert.equal(blob.size, 3);
    for (const bad of ["../secret", "Rome", "a/b", "", "x.ahmap", 5]) {
      await assert.rejects(loadScenarioBlob(bad), /not valid/);
    }
    assert.equal(fetchFn.calls.length, 1);
  });
});

test("withState reports loading then ready, or loading then error", async () => {
  const seen = [];
  assert.equal(await withState(Promise.resolve(7), (s, e) => seen.push([s, e])), 7);
  assert.deepEqual(seen, [["loading", undefined], ["ready", undefined]]);
  const failure = new Error("boom");
  const states = [];
  await assert.rejects(withState(Promise.reject(failure), (s, e) => states.push([s, e])), /boom/);
  assert.deepEqual(states, [["loading", undefined], ["error", failure]]);
});

test("a network failure becomes a plain message", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  try {
    await assert.rejects(loadScenarioBlob("rome-117"), /Could not load the scenario/);
  } finally {
    globalThis.fetch = original;
  }
});
