/**
 * Transport boundary contracts.
 *
 * Phase 0 exposes transport types and a minimal construction boundary only.
 * Provider adapters SHALL receive or construct the shared transport and
 * SHALL NOT call the global `fetch` directly inside adapter logic. The eventual
 * implementation injects `fetch`, timeout, and headers through this boundary.
 */

/**
 * An outbound HTTP request described in a provider-agnostic shape.
 */
export interface TransportRequest {
  readonly url: string;
  readonly method: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

/**
 * A parsed HTTP response. `data` is the provider-decoded body.
 */
export interface TransportResponse<T> {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly data: T;
}

/**
 * The shared transport abstraction injected into Provider adapters.
 *
 * Implementations wrap `fetch` with timeout, retries, and header handling so
 * adapter logic stays provider-agnostic and testable with a counting fake.
 */
export interface Transport {
  send<T>(request: TransportRequest): Promise<TransportResponse<T>>;
  sendStream?(request: TransportRequest): Promise<TransportStreamResponse>;
}

/** Streaming HTTP response exposed for SSE-capable provider adapters. */
export interface TransportStreamResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: AsyncIterable<string>;
}
