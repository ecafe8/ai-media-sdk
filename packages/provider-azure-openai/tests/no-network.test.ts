import { describe, expect, test } from "bun:test";

import type {
  Transport,
  TransportRequest,
  TransportResponse,
} from "@ai-media/sdk";
import { createAzureOpenAIProvider } from "@ai-media/provider-azure-openai";

function createCountingTransport(): {
  transport: Transport;
  getCount: () => number;
} {
  let count = 0;
  const transport: Transport = {
    async send<T>(_request: TransportRequest): Promise<TransportResponse<T>> {
      count += 1;
      return {
        status: 200,
        headers: {},
        data: {} as T,
      };
    },
  };
  return { transport, getCount: () => count };
}

const AZURE_CONFIG = {
  apiKey: "test-key",
  endpoint: "https://example.cognitiveservices.azure.com",
  apiVersion: "2024-10-01",
};

const AZURE_REQUEST = {
  provider: "azure-openai",
  model: "dall-e-3",
  modality: "image" as const,
  input: {},
};

describe("azure-openai provider phase 0", () => {
  test("factory retains the injected transport", () => {
    const { transport } = createCountingTransport();
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    expect(provider.transport).toBe(transport);
    expect(provider.providerId).toBe("azure-openai");
  });

  test("adapter stubs reject without invoking the transport", async () => {
    const { transport, getCount } = createCountingTransport();
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    await expect(provider.generate(AZURE_REQUEST)).rejects.toThrow();
    await expect(provider.edit(AZURE_REQUEST)).rejects.toThrow();

    expect(getCount()).toBe(0);
  });
});
