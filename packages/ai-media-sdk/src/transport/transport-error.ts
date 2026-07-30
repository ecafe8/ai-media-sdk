/**
 * Transport error contracts.
 *
 * The shared transport throws `TransportError` only for network failures and
 * timeouts. HTTP responses (including non-2xx) are returned as
 * `TransportResponse` so Provider adapters classify status codes. The
 * transport module stays provider-agnostic and does not import `SdkError`.
 */

/**
 * The kind of transport failure that escaped retry.
 */
export type TransportErrorKind = "timeout" | "network";

/**
 * Options used to construct a `TransportError`.
 */
export interface TransportErrorOptions {
  readonly kind: TransportErrorKind;
  readonly message: string;
  readonly cause?: unknown;
}

/**
 * Thrown by the shared transport when a request aborts on timeout or fails on
 * a network error after retry exhaustion. Carries no HTTP status; adapters map
 * it to `TIMEOUT` or `NETWORK_ERROR`.
 */
export class TransportError extends Error {
  readonly kind: TransportErrorKind;
  override readonly cause?: unknown;

  constructor(options: TransportErrorOptions) {
    super(options.message);
    this.name = "TransportError";
    this.kind = options.kind;
    this.cause = options.cause;
  }
}
