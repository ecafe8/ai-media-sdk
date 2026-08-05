/// <reference types="bun" />

/**
 * Fake `fetch` implementation for uploader tests. Queues responses per call
 * (reusing the last when exhausted) and records every request so tests can
 * assert URL, method, headers, and body. No real network.
 */

export interface FakeFetchRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

export interface FakeFetchResponse {
  readonly status: number;
  readonly headers?: Record<string, string>;
  readonly json?: unknown;
  readonly text?: string;
}

export type FakeFetchStep = FakeFetchResponse | { readonly throw: Error };

export interface FakeFetch {
  readonly fetch: typeof globalThis.fetch;
  readonly requests: FakeFetchRequest[];
}

export function createFakeFetch(steps: FakeFetchStep[]): FakeFetch {
  const requests: FakeFetchRequest[] = [];
  let index = 0;

  const fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const headers = extractHeaders(init?.headers);
    const body = extractBody(init?.body);
    requests.push({ url, method, headers, body });

    const step = steps[index] ?? steps[steps.length - 1]!;
    index += 1;
    if ("throw" in step) {
      throw step.throw;
    }

    const responseHeaders = new Headers(step.headers ?? {});
    const response = {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      headers: responseHeaders,
      async json() {
        return step.json ?? null;
      },
      async text() {
        return step.text ?? "";
      },
    } as unknown as Response;
    return response;
  }) as typeof globalThis.fetch;

  return { fetch, requests };
}

function extractHeaders(headers: unknown): Record<string, string> {
  if (!headers) return {};
  if (typeof headers === "string") {
    return parseHeaderString(headers);
  }
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {};
    for (const pair of headers) {
      const [key, value] = pair as [string, unknown];
      out[key] = String(value);
    }
    return out;
  }
  if (typeof headers === "object") {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      headers as Record<string, unknown>
    )) {
      out[key] = String(value);
    }
    return out;
  }
  return {};
}

function parseHeaderString(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of value.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

function extractBody(body: unknown): unknown {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    const out: Record<string, unknown> = {};
    body.forEach((value, key) => {
      out[key] = typeof value === "string" ? value : "[Blob]";
    });
    return out;
  }
  if (body instanceof Uint8Array) {
    return `[bytes:${body.byteLength}]`;
  }
  if (body instanceof Blob) {
    return `[blob:${body.size}]`;
  }
  return "[body]";
}
