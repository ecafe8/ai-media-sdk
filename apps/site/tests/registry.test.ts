import { describe, expect, test } from "bun:test";

import { getSiteModel, SITE_MODELS } from "@/lib/playground/registry";

describe("site model projection", () => {
  test("excludes wan3.0-video until heterogeneous media UI exists", () => {
    expect(SITE_MODELS.some((m) => m.id === "wan3.0-video")).toBe(false);
    expect(getSiteModel("aliyun-bailian", "wan3.0-video")).toBeUndefined();
  });

  test("projects models from all three providers", () => {
    expect(getSiteModel("azure-openai", "gpt-image-2")).toBeDefined();
    expect(getSiteModel("aliyun-bailian", "qwen-image-2.0-pro")).toBeDefined();
    expect(
      getSiteModel("doubao-seedream", "doubao-seedream-4-5-251128")
    ).toBeDefined();
  });

  test("every projected model carries a non-empty label", () => {
    for (const model of SITE_MODELS) {
      expect(model.label.length).toBeGreaterThan(0);
    }
  });

  test("video models are aliyun-only and expose media metadata", () => {
    const videos = SITE_MODELS.filter((m) => m.modality === "video");
    expect(videos.length).toBeGreaterThan(0);
    for (const video of videos) {
      expect(video.provider).toBe("aliyun-bailian");
    }
    const r2v = getSiteModel("aliyun-bailian", "happyhorse-1.1-r2v");
    expect(r2v?.maxReferenceImages).toBeGreaterThan(0);
    const i2v = getSiteModel("aliyun-bailian", "happyhorse-1.1-i2v");
    expect(i2v?.requiresFirstFrame).toBe(true);
    const videoEdit = getSiteModel(
      "aliyun-bailian",
      "happyhorse-1.0-video-edit"
    );
    expect(videoEdit?.requiresInputVideo).toBe(true);
  });

  test("unknown models return undefined", () => {
    expect(getSiteModel("azure-openai", "nope")).toBeUndefined();
  });
});
