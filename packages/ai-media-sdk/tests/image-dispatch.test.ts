/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  type AdapterRequest,
  editImage,
  type GenerationResult,
  generateImage,
  type ImageContent,
  type ImageModelInstance,
  type ProviderAdapter,
} from "@ai-media/sdk";

function createFakeAdapter(): {
  adapter: ProviderAdapter<ImageContent[]>;
  getCount: () => number;
  getEditCount: () => number;
  lastRequest: () => AdapterRequest | undefined;
} {
  let count = 0;
  let editCount = 0;
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
    async edit(
      request: AdapterRequest
    ): Promise<GenerationResult<ImageContent[]>> {
      editCount += 1;
      last = request;
      return {
        content: [{ url: "https://example.com/edited.png" }],
        provider: "fake",
        model: request.model,
        requestId: "edit-1",
      };
    },
  };
  return {
    adapter,
    getCount: () => count,
    getEditCount: () => editCount,
    lastRequest: () => last,
  };
}

function createModel(
  capabilities: {
    generate?: boolean;
    edit?: boolean;
    maxEditImages?: number;
    supportedSizes?: readonly string[];
    maxResolution?: { readonly width: number; readonly height: number };
    maxN?: number;
  } = {}
): { model: ImageModelInstance } & ReturnType<typeof createFakeAdapter> {
  const fake = createFakeAdapter();
  const model: ImageModelInstance = {
    providerId: "fake",
    modelId: "test-model",
    adapter: fake.adapter,
    capabilities: {
      modality: "image",
      generate: capabilities.generate ?? true,
      edit: capabilities.edit ?? false,
      maxEditImages: capabilities.maxEditImages,
      supportedSizes: capabilities.supportedSizes,
      maxResolution: capabilities.maxResolution,
      maxN: capabilities.maxN,
    },
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

  test("editImage dispatches to the bound adapter and returns its result", async () => {
    const { model, getEditCount, lastRequest } = createModel({
      edit: true,
      maxEditImages: 3,
    });

    const result = await editImage({
      model,
      prompt: "make it black and white",
      images: [{ url: "https://example.com/input.png" }],
    });

    expect(getEditCount()).toBe(1);
    const req = lastRequest();
    expect(req?.modality).toBe("image");
    expect(result.content[0]?.url).toBe("https://example.com/edited.png");
    expect(result.model).toBe("test-model");
  });

  test("editImage rejects with INVALID_REQUEST for a non-editable model", async () => {
    const { model, getEditCount } = createModel({
      generate: true,
      edit: false,
    });

    await expect(
      editImage({ model, prompt: "p", images: [{ url: "u" }] })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getEditCount()).toBe(0);
  });

  test("editImage rejects with INVALID_REQUEST for an out-of-range image count", async () => {
    const { model, getEditCount } = createModel({
      edit: true,
      maxEditImages: 3,
    });

    await expect(
      editImage({ model, prompt: "p", images: [] })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      editImage({
        model,
        prompt: "p",
        images: [{ url: "a" }, { url: "b" }, { url: "c" }, { url: "d" }],
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(getEditCount()).toBe(0);
  });
});
