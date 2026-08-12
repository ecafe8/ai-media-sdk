import {
  type CachedMediaEntry,
  fileToBase64,
  getMediaFile,
} from "./media-cache";
import type { ImageInput } from "./playground/types";

/**
 * Image input selection model.
 *
 * Components hold either a pasted URL or a cache reference (hash). Base64
 * encoding is deferred until request construction (`resolveImageInput`), so
 * large files never live as base64 strings in component state or storage.
 */

export type ImageSelection =
  | { readonly kind: "url"; readonly url: string }
  | {
      readonly kind: "file";
      readonly hash: string;
      readonly entry: CachedMediaEntry;
      readonly fromCache: boolean;
    };

/** Single-image upload cap (5 MB default). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Raster image MIME whitelist. SVG is intentionally excluded (scriptable
 * content rendered through thumbnails/previews).
 */
export const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "image/gif",
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ImageValidationErrorCode = "UNSUPPORTED_TYPE" | "TOO_LARGE";

export type ImageValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly errorCode: ImageValidationErrorCode;
      readonly maxBytes: number;
      readonly size: number;
    };

/**
 * Validate an image file. Failures carry stable codes and byte counts; the
 * UI renders localized text from `errors.image.<code>`.
 */
export function validateImageFile(
  file: File,
  maxBytes: number = MAX_IMAGE_BYTES
): ImageValidationResult {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      errorCode: "UNSUPPORTED_TYPE",
      maxBytes,
      size: file.size,
    };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      errorCode: "TOO_LARGE",
      maxBytes,
      size: file.size,
    };
  }
  return { ok: true };
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Parse a bulk URL paste (comma and/or newline separated). Returns valid
 * URLs in order plus the rejected raw fragments.
 */
export function parseBulkUrls(text: string): {
  readonly valid: readonly string[];
  readonly invalid: readonly string[];
} {
  const fragments = text
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const fragment of fragments) {
    if (isValidHttpUrl(fragment)) valid.push(fragment);
    else invalid.push(fragment);
  }
  return { valid, invalid };
}

/**
 * Resolve a selection into the wire-shape `ImageInput` right before a
 * request. Returns `undefined` when a cached file has been reclaimed and
 * must be re-selected.
 */
export async function resolveImageInput(
  selection: ImageSelection | undefined
): Promise<ImageInput | undefined> {
  if (!selection) return undefined;
  if (selection.kind === "url") {
    return { url: selection.url };
  }
  const file = await getMediaFile(selection.hash);
  if (!file) return undefined;
  const base64 = await fileToBase64(file);
  return { base64, mimeType: selection.entry.mime };
}

/** Resolve an ordered selection list, preserving order. */
export async function resolveImageInputs(
  selections: readonly ImageSelection[]
): Promise<{
  readonly inputs: readonly ImageInput[];
  readonly missing: number;
}> {
  const inputs: ImageInput[] = [];
  let missing = 0;
  for (const selection of selections) {
    const input = await resolveImageInput(selection);
    if (input) inputs.push(input);
    else missing += 1;
  }
  return { inputs, missing };
}
