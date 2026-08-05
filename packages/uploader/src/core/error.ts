/**
 * Stable error codes surfaced by every uploader implementation.
 */
export const UPLOADER_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  POLICY_ERROR: "POLICY_ERROR",
  UPLOAD_ERROR: "UPLOAD_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_FOUND: "NOT_FOUND",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  UNKNOWN: "UNKNOWN",
} as const;

export type UploaderErrorCode =
  (typeof UPLOADER_ERROR_CODES)[keyof typeof UPLOADER_ERROR_CODES];

/**
 * Error thrown by uploader implementations. Carries a stable `code`, the
 * upstream HTTP `statusCode` when applicable, and the original `cause`.
 */
export class UploaderError extends Error {
  readonly code: UploaderErrorCode;
  readonly statusCode?: number;
  readonly cause?: unknown;

  constructor(options: {
    code: UploaderErrorCode;
    message: string;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "UploaderError";
    this.code = options.code;
    if (typeof options.statusCode === "number") {
      this.statusCode = options.statusCode;
    }
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
