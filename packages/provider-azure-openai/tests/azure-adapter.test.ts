/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { SdkError, type AdapterRequest } from "@ai-media/sdk";
import { createAzureOpenAIProvider } from "@ai-media/provider-azure-openai";

import {
  createFakeTransport,
  transportResponse,
  transportTimeout,
} from "./helpers/fake-transport.js";

const AZURE_CONFIG = {
  apiKey: "test-key",
  endpoint: "https://example.cognitiveservices.azure.com",
  apiVersion: "2024-02-01",
};

const DEPLOYMENT = "gpt-image-2";

function buildAdapterRequest(input: Record<string, unknown>): AdapterRequest {
  return {
    provider: "azure-openai",
    model: DEPLOYMENT,
    modality: "image",
    input,
  };
}

describe("azure-openai provider", () => {
  test("factory retains the injected transport and exposes the model factory", () => {
    const { transport } = createFakeTransport([transportResponse(200, {})]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    expect(provider.transport).toBe(transport);
    expect(provider.providerId).toBe("azure-openai");
    const model = provider.image(DEPLOYMENT);
    expect(model.modelId).toBe(DEPLOYMENT);
    expect(model.providerId).toBe("azure-openai");
    expect(model.capabilities.generate).toBe(true);
    expect(model.capabilities.edit).toBe(false);
  });

  test("builds the generations request URL, auth header, and body", async () => {
    const { transport, requests } = createFakeTransport([
      transportResponse(200, { data: [{ url: "https://x/a.png" }] }),
    ]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    await provider.generate(
      buildAdapterRequest({
        prompt: "a red fox",
        n: 1,
        size: "1024x1024",
        providerOptions: {
          azure: {
            quality: "low",
            output_format: "png",
            output_compression: 100,
          },
        },
      })
    );

    const request = requests[0]!;
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      "https://example.cognitiveservices.azure.com/openai/deployments/gpt-image-2/images/generations?api-version=2024-02-01"
    );
    const headers = request.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = request.body as Record<string, unknown>;
    expect(body.prompt).toBe("a red fox");
    expect(body.n).toBe(1);
    expect(body.size).toBe("1024x1024");
    expect(body.quality).toBe("low");
    expect(body.output_format).toBe("png");
    expect(body.output_compression).toBe(100);
  });

  test("maps a url response into ImageContent[] with provider and model ids", async () => {
    const { transport } = createFakeTransport([
      transportResponse(200, {
        created: 1719700000,
        data: [{ url: "https://x/a.png" }, { url: "https://x/b.png" }],
      }),
    ]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    const result = await provider.generate(
      buildAdapterRequest({ prompt: "p" })
    );

    expect(result.provider).toBe("azure-openai");
    expect(result.model).toBe(DEPLOYMENT);
    expect(result.createdAt).toBeTypeOf("string");
    expect(result.content).toHaveLength(2);
    expect(result.content[0]?.url).toBe("https://x/a.png");
    expect(result.content[1]?.url).toBe("https://x/b.png");
  });

  test("maps a b64_json response into ImageContent base64 payloads", async () => {
    const { transport } = createFakeTransport([
      transportResponse(200, { data: [{ b64_json: "aGVsbG8=" }] }),
    ]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    const result = await provider.generate(
      buildAdapterRequest({ prompt: "p" })
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.base64).toBe("aGVsbG8=");
  });

  test("classifies 401 as non-retryable AUTH_ERROR without leaking the key", async () => {
    const { transport } = createFakeTransport([
      transportResponse(401, { error: { message: "access denied" } }),
    ]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    const error = await provider
      .generate(buildAdapterRequest({ prompt: "p" }))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("AUTH_ERROR");
    expect((error as SdkError).retryable).toBe(false);
    expect((error as SdkError).message).not.toContain("test-key");
    expect((error as SdkError).message).not.toContain("Bearer");
  });

  test("classifies 429 as retryable RATE_LIMITED", async () => {
    const { transport } = createFakeTransport([
      transportResponse(429, { error: { message: "slow down" } }),
    ]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    const error = (await provider
      .generate(buildAdapterRequest({ prompt: "p" }))
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  test("classifies 5xx as PROVIDER_ERROR", async () => {
    const { transport } = createFakeTransport([
      transportResponse(503, { error: { message: "down" } }),
    ]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    const error = (await provider
      .generate(buildAdapterRequest({ prompt: "p" }))
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
  });

  test("maps a transport timeout to TIMEOUT", async () => {
    const { transport } = createFakeTransport([transportTimeout()]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    const error = (await provider
      .generate(buildAdapterRequest({ prompt: "p" }))
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("TIMEOUT");
    expect(error.retryable).toBe(true);
    expect(error.message).not.toContain("test-key");
  });

  test("editImage stays NOT_IMPLEMENTED", async () => {
    const { transport, requests } = createFakeTransport([
      transportResponse(200, {}),
    ]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    await expect(
      provider.edit(buildAdapterRequest({ prompt: "p" }))
    ).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
      retryable: false,
    });
    expect(requests).toHaveLength(0);
  });

  test("rejects with INVALID_REQUEST when the input is malformed", async () => {
    const { transport, requests } = createFakeTransport([
      transportResponse(200, {}),
    ]);
    const provider = createAzureOpenAIProvider(AZURE_CONFIG, { transport });

    await expect(
      provider.generate({
        provider: "azure-openai",
        model: DEPLOYMENT,
        modality: "image",
        input: { notPrompt: true },
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });
});
