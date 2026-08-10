import { UPLOADER_ERROR_CODES, UploaderError } from "../core/index.ts";
import {
  GOOGLE_DEFAULT_TIMEOUT_MS,
  GOOGLE_FILES_BASE_URL,
  GOOGLE_FILES_PATH,
} from "./constants.ts";
import { mapFileResource, toExpiresAt } from "./helpers.ts";
import type {
  GoogleFileResource,
  GoogleListResponse,
  GoogleUploadedFile,
  GoogleUploaderOptions,
} from "./types.ts";

function buildFilesUrl(baseUrl: string, name?: string): string {
  if (name) {
    return `${baseUrl}/v1beta/${name}`;
  }
  return `${baseUrl}${GOOGLE_FILES_PATH}`;
}

async function sendFilesRequest(
  options: GoogleUploaderOptions,
  method: string,
  name: string | undefined,
  fetchImpl: typeof globalThis.fetch
): Promise<Response> {
  const baseUrl = options.baseUrl ?? GOOGLE_FILES_BASE_URL;
  const timeoutMs = options.timeoutMs ?? GOOGLE_DEFAULT_TIMEOUT_MS;
  const url = buildFilesUrl(baseUrl, name);
  return fetchImpl(url, {
    method,
    headers: { "x-goog-api-key": options.apiKey },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** `GET /v1beta/{name}` — retrieve metadata for a single file. */
export async function getFile(
  options: GoogleUploaderOptions,
  name: string,
  fetchImpl: typeof globalThis.fetch
): Promise<GoogleUploadedFile> {
  let response: Response;
  try {
    response = await sendFilesRequest(options, "GET", name, fetchImpl);
  } catch (cause) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UNKNOWN,
      message: "Google get request failed",
      cause,
    });
  }

  if (response.status === 404) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.NOT_FOUND,
      message: `Google file not found: ${name}`,
      statusCode: 404,
    });
  }

  if (!response.ok) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UNKNOWN,
      message: `Google get failed with HTTP ${response.status}`,
      statusCode: response.status,
    });
  }

  const resource = (await response.json()) as GoogleFileResource;
  return mapFileResource(resource, toExpiresAt());
}

/** `GET /v1beta/files` — async-iterable list following `nextPageToken`. */
export async function* listFiles(
  options: GoogleUploaderOptions,
  fetchImpl: typeof globalThis.fetch
): AsyncIterable<GoogleUploadedFile> {
  const baseUrl = options.baseUrl ?? GOOGLE_FILES_BASE_URL;
  const timeoutMs = options.timeoutMs ?? GOOGLE_DEFAULT_TIMEOUT_MS;
  const expiresAt = toExpiresAt();
  let pageToken: string | undefined;
  do {
    const root = `${baseUrl}${GOOGLE_FILES_PATH}`;
    const url = pageToken
      ? `${root}?pageToken=${encodeURIComponent(pageToken)}`
      : root;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { "x-goog-api-key": options.apiKey },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new UploaderError({
        code: UPLOADER_ERROR_CODES.UNKNOWN,
        message: "Google list request failed",
        cause,
      });
    }

    if (!response.ok) {
      throw new UploaderError({
        code: UPLOADER_ERROR_CODES.UNKNOWN,
        message: `Google list failed with HTTP ${response.status}`,
        statusCode: response.status,
      });
    }

    const payload = (await response.json()) as GoogleListResponse;
    const files = payload?.files ?? [];
    for (const resource of files) {
      yield mapFileResource(resource, expiresAt);
    }
    pageToken = payload?.nextPageToken;
  } while (pageToken);
}

/** `DELETE /v1beta/{name}` — delete a single file. */
export async function deleteFile(
  options: GoogleUploaderOptions,
  name: string,
  fetchImpl: typeof globalThis.fetch
): Promise<void> {
  let response: Response;
  try {
    response = await sendFilesRequest(options, "DELETE", name, fetchImpl);
  } catch (cause) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UNKNOWN,
      message: "Google delete request failed",
      cause,
    });
  }

  if (response.status === 404) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.NOT_FOUND,
      message: `Google file not found: ${name}`,
      statusCode: 404,
    });
  }

  if (!response.ok) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UNKNOWN,
      message: `Google delete failed with HTTP ${response.status}`,
      statusCode: response.status,
    });
  }
}
