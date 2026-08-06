/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  SdkError,
  editImage,
  generateImage,
  type AdapterRequest,
} from "@ai-media/sdk";
import { createSeedreamProvider } from "@ai-media/provider-seedream";

import {
  createFakeTransport,
  transportResponse,
  transportTimeout,
} from "./helpers/fake-transport.js";

const SEEDREAM_CONFIG = {
  apiKey: "test-key",
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
};

const PRO = "doubao-seedream-5-0-pro-260628";
const LITE = "doubao-seedream-5-0-lite-260128";

function arkResponse(
  images: Array<{ url?: string; b64_json?: string; size?: string }>
) {
  return transportResponse(200, {
    created: 1719700000,
    data: images,
    request_id: "req-1",
    usage: { tool_usage: { web_search: 0 } },
  });
}

describe("seedream provider", () => {
  test("factory retains the injected transport and binds a known model", () => {
    const { transport } = createFakeTransport([arkResponse([{ url: "x" }])]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });

    expect(provider.transport).toBe(transport);
    expect(provider.providerId).toBe("doubao-seedream");
    const model = provider.image(PRO);
    expect(model.modelId).toBe(PRO);
    expect(model.providerId).toBe("doubao-seedream");
    expect(model.capabilities.generate).toBe(true);
    expect(model.capabilities.edit).toBe(true);
    expect(model.capabilities.maxEditImages).toBe(10);
  });

  test("unknown model id is rejected with UNKNOWN_MODEL", () => {
    const { transport } = createFakeTransport([arkResponse([{ url: "x" }])]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });

    const error = (() => {
      try {
        provider.image("not-a-real-model");
      } catch (e) {
        return e as SdkError;
      }
      throw new Error("expected throw");
    })();
    expect(error).toBeInstanceOf(SdkError);
    expect(error.code).toBe("UNKNOWN_MODEL");
    expect(error.message).toMatch(/Unknown Seedream model id/);
  });

  test("listModels projects every registry entry including the alias pair", () => {
    const { transport } = createFakeTransport([arkResponse([{ url: "x" }])]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });

    const models = provider.listModels();
    // 5 registry entries (canonical + lite alias)
    expect(models.length).toBe(5);
    expect(models.every((m) => m.providerId === "doubao-seedream")).toBe(true);
    expect(models.some((m) => m.id === "doubao-seedream-5-0-260128")).toBe(
      true
    );
    expect(models.some((m) => m.id === "doubao-seedream-5-0-lite-260128")).toBe(
      true
    );
  });

  test("binds all four registered Seedream models and the lite alias", () => {
    const { transport } = createFakeTransport([arkResponse([{ url: "x" }])]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });

    const proModel = provider.image(PRO);
    expect(proModel.capabilities.maxEditImages).toBe(10);

    const liteModel = provider.image("doubao-seedream-5-0-260128");
    expect(liteModel.capabilities.maxEditImages).toBe(14);

    const liteAlias = provider.image(LITE);
    expect(liteAlias.capabilities.maxEditImages).toBe(14);

    const model45 = provider.image("doubao-seedream-4-5-251128");
    expect(model45.capabilities.edit).toBe(true);
    expect(model45.capabilities.maxEditImages).toBe(14);

    const model40 = provider.image("doubao-seedream-4-0-250828");
    expect(model40.capabilities.generate).toBe(true);
  });

  test("builds the T2I request URL, auth header, and body without image", async () => {
    const { transport, requests } = createFakeTransport([
      arkResponse([{ url: "https://x/a.png" }]),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    await generateImage({
      model,
      prompt: "一只红狐狸",
      size: "2K",
      providerOptions: {
        seedream: {
          watermark: false,
          output_format: "png",
          response_format: "url",
          optimize_prompt_options: { mode: "fast" },
        },
      },
    });

    const request = requests[0]!;
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      "https://ark.cn-beijing.volces.com/api/v3/images/generations"
    );
    const headers = request.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = request.body as Record<string, unknown>;
    expect(body.model).toBe(PRO);
    expect(body.prompt).toBe("一只红狐狸");
    expect(body.size).toBe("2K");
    expect(body.response_format).toBe("url");
    expect(body.output_format).toBe("png");
    expect(body.watermark).toBe(false);
    expect(body.optimize_prompt_options).toEqual({ mode: "fast" });
    expect(body.image).toBeUndefined();
  });

  test("builds the I2I image field as a single string for one input", async () => {
    const { transport, requests } = createFakeTransport([
      arkResponse([{ url: "https://x/out.png" }]),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    await editImage({
      model,
      prompt: "变成黑白",
      images: [{ url: "https://example.com/a.png" }],
    });

    const body = requests[0]!.body as Record<string, unknown>;
    expect(body.image).toBe("https://example.com/a.png");
  });

  test("builds the I2I image field as an ordered string array for multiple inputs", async () => {
    const { transport, requests } = createFakeTransport([
      arkResponse([{ url: "https://x/out.png" }]),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    await editImage({
      model,
      prompt: "融合两张图",
      images: [
        { url: "https://example.com/a.png" },
        { base64: "aGVsbG8=", mimeType: "image/png" },
      ],
    });

    const body = requests[0]!.body as Record<string, unknown>;
    const image = body.image as string[];
    expect(Array.isArray(image)).toBe(true);
    expect(image).toHaveLength(2);
    expect(image[0]).toBe("https://example.com/a.png");
    expect(image[1]).toBe("data:image/png;base64,aGVsbG8=");
  });

  test("maps the Ark response urls into ImageContent[] with provider/model ids", async () => {
    const { transport } = createFakeTransport([
      arkResponse([
        { url: "https://x/a.png", size: "2048x2048" },
        { url: "https://x/b.png" },
      ]),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    const result = await generateImage({ model, prompt: "p" });

    expect(result.provider).toBe("doubao-seedream");
    expect(result.model).toBe(PRO);
    expect(result.requestId).toBe("req-1");
    expect(result.content).toHaveLength(2);
    expect(result.content[0]?.url).toBe("https://x/a.png");
    expect(result.content[0]?.width).toBe(2048);
    expect(result.content[0]?.height).toBe(2048);
    expect(result.content[1]?.url).toBe("https://x/b.png");
  });

  test("maps b64_json results into base64 image content", async () => {
    const { transport } = createFakeTransport([
      arkResponse([{ b64_json: "aGVsbG8=" }]),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    const result = await generateImage({ model, prompt: "p" });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.base64).toBe("aGVsbG8=");
  });

  test("classifies 401 as non-retryable AUTH_ERROR without leaking the key", async () => {
    const { transport } = createFakeTransport([
      transportResponse(401, {
        error: { code: "InvalidApiKey", message: "Invalid API-key provided." },
      }),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("AUTH_ERROR");
    expect(error.retryable).toBe(false);
    expect(error.message).not.toContain("test-key");
  });

  test("classifies 429 as retryable RATE_LIMITED", async () => {
    const { transport } = createFakeTransport([
      transportResponse(429, {
        error: { code: "Throttling", message: "slow down" },
      }),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  test("classifies 400 as INVALID_REQUEST", async () => {
    const { transport } = createFakeTransport([
      transportResponse(400, { error: { code: "BadRequest", message: "bad" } }),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("INVALID_REQUEST");
  });

  test("classifies 5xx as PROVIDER_ERROR", async () => {
    const { transport } = createFakeTransport([
      transportResponse(503, {
        error: { code: "InternalServiceError", message: "down" },
      }),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
  });

  test("maps a transport timeout to TIMEOUT", async () => {
    const { transport } = createFakeTransport([transportTimeout()]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("TIMEOUT");
    expect(error.message).not.toContain("test-key");
  });

  test("rejects malformed generation input with INVALID_REQUEST before transport", async () => {
    const { transport, requests } = createFakeTransport([
      arkResponse([{ url: "x" }]),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });

    await expect(
      provider.generate({
        provider: "doubao-seedream",
        model: PRO,
        modality: "image",
        input: { notPrompt: true },
      } as unknown as AdapterRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects out-of-range edit image count before transport", async () => {
    const { transport, requests } = createFakeTransport([
      arkResponse([{ url: "x" }]),
    ]);
    const provider = createSeedreamProvider(SEEDREAM_CONFIG, { transport });
    const model = provider.image(PRO); // maxEditImages = 10

    const tooMany = Array.from({ length: 11 }, () => ({
      url: "https://example.com/a.png",
    }));
    await expect(
      editImage({ model, prompt: "p", images: tooMany })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("default baseUrl targets the ark cn-beijing endpoint", async () => {
    const { transport, requests } = createFakeTransport([
      arkResponse([{ url: "x" }]),
    ]);
    const provider = createSeedreamProvider(
      { apiKey: "test-key" },
      { transport }
    );
    const model = provider.image(PRO);

    await generateImage({ model, prompt: "p" });

    expect(requests[0]!.url).toBe(
      "https://ark.cn-beijing.volces.com/api/v3/images/generations"
    );
  });
});
