/// <reference types="bun" />

import { describe, expect, test } from "bun:test";
import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import {
  type AdapterRequest,
  editImage,
  generateImage,
  SdkError,
} from "@ai-media/sdk";

import {
  createFakeTransport,
  transportResponse,
  transportTimeout,
} from "./helpers/fake-transport.js";

const ALIYUN_CONFIG = {
  apiKey: "test-key",
  baseUrl: "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1",
};

const QWEN = "qwen-image-2.0-pro";

function qwenResponse(images: string[]) {
  return transportResponse(200, {
    output: {
      choices: [
        {
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: images.map((image) => ({ image })),
          },
        },
      ],
    },
    usage: { width: 1024, height: 1024, image_count: images.length },
    request_id: "req-1",
  });
}

describe("aliyun-bailian provider", () => {
  test("factory retains the injected transport and binds a known model", () => {
    const { transport } = createFakeTransport([qwenResponse(["x"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    expect(provider.transport).toBe(transport);
    expect(provider.providerId).toBe("aliyun-bailian");
    const model = provider.image(QWEN);
    expect(model.modelId).toBe(QWEN);
    expect(model.providerId).toBe("aliyun-bailian");
    expect(model.capabilities.generate).toBe(true);
    expect(model.capabilities.edit).toBe(true);
    expect(model.capabilities.maxEditImages).toBe(3);
  });

  test("unknown model id is rejected with UNKNOWN_MODEL", () => {
    const { transport } = createFakeTransport([qwenResponse(["x"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

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
    expect(error.message).toMatch(/Unknown Aliyun model id/);
  });

  test("image() rejects known video-family models with INVALID_REQUEST", () => {
    const { transport } = createFakeTransport([qwenResponse(["x"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    expect(() => provider.image("happyhorse-1.1-t2v")).toThrow(SdkError);
    expect(() => provider.image("happyhorse-1.1-t2v")).toThrow(
      /is not an image model/
    );
    const error = (() => {
      try {
        provider.image("happyhorse-1.1-t2v");
      } catch (e) {
        return e as SdkError;
      }
      throw new Error("expected throw");
    })();
    expect(error.code).toBe("INVALID_REQUEST");
  });

  test("listModels projects every registry entry with provider id and modality", () => {
    const { transport } = createFakeTransport([qwenResponse(["x"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const models = provider.listModels();
    expect(models.every((m) => m.providerId === "aliyun-bailian")).toBe(true);
    // 5 Qwen + 3 Wan image + 4 HappyHorse video + 1 Wan 3.0 video + 20 audio
    expect(models.length).toBe(33);
    expect(models.some((m) => m.id === "qwen-image-2.0-pro")).toBe(true);
    expect(models.some((m) => m.id === "wan2.7-image-pro")).toBe(true);
    expect(models.some((m) => m.id === "happyhorse-1.1-t2v")).toBe(true);
    expect(models.some((m) => m.id === "z-image-turbo")).toBe(false);
  });

  test("binds the dated Qwen free-quota model", () => {
    const { transport } = createFakeTransport([qwenResponse(["x"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    expect(
      provider.image("qwen-image-2.0-pro-2026-06-22").capabilities.generate
    ).toBe(true);
  });

  test("builds the T2I request URL, auth header, and body", async () => {
    const { transport, requests } = createFakeTransport([
      qwenResponse(["a.png"]),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.image(QWEN);

    await generateImage({
      model,
      prompt: "一只红狐狸",
      n: 1,
      size: "1024x1024",
      providerOptions: {
        aliyun: {
          negative_prompt: "低分辨率",
          prompt_extend: true,
          watermark: false,
          seed: 42,
        },
      },
    });

    const request = requests[0]!;
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
    );
    const headers = request.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = request.body as Record<string, unknown>;
    expect(body.model).toBe(QWEN);
    const messages = (
      (body.input as Record<string, unknown>).messages as unknown[]
    )[0] as Record<string, unknown>;
    const content = messages.content as Record<string, unknown>[];
    expect(content).toHaveLength(1);
    expect(content[0]?.text).toBe("一只红狐狸");
    const parameters = body.parameters as Record<string, unknown>;
    expect(parameters.size).toBe("1024*1024");
    expect(parameters.n).toBe(1);
    expect(parameters.negative_prompt).toBe("低分辨率");
    expect(parameters.prompt_extend).toBe(true);
    expect(parameters.watermark).toBe(false);
    expect(parameters.seed).toBe(42);
  });

  test("builds the I2I content array with images before text", async () => {
    const { transport, requests } = createFakeTransport([
      qwenResponse(["out.png"]),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.image(QWEN);

    await editImage({
      model,
      prompt: "变成黑白",
      images: [
        { url: "https://example.com/a.png" },
        { base64: "aGVsbG8=", mimeType: "image/png" },
      ],
    });

    const request = requests[0]!;
    const body = request.body as Record<string, unknown>;
    const messages = (
      (body.input as Record<string, unknown>).messages as unknown[]
    )[0] as Record<string, unknown>;
    const content = messages.content as Record<string, unknown>[];

    expect(content).toHaveLength(3);
    expect(content[0]?.image).toBe("https://example.com/a.png");
    expect(content[1]?.image).toBe("data:image/png;base64,aGVsbG8=");
    expect(content[2]?.text).toBe("变成黑白");
  });

  test("maps the Qwen response into ImageContent[] with provider/model ids", async () => {
    const { transport } = createFakeTransport([
      qwenResponse(["https://x/a.png", "https://x/b.png"]),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.image(QWEN);

    const result = await generateImage({ model, prompt: "p" });

    expect(result.provider).toBe("aliyun-bailian");
    expect(result.model).toBe(QWEN);
    expect(result.requestId).toBe("req-1");
    expect(result.content).toHaveLength(2);
    expect(result.content[0]?.url).toBe("https://x/a.png");
    expect(result.content[1]?.url).toBe("https://x/b.png");
  });

  test("classifies 401 as non-retryable AUTH_ERROR without leaking the key", async () => {
    const { transport } = createFakeTransport([
      transportResponse(401, {
        code: "InvalidApiKey",
        message: "Invalid API-key provided.",
      }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.image(QWEN);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("AUTH_ERROR");
    expect(error.retryable).toBe(false);
    expect(error.message).not.toContain("test-key");
  });

  test("classifies 429/Throttling as retryable RATE_LIMITED", async () => {
    const { transport } = createFakeTransport([
      transportResponse(429, { code: "Throttling", message: "slow down" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.image(QWEN);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  test("classifies a content-safety 400 as INVALID_REQUEST", async () => {
    const { transport } = createFakeTransport([
      transportResponse(400, {
        code: "DataInspectionFailed",
        message: "content blocked",
      }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.image(QWEN);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("INVALID_REQUEST");
  });

  test("classifies 5xx as PROVIDER_ERROR", async () => {
    const { transport } = createFakeTransport([
      transportResponse(503, { code: "InternalError", message: "down" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.image(QWEN);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
  });

  test("maps a transport timeout to TIMEOUT", async () => {
    const { transport } = createFakeTransport([transportTimeout()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.image(QWEN);

    const error = (await generateImage({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("TIMEOUT");
    expect(error.message).not.toContain("test-key");
  });

  test("Wan-family models reject without invoking the transport", async () => {
    const { transport, requests } = createFakeTransport([qwenResponse(["x"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.image("wan2.7-image-pro");

    // generate passes the capability check (generate=true) and reaches the
    // adapter, which rejects Wan as NOT_IMPLEMENTED (Phase 3 async slot).
    await expect(generateImage({ model, prompt: "p" })).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
      retryable: false,
    });
    // edit is blocked at the core pre-flight because Wan models set edit=false.
    await expect(
      editImage({ model, prompt: "p", images: [{ url: "u" }] })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects malformed generation input with INVALID_REQUEST before transport", async () => {
    const { transport, requests } = createFakeTransport([qwenResponse(["x"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    await expect(
      provider.generate({
        provider: "aliyun-bailian",
        model: QWEN,
        modality: "image",
        input: { notPrompt: true },
      } as unknown as AdapterRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });
});
