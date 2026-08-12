import { describe, expect, test } from "bun:test";

import {
  getClientPlaygroundModels,
  getPlaygroundModel,
  PLAYGROUND_MODELS,
} from "./registry";

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

  test("does not carry drifted placeholder models", () => {
    expect(
      getPlaygroundModel("aliyun-bailian", "z-image-turbo")
    ).toBeUndefined();
    expect(
      getPlaygroundModel("aliyun-bailian", "wan2.7-t2v-2026-06-12")
    ).toBeUndefined();
    expect(
      getPlaygroundModel("aliyun-bailian", "wan2.7-r2v-2026-06-12")
    ).toBeUndefined();
  });

  test("registers the dated Qwen free-quota image model", () => {
    const model = getPlaygroundModel(
      "aliyun-bailian",
      "qwen-image-2.0-pro-2026-06-22"
    );
    expect(model?.supportsGenerate).toBe(true);
    expect(model?.supportsEdit).toBe(true);
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

  test("lists both Seedream alias ids", () => {
    const canonical = getPlaygroundModel(
      "doubao-seedream",
      "doubao-seedream-5-0-260128"
    );
    const lite = getPlaygroundModel(
      "doubao-seedream",
      "doubao-seedream-5-0-lite-260128"
    );
    expect(canonical?.maxEditImages).toBe(14);
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
  });

  test("PLAYGROUND_MODELS derives every model from the SDK registries with matching capabilities", () => {
    // gpt-image-2 is the only Azure entry; it is generate-only (no edit).
    const azure = PLAYGROUND_MODELS.filter(
      (m) => m.provider === "azure-openai"
    );
    expect(azure).toHaveLength(1);
    expect(azure[0]?.id).toBe("gpt-image-2");
    expect(azure[0]?.supportsGenerate).toBe(true);
    expect(azure[0]?.supportsEdit).toBe(false);

    // No duplicate ids remain.
    const ids = PLAYGROUND_MODELS.map((m) => `${m.provider}:${m.id}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("excludes wan3.0-video from the Playground projection until its media UI exists", () => {
    expect(
      getPlaygroundModel("aliyun-bailian", "wan3.0-video")
    ).toBeUndefined();
    expect(
      PLAYGROUND_MODELS.find((m) => m.id === "wan3.0-video")
    ).toBeUndefined();
  });

  test("registers MiniMax-H3 as a multi-scenario async video model", () => {
    const model = getPlaygroundModel("minimax", "MiniMax-H3");
    expect(model?.modality).toBe("video");
    expect(model?.supportsVideo).toBe(true);
    expect(model?.supportsAsync).toBe(true);
    expect(model?.supportsEdit).toBe(false);
    expect(model?.family).toBe("minimax-h3-video");
    expect(model?.videoScenarios).toEqual(["t2v", "i2v", "r2v"]);
    expect(model?.maxReferenceImages).toBe(9);
    expect(model?.maxReferenceVideos).toBe(3);
    expect(model?.maxReferenceAudios).toBe(3);
    expect(model?.supportedResolutions).toEqual(["768P", "2K"]);
    expect(model?.supportedAspectRatios).toContain("adaptive");
    expect(model?.supportedAspectRatios).toContain("16:9");
  });

  test("marks MiniMax configured only when the minimax provider is configured", () => {
    const models = getClientPlaygroundModels(new Set(["minimax"]));
    const h3 = models.find((model) => model.id === "MiniMax-H3");
    expect(h3?.configured).toBe(true);
    const t2v = models.find((model) => model.id === "happyhorse-1.1-t2v");
    expect(t2v?.configured).toBe(false);
  });
});
