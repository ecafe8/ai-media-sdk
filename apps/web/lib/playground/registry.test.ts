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
    expect(model?.supportsAsync).toBe(false);
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

  test("registers HappyHorse t2v/i2v as available video models", () => {
    const t2v = getPlaygroundModel("aliyun-bailian", "happyhorse-1.1-t2v");
    expect(t2v?.modality).toBe("video");
    expect(t2v?.supportsVideo).toBe(true);
    expect(t2v?.requiresFirstFrame).toBe(false);

    const i2v = getPlaygroundModel("aliyun-bailian", "happyhorse-1.1-i2v");
    expect(i2v?.supportsVideo).toBe(true);
    expect(i2v?.requiresFirstFrame).toBe(true);
  });

  test("registers HappyHorse r2v and video-edit as available video models", () => {
    const r2v = getPlaygroundModel("aliyun-bailian", "happyhorse-1.1-r2v");
    expect(r2v?.modality).toBe("video");
    expect(r2v?.supportsVideo).toBe(true);
    expect(r2v?.maxReferenceImages).toBe(9);
    expect(r2v?.requiresInputVideo).toBeFalsy();

    const edit = getPlaygroundModel(
      "aliyun-bailian",
      "happyhorse-1.0-video-edit"
    );
    expect(edit?.supportsVideo).toBe(true);
    expect(edit?.requiresInputVideo).toBe(true);
    expect(edit?.maxReferenceImages).toBe(5);
  });

  test("registers supported Wan image models as async image models", () => {
    for (const id of ["wan2.7-image-pro", "wan2.7-image"]) {
      const model = getPlaygroundModel("aliyun-bailian", id);
      expect(model?.modality).toBe("image");
      expect(model?.supportsAsync).toBe(true);
    }
    expect(
      getPlaygroundModel("aliyun-bailian", "z-image-turbo")?.supportsAsync
    ).toBe(false);
  });
});
