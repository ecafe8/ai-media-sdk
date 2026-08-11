/**
 * Generated-result saving into a user-chosen directory.
 *
 * Uses the File System Access API (`showDirectoryPicker`), available in
 * Chrome/Edge. The directory handle is persisted to IndexedDB; permissions
 * are re-queried before every write. Results are fetched from the provider
 * temporary URL and written as real files with collision-safe names.
 */

export function isDirectoryPickerSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}

const IDB_NAME = "ai-media-site-result-dir";
const IDB_STORE = "directory";
const DIR_HANDLE_KEY = "save-directory";

function openIdb(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === "undefined") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
}

export async function getStoredDirectory(): Promise<
  FileSystemDirectoryHandle | undefined
> {
  const db = await openIdb();
  if (!db) return undefined;
  try {
    const tx = db.transaction(IDB_STORE, "readonly");
    const handle = await idbRequest(
      tx.objectStore(IDB_STORE).get(DIR_HANDLE_KEY) as IDBRequest<
        FileSystemDirectoryHandle | undefined
      >
    );
    return handle ?? undefined;
  } catch {
    return undefined;
  }
}

export async function storeDirectory(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    await idbRequest(tx.objectStore(IDB_STORE).put(handle, DIR_HANDLE_KEY));
  } catch {
    // Non-fatal: the handle still works for this session.
  }
}

export async function clearStoredDirectory(): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    await idbRequest(tx.objectStore(IDB_STORE).delete(DIR_HANDLE_KEY));
  } catch {
    // ignore
  }
}

type DirectoryPermission = "granted" | "prompt" | "denied";

interface PermissionDescriptor {
  name: "storage-access";
  mode?: "read" | "readwrite";
}

export async function queryDirectoryPermission(
  handle: FileSystemDirectoryHandle
): Promise<DirectoryPermission> {
  try {
    return await (
      handle as unknown as {
        queryPermission: (d: PermissionDescriptor) => Promise<PermissionState>;
      }
    ).queryPermission({ name: "storage-access", mode: "readwrite" });
  } catch {
    return "denied";
  }
}

/**
 * Request write permission. Browsers require a user gesture; call this from
 * a click handler. Returns the resulting permission state.
 */
export async function requestDirectoryPermission(
  handle: FileSystemDirectoryHandle
): Promise<DirectoryPermission> {
  try {
    return await (
      handle as unknown as {
        requestPermission: (
          d: PermissionDescriptor
        ) => Promise<PermissionState>;
      }
    ).requestPermission({ name: "storage-access", mode: "readwrite" });
  } catch {
    return "denied";
  }
}

export async function chooseDirectory(): Promise<
  FileSystemDirectoryHandle | undefined
> {
  if (!isDirectoryPickerSupported()) return undefined;
  try {
    const picker = (
      window as unknown as {
        showDirectoryPicker: (options: {
          mode: "read" | "readwrite";
        }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    return await picker.call(window, { mode: "readwrite" });
  } catch {
    // User cancelled the picker or it failed.
    return undefined;
  }
}

const MIME_FILE_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Pure collision-safe name selection. Given the set of existing file names,
 * returns `result-<timestamp>.<ext>` or `result-<timestamp>-<seq>.<ext>`
 * when the base name is taken. Exported for testing.
 */
export function buildResultFileName(
  existingNames: ReadonlySet<string>,
  extension: string,
  timestamp: string
): string {
  const base = `result-${timestamp}`;
  let candidate = `${base}.${extension}`;
  let sequence = 2;
  while (existingNames.has(candidate)) {
    candidate = `${base}-${sequence}.${extension}`;
    sequence += 1;
  }
  return candidate;
}

async function listDirectoryNames(
  dir: FileSystemDirectoryHandle
): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    for await (const entry of (
      dir as unknown as { values: () => AsyncIterable<{ name: string }> }
    ).values()) {
      names.add(entry.name);
    }
  } catch {
    // Listing failure falls back to overwrite-tolerant naming.
  }
  return names;
}

export type SaveFailureReason =
  | "fetch-failed"
  | "permission"
  | "write-failed"
  | "unsupported";

export interface SaveResultOutcome {
  readonly saved: boolean;
  readonly fileName?: string;
  readonly failure?: SaveFailureReason;
}

/**
 * Fetch a provider result URL and write it into the directory. A provider
 * URL that renders in `<img>`/`<video>` can still fail `fetch` when the
 * host does not send CORS headers; that case is reported as `fetch-failed`
 * without losing the preview.
 */
export async function saveResultFile(
  dir: FileSystemDirectoryHandle,
  url: string,
  kind: "image" | "video",
  mimeType: string | undefined
): Promise<SaveResultOutcome> {
  const permission = await queryDirectoryPermission(dir);
  if (permission !== "granted") {
    return { saved: false, failure: "permission" };
  }

  let blob: Blob;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { saved: false, failure: "fetch-failed" };
    }
    blob = await response.blob();
  } catch {
    return { saved: false, failure: "fetch-failed" };
  }

  const resolvedMime =
    mimeType ?? blob.type ?? (kind === "video" ? "video/mp4" : "image/png");
  const extension =
    MIME_FILE_EXTENSIONS[resolvedMime] ?? (kind === "video" ? "mp4" : "png");

  try {
    const existing = await listDirectoryNames(dir);
    const fileName = buildResultFileName(
      existing,
      extension,
      formatTimestamp(new Date())
    );
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { saved: true, fileName };
  } catch {
    return { saved: false, failure: "write-failed" };
  }
}
