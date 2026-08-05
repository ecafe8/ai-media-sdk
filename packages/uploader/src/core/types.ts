/**
 * Common upload result returned by every provider uploader.
 *
 * `url` is the temporary URL the caller passes to a model. `expiresAt` is the
 * provider-documented expiry (48 hours for both Aliyun and Google).
 * `requiresHeaders` lists HTTP headers the caller SHALL send when passing the
 * URL to a downstream model call (e.g. the Aliyun `X-DashScope-OssResourceResolve`
 * resolver header); empty/absent when the provider returns a standard URL.
 */
export interface UploadedFile {
  readonly url: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  readonly expiresAt?: Date;
  readonly requiresHeaders?: Record<string, string>;
}

/**
 * Shared options accepted by every provider uploader factory.
 */
export interface UploaderOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof globalThis.fetch;
}
