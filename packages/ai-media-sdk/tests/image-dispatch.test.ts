/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  SdkError,
  editImage,
  generateImage,
  type AdapterRequest,
  type GenerationResult,
  type ImageContent,
  type ImageModelInstance,
  type ProviderAdapter,
} from "@ai-media/sdk";

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
      throw new SdkError({ code: "NOT_IMPLEMENTED", message: "no edit" });
    },
  };
  return { adapter, getCount: () => count, lastRequest: () => last };
}

function createModel(
  capabilities: { generate: boolean; edit: boolean } = {
    generate: true,
    edit: false,
  }
): { model: ImageModelInstance } & ReturnType<typeof createFakeAdapter> {
  const fake = createFakeAdapter();
  const model: ImageModelInstance = {
    providerId: "fake",
    modelId: "test-model",
    adapter: fake.adapter,
    capabilities: { modality: "image", ...capabilities },
  };
  return { model, ...fake };
}

describe("core image dispatch", () => {
  test("generateImage dispatches to the bound adapter and returns its result", async () => {
    const { model, getCount, lastRequest } = createModel();

    const result = await generateImage({
      model,
      prompt: "a red fox",
      n: 1,
      size: "1024x1024",
    });

    expect(getCount()).toBe(1);
    const req = lastRequest();
    expect(req?.provider).toBe("fake");
    expect(req?.model).toBe("test-model");
    expect(req?.modality).toBe("image");
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.url).toBe("https://example.com/image.png");
    expect(result.provider).toBe("fake");
    expect(result.model).toBe("test-model");
  });

  test("generateImage rejects with INVALID_REQUEST for an empty prompt before dispatch", async () => {
    const { model, getCount } = createModel();

    await expect(generateImage({ model, prompt: "" })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
    expect(getCount()).toBe(0);
  });

  test("generateImage rejects with INVALID_REQUEST for a non-positive n before dispatch", async () => {
    const { model, getCount } = createModel();

    await expect(
      generateImage({ model, prompt: "p", n: 0 })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getCount()).toBe(0);
  });

  test("generateImage rejects with INVALID_REQUEST for a model that cannot generate", async () => {
    const { model, getCount } = createModel({
      generate: false,
      edit: false,
    });

    await expect(generateImage({ model, prompt: "p" })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
    expect(getCount()).toBe(0);
  });

  test("editImage rejects with NOT_IMPLEMENTED even when the model claims edit capability", async () => {
    const { model } = createModel({ generate: true, edit: true });

    await expect(
      editImage({ model, prompt: "p", image: {} })
    ).rejects.toMatchObject({ code: "NOT_IMPLEMENTED", retryable: false });
  });
});
