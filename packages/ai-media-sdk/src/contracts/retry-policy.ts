/**
 * Retry policy contracts.
 *
 * Phase 0 exposes the retry policy shape only; the transport implementation
 * applies it in a later phase. Error codes carry a default retryable flag.
 */

/**
 * Declarative retry policy consumed by the shared transport.
 */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffFactor: number;
  readonly retryableStatusCodes: readonly number[];
}

/**
 * A conservative default retry policy for idempotent transport calls.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 8_000,
  backoffFactor: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};
