import { GOOGLE_TTL_HOURS } from "./constants.ts";
import type { GoogleFileResource, GoogleUploadedFile } from "./types.ts";

/** Compute the standard 48-hour expiry timestamp from now. */
export function toExpiresAt(): Date {
  return new Date(Date.now() + GOOGLE_TTL_HOURS * 60 * 60 * 1000);
}

/** Map a raw Gemini file resource to the public {@link GoogleUploadedFile}. */
export function mapFileResource(
  resource: GoogleFileResource,
  expiresAt: Date
): GoogleUploadedFile {
  const name = resource.name ?? "";
  return {
    url: resource.uri ?? "",
    name,
    state: resource.state ?? "ACTIVE",
    expiresAt,
    ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
    ...(typeof resource.sizeBytes === "string"
      ? { sizeBytes: Number(resource.sizeBytes) }
      : {}),
  };
}
