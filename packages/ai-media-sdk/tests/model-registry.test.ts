/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  collectSupportedModels,
  findSupportedModel,
  isSupportedModel,
  type ModelListable,
  type ModelRegistry,
} from "@ai-media/sdk";

const imageCap = { modality: "image", generate: true, edit: false } as const;

const aliyunRegistry: ModelRegistry = {
  providerId: "aliyun-bailian",
  models: [
    {
      providerId: "aliyun-bailian",
      id: "qwen-image-2.0-pro",
      modality: "image",
      capabilities: imageCap,
    },
    {
      providerId: "aliyun-bailian",
      id: "wan2.7-image",
      modality: "image",
      capabilities: imageCap,
    },
  ],
};

const volcengineRegistry: ModelRegistry = {
  providerId: "volcengine",
  models: [
    {
      providerId: "volcengine",
      id: "doubao-seedream-5-0-pro-260628",
      modality: "image",
      capabilities: imageCap,
    },
  ],
};

const azureListable: ModelListable = {
  providerId: "azure-openai",
  listModels: () => [
    {
      providerId: "azure-openai",
      id: "gpt-image-2",
      modality: "image",
      capabilities: imageCap,
    },
  ],
};

describe("model-registry aggregation contract", () => {
  test("collectSupportedModels merges consts and ModelListable instances in source order", () => {
    const models = collectSupportedModels(
      aliyunRegistry,
      volcengineRegistry,
      azureListable
    );

    expect(models.map((m) => m.id)).toEqual([
      "qwen-image-2.0-pro",
      "wan2.7-image",
      "doubao-seedream-5-0-pro-260628",
      "gpt-image-2",
    ]);
  });

  test("collectSupportedModels keeps only the first occurrence of a duplicate (providerId, id)", () => {
    const dupRegistry: ModelRegistry = {
      providerId: "aliyun-bailian",
      models: [
        {
          providerId: "aliyun-bailian",
          id: "qwen-image-2.0-pro",
          modality: "image",
          capabilities: imageCap,
        },
      ],
    };
    const models = collectSupportedModels(aliyunRegistry, dupRegistry);

    expect(models.filter((m) => m.id === "qwen-image-2.0-pro")).toHaveLength(1);
  });

  test("collectSupportedModels does not dedupe the same id across different providers", () => {
    const otherProvider: ModelRegistry = {
      providerId: "other-provider",
      models: [
        {
          providerId: "other-provider",
          id: "qwen-image-2.0-pro",
          modality: "image",
          capabilities: imageCap,
        },
      ],
    };
    const models = collectSupportedModels(aliyunRegistry, otherProvider);

    expect(models.filter((m) => m.id === "qwen-image-2.0-pro")).toHaveLength(2);
  });

  test("findSupportedModel locates a known model and returns undefined for an unknown one", () => {
    const models = collectSupportedModels(aliyunRegistry, volcengineRegistry);

    expect(
      findSupportedModel(models, "aliyun-bailian", "qwen-image-2.0-pro")?.id
    ).toBe("qwen-image-2.0-pro");
    expect(
      findSupportedModel(models, "aliyun-bailian", "not-a-real-model")
    ).toBeUndefined();
  });

  test("isSupportedModel returns a boolean", () => {
    const models = collectSupportedModels(aliyunRegistry, azureListable);

    expect(isSupportedModel(models, "azure-openai", "gpt-image-2")).toBe(true);
    expect(isSupportedModel(models, "azure-openai", "not-a-real-model")).toBe(
      false
    );
  });
});
