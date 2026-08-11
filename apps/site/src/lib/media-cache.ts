/**
 * Local media cache for image inputs.
 *
 * File bytes live in OPFS under `<sha256>.<ext>` (raw bytes, no base64
 * inflation); IndexedDB stores only lightweight metadata driving the gallery
 * and LRU eviction. Base64 encoding happens on demand at request time.
 *
 * Fail-soft contract: when OPFS/IndexedDB is unavailable (private mode,
 * older browsers, quota), the cache degrades to an in-memory session store
 * and every public method keeps working without throwing.
 */

export interface CachedMediaEntry {
  readonly hash: string;
  readonly opfsName: string;
  readonly schemaVersion: number;
  readonly name: string;
  readonly mime: string;
  readonly size: number;
  readonly thumb?: string;
  readonly addedAt: number;
  readonly lastUsedAt: number;
}

export type CacheStorageState = "persistent" | "session";

export const MAX_CACHE_ENTRIES = 100;
export const MAX_CACHE_TOTAL_BYTES = 500 * 1024 * 1024;

const SCHEMA_VERSION = 1;
const _OPFS_DIR_NAME = "ai-media-site-cache";
const IDB_NAME = "ai-media-site-cache";
const IDB_STORE = "entries";

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
  "image/gif": ".gif",
};

interface MemoryRecord {
  readonly entry: CachedMediaEntry;
  readonly blob: Blob;
}

let storageState: CacheStorageState = "session";
let persistRequested = false;
let opfsDir: FileSystemDirectoryHandle | undefined;
let idb: IDBDatabase | undefined;
let initPromise: Promise<void> | undefined;
const memoryStore = new Map<string, MemoryRecord>();

/** Whether the cache currently persists across sessions. */
export function getCacheStorageState(): CacheStorageState {
  return storageState;
}

async function openIdb(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  try {
    return await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "hash" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(hash: string): Promise<CachedMediaEntry | undefined> {
  if (!idb) return undefined;
  try {
    const tx = idb.transaction(IDB_STORE, "readonly");
    return await idbRequest(
      tx.objectStore(IDB_STORE).get(hash) as IDBRequest<
        CachedMediaEntry | undefined
      >
    );
  } catch {
    return undefined;
  }
}

async function idbPut(entry: CachedMediaEntry): Promise<void> {
  if (!idb) return;
  try {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    await idbRequest(tx.objectStore(IDB_STORE).put(entry));
  } catch {
    // Metadata write failure is non-fatal; the bytes remain usable for the
    // current session via the in-memory mirror written alongside.
  }
}

async function idbDelete(hash: string): Promise<void> {
  if (!idb) return;
  try {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    await idbRequest(tx.objectStore(IDB_STORE).delete(hash));
  } catch {
    // ignore
  }
}

async function idbAll(): Promise<CachedMediaEntry[]> {
  if (!idb) return [];
  try {
    const tx = idb.transaction(IDB_STORE, "readonly");
    return await idbRequest(
      tx.objectStore(IDB_STORE).getAll() as IDBRequest<CachedMediaEntry[]>
    );
  } catch {
    return [];
  }
}

async function idbClear(): Promise<void> {
  if (!idb) return;
  try {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    await idbRequest(tx.objectStore(IDB_STORE).clear());
  } catch {
    // ignore
  }
}

async function opfsWrite(name: string, blob: Blob): Promise<boolean> {
  if (!opfsDir) return false;
  try {
    const fileHandle = await opfsDir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

async function opfsRead(name: string): Promise<File | undefined> {
  if (!opfsDir) return undefined;
  try {
    const fileHandle = await opfsDir.getFileHandle(name);
    return await fileHandle.getFile();
  } catch {
    return undefined;
  }
}

async function opfsDelete(name: string): Promise<void> {
  if (!opfsDir) return;
  try {
    await opfsDir.removeEntry(name);
  } catch {
    // Missing file is fine (orphan metadata cleanup races).
  }
}

async function opfsExists(name: string): Promise<boolean> {
  if (!opfsDir) return false;
  try {
    await opfsDir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize persistent storage when available. Runs once; subsequent calls
 * reuse the same promise. Performs orphan-metadata cleanup and requests
 * persistent storage (denials are tolerated).
 */
export async function initMediaCache(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.storage?.getDirectory) {
        opfsDir = await navigator.storage.getDirectory();
      }
    } catch {
      opfsDir = undefined;
    }
    idb = await openIdb();

    if (opfsDir && idb) {
      storageState = "persistent";
      if (!persistRequested && navigator.storage?.persist) {
        persistRequested = true;
        try {
          await navigator.storage.persist();
        } catch {
          // Denial only means the browser may reclaim the cache under
          // pressure; the cache still works.
        }
      }
      await cleanupOrphanEntries();
    } else {
      storageState = "session";
    }
  })();
  return initPromise;
}

async function cleanupOrphanEntries(): Promise<void> {
  const entries = await idbAll();
  for (const entry of entries) {
    if (entry.schemaVersion !== SCHEMA_VERSION) {
      await idbDelete(entry.hash);
      await opfsDelete(entry.opfsName);
      continue;
    }
    const exists = await opfsExists(entry.opfsName);
    if (!exists) await idbDelete(entry.hash);
  }
}

/** SHA-256 hex of the given bytes. */
export async function hashBytes(
  bytes: ArrayBuffer | Uint8Array
): Promise<string> {
  const buffer = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extensionFor(file: File): string {
  const fromMime = MIME_EXTENSIONS[file.type];
  if (fromMime) return fromMime;
  const dot = file.name.lastIndexOf(".");
  if (dot > 0 && dot < file.name.length - 1) {
    const ext = file.name.slice(dot).toLowerCase();
    if (/^\.[a-z0-9]{1,8}$/.test(ext)) return ext;
  }
  return "";
}

/**
 * Pure LRU eviction selection. Returns the hashes to evict so that adding
 * `incomingSize` bytes keeps the cache within both caps. Exported for
 * testing.
 */
export function selectEvictions(
  entries: readonly CachedMediaEntry[],
  incomingSize: number,
  maxEntries: number,
  maxBytes: number
): readonly string[] {
  const sorted = [...entries].sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  let totalBytes = entries.reduce((sum, e) => sum + e.size, 0) + incomingSize;
  let count = entries.length + 1;
  const evict: string[] = [];
  for (const entry of sorted) {
    if (count <= maxEntries && totalBytes <= maxBytes) break;
    evict.push(entry.hash);
    totalBytes -= entry.size;
    count -= 1;
  }
  return evict;
}

async function removeEntry(entry: CachedMediaEntry): Promise<void> {
  memoryStore.delete(entry.hash);
  await idbDelete(entry.hash);
  await opfsDelete(entry.opfsName);
}

/**
 * Store a file, deduplicating by content hash. Returns the cache entry and
 * whether it was served from an existing cache record.
 */
export async function storeMedia(
  file: File
): Promise<{ entry: CachedMediaEntry; fromCache: boolean }> {
  await initMediaCache();
  const bytes = await file.arrayBuffer();
  const hash = await hashBytes(bytes);

  const existing = await findEntry(hash);
  if (existing) {
    // Dedup hit: reuse bytes, refresh recency. Re-write bytes only when the
    // persistent copy has been reclaimed.
    if (storageState === "persistent") {
      const present = await opfsExists(existing.opfsName);
      if (!present) {
        await opfsWrite(existing.opfsName, file);
      }
    } else if (!memoryStore.has(hash)) {
      memoryStore.set(hash, { entry: existing, blob: file });
    }
    const touched: CachedMediaEntry = { ...existing, lastUsedAt: Date.now() };
    memoryStore.set(hash, { entry: touched, blob: file });
    await idbPut(touched);
    return { entry: touched, fromCache: true };
  }

  const all = await listEntries();
  const evictions = selectEvictions(
    all,
    file.size,
    MAX_CACHE_ENTRIES,
    MAX_CACHE_TOTAL_BYTES
  );
  for (const target of evictions) {
    const entry = all.find((e) => e.hash === target);
    if (entry) await removeEntry(entry);
  }

  const now = Date.now();
  const opfsName = `${hash}${extensionFor(file)}`;
  const thumb = await makeThumbnail(file);
  const entry: CachedMediaEntry = {
    hash,
    opfsName,
    schemaVersion: SCHEMA_VERSION,
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    ...(thumb ? { thumb } : {}),
    addedAt: now,
    lastUsedAt: now,
  };

  memoryStore.set(hash, { entry, blob: file });
  if (storageState === "persistent") {
    const written = await opfsWrite(opfsName, file);
    if (!written) {
      // OPFS write failed mid-session; degrade to session-only caching.
      storageState = "session";
    }
  }
  await idbPut(entry);
  return { entry, fromCache: false };
}

async function findEntry(hash: string): Promise<CachedMediaEntry | undefined> {
  const memory = memoryStore.get(hash);
  if (memory) return memory.entry;
  if (storageState === "persistent") {
    return idbGet(hash);
  }
  return undefined;
}

async function listEntries(): Promise<CachedMediaEntry[]> {
  if (storageState === "persistent") {
    const persisted = await idbAll();
    const merged = new Map<string, CachedMediaEntry>();
    for (const entry of persisted) merged.set(entry.hash, entry);
    for (const record of memoryStore.values()) {
      merged.set(record.entry.hash, record.entry);
    }
    return [...merged.values()];
  }
  return [...memoryStore.values()].map((record) => record.entry);
}

/** All cache entries, most recently used first. */
export async function listMedia(): Promise<CachedMediaEntry[]> {
  await initMediaCache();
  const entries = await listEntries();
  return entries.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/**
 * Retrieve the cached file by hash, refreshing recency. Returns `undefined`
 * when the entry (or its bytes) no longer exists.
 */
export async function getMediaFile(hash: string): Promise<File | undefined> {
  await initMediaCache();
  const entry = await findEntry(hash);
  if (!entry) return undefined;

  let file: File | undefined;
  const memory = memoryStore.get(hash);
  if (memory) {
    file =
      memory.blob instanceof File
        ? memory.blob
        : new File([memory.blob], entry.name, { type: entry.mime });
  }
  if (!file && storageState === "persistent") {
    file = await opfsRead(entry.opfsName);
    if (!file) {
      // Metadata exists but bytes were reclaimed: drop the bad entry.
      await idbDelete(hash);
      return undefined;
    }
  }
  if (!file) return undefined;

  const touched: CachedMediaEntry = { ...entry, lastUsedAt: Date.now() };
  memoryStore.set(hash, { entry: touched, blob: file });
  await idbPut(touched);
  return file;
}

export async function removeMedia(hash: string): Promise<void> {
  await initMediaCache();
  const entry = await findEntry(hash);
  if (entry) await removeEntry(entry);
}

export async function clearMedia(): Promise<void> {
  await initMediaCache();
  if (storageState === "persistent") {
    const entries = await idbAll();
    for (const entry of entries) await opfsDelete(entry.opfsName);
  }
  memoryStore.clear();
  await idbClear();
}

/**
 * Read a file as raw base64 (no data: prefix). Called only when building a
 * request, never at cache-rest time.
 */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Generate a small thumbnail data URL (~96px max dimension). Returns
 * `undefined` when the environment lacks canvas/decode support or the file
 * is not decodable — thumbnails are best-effort.
 */
export async function makeThumbnail(file: File): Promise<string | undefined> {
  try {
    if (typeof document === "undefined") return undefined;
    if (typeof createImageBitmap !== "function") return undefined;
    const bitmap = await createImageBitmap(file);
    const maxDimension = 96;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return undefined;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return undefined;
  }
}
