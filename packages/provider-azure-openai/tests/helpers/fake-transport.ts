/// <reference types="bun" />

import type {
  Transport,
  TransportRequest,
  TransportResponse,
} from "@ai-media/sdk";
import { TransportError } from "@ai-media/sdk";

/**
 * Shared fake transport for Provider contract tests.
 *
 * Records every `TransportRequest` and returns queued responses in order
 * (reusing the last when exhausted). A queued `TransportError` is thrown to
 * simulate a retried-and-exhausted transport failure. No real network.
 */
export type FakeTransportStep =
  | TransportResponse<unknown>
  | { readonly throw: TransportError };

export interface FakeTransport {
  readonly transport: Transport;
  readonly requests: TransportRequest[];
}

export function createFakeTransport(steps: FakeTransportStep[]): FakeTransport {
  const requests: TransportRequest[] = [];
  let index = 0;

  const transport: Transport = {
    async send<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push({ ...request });
      const step = steps[index] ?? steps[steps.length - 1]!;
      index += 1;
      if ("throw" in step) {
        throw step.throw;
      }
      return {
        status: step.status,
        headers: { ...step.headers },
        data: step.data as T,
      };
    },
  };

  return { transport, requests };
}

export function transportResponse(
  status: number,
  data: unknown
): TransportResponse<unknown> {
  return { status, headers: { "content-type": "application/json" }, data };
}

export function transportTimeout(): { throw: TransportError } {
  return {
    throw: new TransportError({
      kind: "timeout",
      message: "timed out",
    }),
  };
}
