import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  GOOGLE_DEFAULT_TIMEOUT_MS,
  GOOGLE_FILES_BASE_URL,
  GOOGLE_UPLOAD_PATH,
} from "./constants.ts";
import { UPLOADER_ERROR_CODES, UploaderError } from "../core/index.ts";
import type {
  GoogleFileResource,
  GoogleUploadParams,
  GoogleUploadedFile,
  GoogleUploaderOptions,
} from "./types.ts";
import { mapFileResource, toExpiresAt } from "./helpers.ts";

/**
 * Upload a local file to the Gemini Files API using the resumable protocol.
 *
 * Step 1: `POST {baseUrl}/upload/v1beta/files` with the resumable start headers
 * to obtain the upload URL from the `X-Goog-Upload-URL` response header.
 * Step 2: POST the raw bytes to that URL with `X-Goog-Upload-Command: upload,
 * finalize`, returning the file resource (name, uri, mimeType, state).
 */
export async function uploadFile(
  options: GoogleUploaderOptions,
  params: GoogleUploadParams,
  fetchImpl: typeof globalThis.fetch
): Promise<GoogleUploadedFile> {
  let fileBytes: Uint8Array;
  let fileName: string;
  let mimeType: string | undefined;
  if (params.filePath) {
    const buffer = await readFile(params.filePath);
    fileBytes = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    fileName = params.fileName ?? basename(params.filePath);
    mimeType = params.mimeType;
  } else if (params.fileBytes) {
    if (!params.fileName) {
      throw new UploaderError({
        code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
        message: "Google upload requires fileName when fileBytes is provided",
      });
    }
    if (!params.mimeType) {
      throw new UploaderError({
        code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
        message: "Google upload requires mimeType when fileBytes is provided",
      });
    }
    fileBytes = params.fileBytes;
    fileName = params.fileName;
    mimeType = params.mimeType;
  } else {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: "Google upload requires either filePath or fileBytes",
    });
  }

  const baseUrl = options.baseUrl ?? GOOGLE_FILES_BASE_URL;
  const timeoutMs = options.timeoutMs ?? GOOGLE_DEFAULT_TIMEOUT_MS;
  const numBytes = fileBytes.byteLength;

  const startUrl = `${baseUrl}${GOOGLE_UPLOAD_PATH}`;
  const startHeaders: Record<string, string> = {
    "x-goog-api-key": options.apiKey,
    "X-Goog-Upload-Protocol": "resumable",
    "X-Goog-Upload-Command": "start",
    "X-Goog-Upload-Header-Content-Length": String(numBytes),
    "Content-Type": "application/json",
  };
  if (mimeType) {
    startHeaders["X-Goog-Upload-Header-Content-Type"] = mimeType;
  }
  const startBody = JSON.stringify({
    file: { display_name: params.displayName ?? fileName },
  });

  let startResponse: Response;
  try {
    startResponse = await fetchImpl(startUrl, {
      method: "POST",
      headers: startHeaders,
      body: startBody,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UPLOAD_ERROR,
      message: "Google upload start request failed",
      cause,
    });
  }

  if (!startResponse.ok) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UPLOAD_ERROR,
      message: `Google upload start failed with HTTP ${startResponse.status}`,
      statusCode: startResponse.status,
    });
  }

  const uploadUrl = startResponse.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.INVALID_RESPONSE,
      message: "Google upload start response is missing X-Goog-Upload-URL",
    });
  }

  const fileBuffer = fileBytes.buffer.slice(
    fileBytes.byteOffset,
    fileBytes.byteOffset + fileBytes.byteLength
  ) as ArrayBuffer;
  let finalizeResponse: Response;
  try {
    finalizeResponse = await fetchImpl(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(numBytes),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: fileBuffer,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UPLOAD_ERROR,
      message: "Google upload finalize request failed",
      cause,
    });
  }

  if (!finalizeResponse.ok) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UPLOAD_ERROR,
      message: `Google upload finalize failed with HTTP ${finalizeResponse.status}`,
      statusCode: finalizeResponse.status,
    });
  }

  const payload = (await finalizeResponse.json()) as {
    file?: GoogleFileResource;
  };
  const resource = payload?.file;
  if (
    !resource ||
    typeof resource.name !== "string" ||
    typeof resource.uri !== "string"
  ) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.INVALID_RESPONSE,
      message: "Google upload response is missing file name or uri",
    });
  }

  return mapFileResource(resource, toExpiresAt());
}
