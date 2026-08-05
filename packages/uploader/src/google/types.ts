import type { UploadedFile, UploaderOptions } from "../core/index.ts";

export interface GoogleUploaderOptions extends UploaderOptions {
  /** Override the default `https://generativelanguage.googleapis.com` base URL. */
  readonly baseUrl?: string;
}

/**
 * Input to {@link GoogleUploader.upload}. Provide either a local `filePath`
 * or in-memory `fileBytes` plus `fileName` and `mimeType`.
 */
export interface GoogleUploadParams {
  readonly filePath?: string;
  readonly fileBytes?: Uint8Array;
  readonly fileName?: string;
  /** Required when `fileBytes` is provided; inferred for `filePath` is not supported. */
  readonly mimeType?: string;
  readonly displayName?: string;
}

/** Processing state of a Gemini file resource. */
export type GoogleFileState = "PROCESSING" | "ACTIVE" | "FAILED";

/**
 * Upload result returned by the Google uploader. `url` is the standard
 * `https://` URI the caller passes to a model; `name` is the file resource
 * identifier (e.g. `files/abc`) used by `get`/`delete`.
 */
export interface GoogleUploadedFile extends UploadedFile {
  readonly url: string;
  readonly name: string;
  readonly state: GoogleFileState;
  readonly expiresAt: Date;
}

export interface GoogleUploader {
  upload(params: GoogleUploadParams): Promise<GoogleUploadedFile>;
  get(name: string): Promise<GoogleUploadedFile>;
  list(): AsyncIterable<GoogleUploadedFile>;
  delete(name: string): Promise<void>;
}

/** Raw Gemini file resource shape (subset used by this uploader). */
export interface GoogleFileResource {
  readonly name?: string;
  readonly uri?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: string;
  readonly state?: GoogleFileState;
}

export interface GoogleListResponse {
  readonly files?: GoogleFileResource[];
  readonly nextPageToken?: string;
}
