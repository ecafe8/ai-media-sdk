import { describe, expect, test } from "bun:test";

import { getClientPlaygroundModels, getPlaygroundModel } from "./registry";

describe("Playground capability registry", () => {
  test("marks only configured Providers as available", () => {
    const models = getClientPlaygroundModels(new Set(["aliyun-bailian"]));
    expect(
      models.find((model) => model.id === "qwen-image-2.0-pro")?.configured
    ).toBe(true);
    expect(models.find((model) => model.id === "gpt-image-2")?.configured).toBe(
      false
    );
  });

  test("keeps z-image-turbo generation-only", () => {
    const model = getPlaygroundModel("aliyun-bailian", "z-image-turbo");
    expect(model?.supportsGenerate).toBe(true);
    expect(model?.supportsEdit).toBe(false);
  });

  test("registers the dated Qwen free-quota image model", () => {
    const model = getPlaygroundModel(
      "aliyun-bailian",
      "qwen-image-2.0-pro-2026-06-22"
    );
    expect(model?.supportsGenerate).toBe(true);
    expect(model?.supportsEdit).toBe(true);
  });

  test("lists video models as unavailable to the image Playground", () => {
    const model = getPlaygroundModel("aliyun-bailian", "wan2.7-t2v-2026-06-12");
    expect(model?.supportsGenerate).toBe(false);
  });

  test("registers Seedream 5.0 pro as editable with max 10 images", () => {
    const model = getPlaygroundModel(
      "doubao-seedream",
      "doubao-seedream-5-0-pro-260628"
    );
    expect(model?.supportsGenerate).toBe(true);
    expect(model?.supportsEdit).toBe(true);
    expect(model?.maxEditImages).toBe(10);
  });

  test("registers the Seedream 5.0 lite alias and 4.x models", () => {
    const lite = getPlaygroundModel(
      "doubao-seedream",
      "doubao-seedream-5-0-lite-260128"
    );
    expect(lite?.maxEditImages).toBe(14);
    const model45 = getPlaygroundModel(
      "doubao-seedream",
      "doubao-seedream-4-5-251128"
    );
    expect(model45?.supportsEdit).toBe(true);
    const model40 = getPlaygroundModel(
      "doubao-seedream",
      "doubao-seedream-4-0-250828"
    );
    expect(model40?.supportsGenerate).toBe(true);
  });

  test("marks Seedream models configured only when the provider is configured", () => {
    const models = getClientPlaygroundModels(new Set(["doubao-seedream"]));
    const pro = models.find(
      (model) => model.id === "doubao-seedream-5-0-pro-260628"
    );
    expect(pro?.configured).toBe(true);
    const qwen = models.find((model) => model.id === "qwen-image-2.0-pro");
    expect(qwen?.configured).toBe(false);
  });
});
