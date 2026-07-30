/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  DEFAULT_RETRY_POLICY,
  SdkError,
  TransportError,
  createTransport,
  type TransportRequest,
} from "@ai-media/sdk";

function createCountingFetch(
  responses: {
    status: number;
    body?: unknown;
  }[]
): {
  fetchImpl: typeof globalThis.fetch;
  getCalls: () => TransportRequest[];
} {
  let index = 0;
  const calls: TransportRequest[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    calls.push({
      url: _url,
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string> | undefined,
      body: init?.body,
      timeoutMs: undefined,
    });
    const { status, body = {} } =
      responses[index] ?? responses[responses.length - 1]!;
    index += 1;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
  return { fetchImpl, getCalls: () => calls };
}

describe("shared transport", () => {
  test("retries 429 up to maxRetries then returns the last response", async () => {
    const { fetchImpl, getCalls } = createCountingFetch([
      { status: 429 },
      { status: 429 },
      { status: 429 },
    ]);
    const transport = createTransport({
      fetch: fetchImpl,
      retryPolicy: {
        ...DEFAULT_RETRY_POLICY,
        maxRetries: 2,
        initialDelayMs: 1,
      },
    });

    const response = await transport.send({
      url: "https://example.com",
      method: "POST",
    });

    expect(response.status).toBe(429);
    // Initial attempt + 2 retries.
    expect(getCalls()).toHaveLength(3);
  });

  test("returns 2xx immediately without retry", async () => {
    const { fetchImpl, getCalls } = createCountingFetch([
      { status: 200, body: { ok: true } },
    ]);
    const transport = createTransport({
      fetch: fetchImpl,
      retryPolicy: { ...DEFAULT_RETRY_POLICY, initialDelayMs: 1 },
    });

    const response = await transport.send<{ ok: boolean }>({
      url: "https://example.com",
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ ok: true });
    expect(getCalls()).toHaveLength(1);
  });

  test("throws TransportError on timeout after retry exhaustion", async () => {
    const calls: unknown[] = [];
    const fetchImpl = (async () => {
      calls.push(1);
      const error = new Error("The operation timed out");
      error.name = "TimeoutError";
      throw error;
    }) as unknown as typeof globalThis.fetch;
    const transport = createTransport({
      fetch: fetchImpl,
      retryPolicy: {
        ...DEFAULT_RETRY_POLICY,
        maxRetries: 1,
        initialDelayMs: 1,
      },
    });

    await expect(
      transport.send({ url: "https://example.com", method: "POST" })
    ).rejects.toBeInstanceOf(TransportError);

    expect(calls).toHaveLength(2);
  });

  test("does not import SdkError into thrown transport errors", async () => {
    const fetchImpl = (async () => {
      const error = new Error("fetch failed");
      error.name = "TypeError";
      throw error;
    }) as unknown as typeof globalThis.fetch;
    const transport = createTransport({
      fetch: fetchImpl,
      retryPolicy: { ...DEFAULT_RETRY_POLICY, maxRetries: 0 },
    });

    const error = await transport
      .send({ url: "https://example.com", method: "POST" })
      .catch((err: unknown) => err);

    expect(error).not.toBeInstanceOf(SdkError);
    expect(error).toBeInstanceOf(TransportError);
    if (error instanceof TransportError) {
      expect(error.kind).toBe("network");
    }
  });
});
