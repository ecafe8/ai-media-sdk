/** Google Gemini Files API base URL. */
export const GOOGLE_FILES_BASE_URL =
  "https://generativelanguage.googleapis.com";

/** Path of the resumable upload start endpoint. */
export const GOOGLE_UPLOAD_PATH = "/upload/v1beta/files";

/** Path of the files list/get/delete endpoint. */
export const GOOGLE_FILES_PATH = "/v1beta/files";

/** Google temporary-file lifetime in hours (per Gemini docs). */
export const GOOGLE_TTL_HOURS = 48;

/** Default per-request timeout for Google upload HTTP calls. */
export const GOOGLE_DEFAULT_TIMEOUT_MS = 30_000;

/** Maximum bytes allowed per file by the Gemini Files API. */
export const GOOGLE_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

/** Per-project storage cap enforced by the Gemini Files API. */
export const GOOGLE_MAX_PROJECT_BYTES = 20 * 1024 * 1024 * 1024;
