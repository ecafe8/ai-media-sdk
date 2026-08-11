import { describe, expect, test } from "bun:test";

import {
  type CachedMediaEntry,
  clearMedia,
  fileToBase64,
  getCacheStorageState,
  getMediaFile,
  hashBytes,
  listMedia,
  MAX_CACHE_ENTRIES,
  MAX_CACHE_TOTAL_BYTES,
  removeMedia,
  selectEvictions,
  storeMedia,
} from "@/lib/media-cache";

function makeEntry(
  hash: string,
  size: number,
  lastUsedAt: number
): CachedMediaEntry {
  return {
    hash,
    opfsName: hash,
    schemaVersion: 1,
    name: `${hash}.png`,
    mime: "image/png",
    size,
    addedAt: lastUsedAt,
    lastUsedAt,
  };
}

describe("selectEvictions (pure LRU)", () => {
  test("evicts nothing within caps", () => {
    const entries = [makeEntry("a", 10, 1), makeEntry("b", 10, 2)];
    expect(selectEvictions(entries, 10, 10, 1000)).toEqual([]);
  });

  test("evicts least recently used when entry cap exceeded", () => {
    const entries = [
      makeEntry("oldest", 10, 1),
      makeEntry("middle", 10, 2),
      makeEntry("newest", 10, 3),
    ];
    const evicted = selectEvictions(entries, 10, 3, 1000);
    expect(evicted).toEqual(["oldest"]);
  });

  test("evicts until total bytes fit", () => {
    const entries = [
      makeEntry("a", 300, 1),
      makeEntry("b", 300, 2),
      makeEntry("c", 300, 3),
    ];
    const evicted = selectEvictions(entries, 300, 100, 900);
    // 3 existing (900) + incoming 300 = 1200 > 900 → evict oldest until ≤900.
    expect(evicted).toEqual(["a"]);
  });

  test("evicts multiple entries when needed", () => {
    const entries = [
      makeEntry("a", 400, 1),
      makeEntry("b", 400, 2),
      makeEntry("c", 400, 3),
    ];
    const evicted = selectEvictions(entries, 400, 100, 800);
    expect(evicted).toEqual(["a", "b"]);
  });

  test("caps constants match the documented limits", () => {
    expect(MAX_CACHE_ENTRIES).toBe(100);
    expect(MAX_CACHE_TOTAL_BYTES).toBe(500 * 1024 * 1024);
  });
});

describe("hashBytes", () => {
  test("is deterministic for identical content", async () => {
    const a = await hashBytes(new TextEncoder().encode("hello"));
    const b = await hashBytes(new TextEncoder().encode("hello"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test("differs for different content", async () => {
    const a = await hashBytes(new TextEncoder().encode("hello"));
    const b = await hashBytes(new TextEncoder().encode("world"));
    expect(a).not.toBe(b);
  });
});

describe("media cache fail-soft (no OPFS/IndexedDB in bun)", () => {
  test("degrades to session storage", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "a.png", {
      type: "image/png",
    });
    await storeMedia(file);
    expect(getCacheStorageState()).toBe("session");
  });

  test("stores, lists, retrieves and removes entries in memory", async () => {
    await clearMedia();
    const file = new File([new Uint8Array([9, 9, 9])], "b.png", {
      type: "image/png",
    });
    const { entry, fromCache } = await storeMedia(file);
    expect(fromCache).toBe(false);
    expect(entry.mime).toBe("image/png");
    expect(entry.size).toBe(3);

    const listed = await listMedia();
    expect(listed.some((e) => e.hash === entry.hash)).toBe(true);

    const retrieved = await getMediaFile(entry.hash);
    expect(retrieved).toBeDefined();
    expect(new Uint8Array(await retrieved!.arrayBuffer())).toEqual(
      new Uint8Array([9, 9, 9])
    );

    await removeMedia(entry.hash);
    expect(await getMediaFile(entry.hash)).toBeUndefined();
  });

  test("deduplicates identical content on second store", async () => {
    await clearMedia();
    const bytes = new Uint8Array([5, 5, 5]);
    const first = await storeMedia(
      new File([bytes], "x.png", { type: "image/png" })
    );
    expect(first.fromCache).toBe(false);
    const second = await storeMedia(
      new File([bytes.slice()], "y.png", { type: "image/png" })
    );
    expect(second.fromCache).toBe(true);
    expect(second.entry.hash).toBe(first.entry.hash);
    expect((await listMedia()).length).toBe(1);
  });

  test("fileToBase64 round-trips bytes", async () => {
    const file = new File([new Uint8Array([72, 105])], "t.bin", {
      type: "application/octet-stream",
    });
    const base64 = await fileToBase64(file);
    expect(base64).toBe(btoa("Hi"));
  });
});
