import type {
  Transport,
  TransportRequest,
  TransportResponse,
} from "../contracts/transport.ts";
import { DEFAULT_RETRY_POLICY } from "../contracts/retry-policy.ts";
import type { RetryPolicy } from "../contracts/retry-policy.ts";
import { TransportError } from "./transport-error.ts";

/**
 * Shared transport implementation.
 *
 * `createTransport` wraps `fetch` with an `AbortController` timeout and limited
 * exponential-backoff retry on `RetryPolicy.retryableStatusCodes` plus
 * network/timeout failures. Adapters never call global `fetch` directly.
 */

/**
 * Default per-request timeout when the caller does not supply one.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Options for constructing a shared transport.
 */
export interface CreateTransportOptions {
  /** Custom `fetch`; defaults to the global `fetch`. */
  readonly fetch?: typeof globalThis.fetch;
  /** Retry policy; defaults to `DEFAULT_RETRY_POLICY`. */
  readonly retryPolicy?: RetryPolicy;
  /** Default timeout applied when a request omits `timeoutMs`. */
  readonly defaultTimeoutMs?: number;
}

/**
 * Create a shared `Transport` with timeout and limited retry.
 *
 * HTTP responses (any status) are returned; only network/timeout failures
 * throw `TransportError`. Retryable status codes are retried up to
 * `maxRetries`, then the last response is returned for the adapter to
 * classify. The transport does not import `SdkError`.
 */
export function createTransport(options?: CreateTransportOptions): Transport {
  const fetchImpl = options?.fetch ?? globalThis.fetch;
  const retryPolicy = options?.retryPolicy ?? DEFAULT_RETRY_POLICY;
  const defaultTimeoutMs = options?.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async send<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      return sendWithRetry<T>(
        fetchImpl,
        retryPolicy,
        defaultTimeoutMs,
        request
      );
    },
  };
}

async function sendWithRetry<T>(
  fetchImpl: typeof globalThis.fetch,
  retryPolicy: RetryPolicy,
  defaultTimeoutMs: number,
  request: TransportRequest
): Promise<TransportResponse<T>> {
  const url = request.url;
  const method = request.method;
  const headers = request.headers;
  const body = request.body;
  const timeoutMs = request.timeoutMs ?? defaultTimeoutMs;

  let attempt = 0;
  let lastResponse: TransportResponse<T> | undefined;

  for (;;) {
    const shouldRetry = attempt < retryPolicy.maxRetries;
    try {
      const response = await fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : serializeBody(body),
        signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
      });

      const data = (await parseBody(response)) as T;
      lastResponse = {
        status: response.status,
        headers: headersToObject(response.headers),
        data,
      };

      if (
        shouldRetry &&
        retryPolicy.retryableStatusCodes.includes(response.status)
      ) {
        attempt += 1;
        await delay(backoffMs(retryPolicy, attempt));
        continue;
      }

      return lastResponse;
    } catch (error) {
      if (isAbortError(error)) {
        if (shouldRetry) {
          attempt += 1;
          await delay(backoffMs(retryPolicy, attempt));
          continue;
        }
        throw new TransportError({
          kind: "timeout",
          message: `Request timed out after ${timeoutMs}ms`,
          cause: error,
        });
      }
      if (isNetworkError(error)) {
        if (shouldRetry) {
          attempt += 1;
          await delay(backoffMs(retryPolicy, attempt));
          continue;
        }
        throw new TransportError({
          kind: "network",
          message: "Network request failed",
          cause: error,
        });
      }
      throw error;
    }
  }
}

function serializeBody(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function backoffMs(retryPolicy: RetryPolicy, attempt: number): number {
  const base =
    retryPolicy.initialDelayMs * retryPolicy.backoffFactor ** (attempt - 1);
  return Math.min(base, retryPolicy.maxDelayMs);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === "TimeoutError" || error.name === "AbortError";
  }
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    return (
      error.name === "TypeError" ||
      /fetch failed|network|ECONN|ENOTFOUND|ECONNRESET|ECONNREFUSED/i.test(
        error.message
      )
    );
  }
  return false;
}
