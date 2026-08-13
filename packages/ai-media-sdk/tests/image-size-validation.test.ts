/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  type AdapterRequest,
  editImage,
  type GenerationResult,
  generateImage,
  type ImageContent,
  type ImageModelInstance,
  type ModelCapability,
  type ProviderAdapter,
  pixelSize,
  SdkError,
  submitImageTask,
  type TaskHandle,
  tierSize,
} from "@ai-media/sdk";

/**
 * Pre-flight size/maxN validation contract tests for `generateImage`.
 *
 * These tests do not invoke any network call: the fake adapter throws if it
 * ever receives a request, so any case that passes validation but dispatches
 * will fail loudly. Each branch of `validateSize`/`validateN` is covered.
 */

function createFakeAdapter(): {
  adapter: ProviderAdapter<ImageContent[]>;
  getCount: () => number;
  lastRequest: () => AdapterRequest | undefined;
} {
  let count = 0;
  let last: AdapterRequest | undefined;
  const adapter: ProviderAdapter<ImageContent[]> = {
    providerId: "fake",
    async generate(
      request: AdapterRequest
    ): Promise<GenerationResult<ImageContent[]>> {
      count += 1;
      last = request;
      return {
        content: [{ url: "https://example.com/image.png" }],
        provider: "fake",
        model: request.model,
        requestId: "req-1",
      };
    },
    async edit(): Promise<GenerationResult<ImageContent[]>> {
      throw new SdkError({
        code: "NOT_IMPLEMENTED",
        message: "edit not used in size-validation tests",
      });
    },
  };
  return {
    adapter,
    getCount: () => count,
    lastRequest: () => last,
  };
}

function createModel(
  capabilities: Pick<
    ModelCapability,
    "supportedSizes" | "maxResolution" | "maxN"
  > & { generate?: boolean }
): { model: ImageModelInstance } & ReturnType<typeof createFakeAdapter> {
  const fake = createFakeAdapter();
  const model: ImageModelInstance = {
    providerId: "fake",
    modelId: "test-model",
    adapter: fake.adapter,
    capabilities: {
      modality: "image",
      generate: capabilities.generate ?? true,
      edit: false,
      supportedSizes: capabilities.supportedSizes,
      maxResolution: capabilities.maxResolution,
      maxN: capabilities.maxN,
    },
  };
  return { model, ...fake };
}

function createAsyncModel(
  capabilities: Pick<
    ModelCapability,
    "supportedSizes" | "maxResolution" | "maxN"
  >
): { model: ImageModelInstance; submitCount: () => number } {
  let count = 0;
  const handle: TaskHandle<ImageContent[]> = {
    taskId: "task-1",
    status: "pending",
    wait: () =>
      Promise.resolve({
        content: [{ url: "https://example.com/image.png" }],
        provider: "fake",
        model: "async-test-model",
        requestId: "req-1",
      }),
  };
  const adapter: ProviderAdapter<ImageContent[]> = {
    providerId: "fake",
    async generate(): Promise<GenerationResult<ImageContent[]>> {
      throw new SdkError({
        code: "NOT_IMPLEMENTED",
        message: "generate not used in async size-validation tests",
      });
    },
    async edit(): Promise<GenerationResult<ImageContent[]>> {
      throw new SdkError({
        code: "NOT_IMPLEMENTED",
        message: "edit not used in async size-validation tests",
      });
    },
    async submit(): Promise<TaskHandle<ImageContent[]>> {
      count += 1;
      return handle;
    },
  };
  const model: ImageModelInstance = {
    providerId: "fake",
    modelId: "async-test-model",
    adapter,
    capabilities: {
      modality: "image",
      generate: true,
      edit: false,
      async: true,
      supportedSizes: capabilities.supportedSizes,
      maxResolution: capabilities.maxResolution,
      maxN: capabilities.maxN,
    },
  };
  return { model, submitCount: () => count };
}

describe("generateImage size validation", () => {
  test("tier value in supportedSizes passes", async () => {
    const { model, getCount } = createModel({
      supportedSizes: ["1K", "2K", "4K"],
    });

    await generateImage({ model, prompt: "p", size: "2K" });
    expect(getCount()).toBe(1);
  });

  test("tier value outside supportedSizes is rejected before dispatch", async () => {
    const { model, getCount } = createModel({
      supportedSizes: ["1K", "2K", "4K"],
    });

    await expect(
      generateImage({ model, prompt: "p", size: "8K" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });

  test("pixel size within maxResolution passes", async () => {
    const { model, getCount } = createModel({
      maxResolution: { width: 2048, height: 2048 },
    });

    await generateImage({ model, prompt: "p", size: "1024x1024" });
    expect(getCount()).toBe(1);
  });

  test("pixel size exceeding maxResolution is rejected before dispatch", async () => {
    const { model, getCount } = createModel({
      maxResolution: { width: 2048, height: 2048 },
    });

    await expect(
      generateImage({ model, prompt: "p", size: "4096x4096" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });

  test("star separator is accepted as pixel form", async () => {
    const { model, getCount } = createModel({
      maxResolution: { width: 2048, height: 2048 },
    });

    await generateImage({ model, prompt: "p", size: "1024*1024" });
    expect(getCount()).toBe(1);
  });

  test("non-pixel value is rejected when only maxResolution is defined", async () => {
    const { model, getCount } = createModel({
      maxResolution: { width: 2048, height: 2048 },
    });

    await expect(
      generateImage({ model, prompt: "p", size: "huge" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });

  test("tier-then-pixel fallback: tier value passes, pixel within cap passes", async () => {
    const { model, getCount } = createModel({
      supportedSizes: ["1K", "2K"],
      maxResolution: { width: 2048, height: 2048 },
    });

    await generateImage({ model, prompt: "p", size: "2K" });
    await generateImage({ model, prompt: "p", size: "1024x1024" });
    expect(getCount()).toBe(2);
  });

  test("tier-then-pixel fallback: pixel exceeding cap is rejected", async () => {
    const { model, getCount } = createModel({
      supportedSizes: ["1K", "2K"],
      maxResolution: { width: 2048, height: 2048 },
    });

    await expect(
      generateImage({ model, prompt: "p", size: "4096x4096" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });

  test("tier-then-pixel fallback: non-pixel non-tier value is rejected", async () => {
    const { model, getCount } = createModel({
      supportedSizes: ["1K", "2K"],
      maxResolution: { width: 2048, height: 2048 },
    });

    await expect(
      generateImage({ model, prompt: "p", size: "huge" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });

  test("undefined size always passes", async () => {
    const { model, getCount } = createModel({
      supportedSizes: ["1K", "2K"],
      maxResolution: { width: 2048, height: 2048 },
    });

    await generateImage({ model, prompt: "p" });
    expect(getCount()).toBe(1);
  });

  test("backwards-compatible pass-through for untyped models", async () => {
    const { model, getCount } = createModel({});

    await generateImage({ model, prompt: "p", size: "anything-goes" });
    expect(getCount()).toBe(1);
  });

  test("size lookup is case-sensitive", async () => {
    const { model, getCount } = createModel({
      supportedSizes: ["1K", "2K"],
    });

    await expect(
      generateImage({ model, prompt: "p", size: "2k" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });
});

describe("generateImage n validation", () => {
  test("n within maxN passes", async () => {
    const { model, getCount } = createModel({ maxN: 6 });

    await generateImage({ model, prompt: "p", n: 4 });
    expect(getCount()).toBe(1);
  });

  test("n exceeding maxN is rejected before dispatch", async () => {
    const { model, getCount } = createModel({ maxN: 6 });

    await expect(
      generateImage({ model, prompt: "p", n: 8 })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });

  test("maxN undefined keeps positive-integer floor", async () => {
    const { model, getCount } = createModel({});

    await expect(
      generateImage({ model, prompt: "p", n: 0 })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });

  test("non-integer n is rejected when maxN is defined", async () => {
    const { model, getCount } = createModel({ maxN: 6 });

    await expect(
      generateImage({ model, prompt: "p", n: 2.5 })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });
});

describe("submitImageTask size validation", () => {
  test("async entry point enforces the same supportedSizes pre-flight", async () => {
    const { model, submitCount } = createAsyncModel({
      supportedSizes: ["1K", "2K"],
    });

    await submitImageTask({ model, prompt: "p", size: "2K" });
    expect(submitCount()).toBe(1);

    await expect(
      submitImageTask({ model, prompt: "p", size: "8K" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(submitCount()).toBe(1);
  });

  test("async entry point enforces maxResolution for pixel sizes", async () => {
    const { model, submitCount } = createAsyncModel({
      maxResolution: { width: 1440, height: 1440 },
    });

    await submitImageTask({ model, prompt: "p", size: "1280*1280" });
    expect(submitCount()).toBe(1);

    // Tier value on a pixel-only model is rejected before dispatch.
    await expect(
      submitImageTask({ model, prompt: "p", size: "2K" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      submitImageTask({ model, prompt: "p", size: "2048x2048" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(submitCount()).toBe(1);
  });

  test("async entry point enforces maxN", async () => {
    const { model, submitCount } = createAsyncModel({ maxN: 4 });

    await submitImageTask({ model, prompt: "p", n: 4 });
    expect(submitCount()).toBe(1);

    await expect(
      submitImageTask({ model, prompt: "p", n: 5 })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(submitCount()).toBe(1);
  });
});

describe("size helper functions", () => {
  test("pixelSize produces the wire format", () => {
    expect(pixelSize(1024, 1024)).toBe("1024x1024");
    expect(pixelSize(1536, 1024)).toBe("1536x1024");
  });

  test("tierSize passes the tier identifier verbatim", () => {
    expect(tierSize("2K")).toBe("2K");
    expect(tierSize("1080P")).toBe("1080P");
  });
});

describe("editImage capability gating still throws when called on non-edit model", () => {
  test("editImage is unrelated to size validation and still gated by capabilities.edit", async () => {
    const { model } = createModel({});

    await expect(
      editImage({ model, prompt: "p", images: [{ url: "u" }] })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});
