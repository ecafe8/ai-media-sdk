/**
 * Classified SDK error and error-code contracts.
 *
 * Every SDK failure surfaces as an `SdkError` carrying a stable `code` and a
 * `retryable` flag. `NOT_IMPLEMENTED` is non-retryable and marks Phase 0 stubs.
 */

/**
 * Stable error codes for the SDK.
 */
export type SdkErrorCode =
  | "NOT_IMPLEMENTED"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "UNKNOWN";

/**
 * Default retryability per error code.
 */
const RETRYABLE_BY_DEFAULT: Readonly<Record<SdkErrorCode, boolean>> = {
  NOT_IMPLEMENTED: false,
  AUTH_ERROR: false,
  RATE_LIMITED: true,
  INVALID_REQUEST: false,
  PROVIDER_ERROR: false,
  TIMEOUT: true,
  NETWORK_ERROR: true,
  UNKNOWN: false,
};

/**
 * Options used to construct an `SdkError`.
 */
export interface SdkErrorOptions {
  readonly code: SdkErrorCode;
  readonly message: string;
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

/**
 * Classified error thrown by the SDK and Provider adapters.
 *
 * `retryable` falls back to the code default when not explicitly provided so
 * callers can decide retry behavior from a stable, documented signal.
 */
export class SdkError extends Error {
  readonly code: SdkErrorCode;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(options: SdkErrorOptions) {
    super(options.message);
    this.name = "SdkError";
    this.code = options.code;
    this.retryable =
      options.retryable ?? RETRYABLE_BY_DEFAULT[options.code] ?? false;
    this.cause = options.cause;
  }
}

/**
 * Build a non-retryable `NOT_IMPLEMENTED` error for a Phase 0 stub.
 *
 * @param feature - Human-readable name of the unimplemented feature.
 */
export function notImplemented(feature: string): SdkError {
  return new SdkError({
    code: "NOT_IMPLEMENTED",
    message: `${feature} is not implemented in Phase 0`,
    retryable: false,
  });
}
