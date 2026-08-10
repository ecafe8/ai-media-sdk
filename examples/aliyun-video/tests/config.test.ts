import { describe, expect, test } from "bun:test";

import {
  readAliyunVideoConfig,
  readAliyunVideoExampleInputs,
  readAliyunVideoModels,
} from "../src/config.js";

describe("Aliyun HappyHorse video example configuration", () => {
  test("reports missing variables without making a request", () => {
    expect(() => readAliyunVideoConfig({})).toThrow("ALIYUN_BAILIAN_API_KEY");
  });

  test("uses the HappyHorse t2v model by default", () => {
    expect(readAliyunVideoModels({})).toEqual(["happyhorse-1.1-t2v"]);
  });

  test("parses a comma-separated video model list", () => {
    expect(
      readAliyunVideoModels({
        ALIYUN_BAILIAN_VIDEO_MODEL: "happyhorse-1.1-t2v, happyhorse-1.1-i2v",
      })
    ).toEqual(["happyhorse-1.1-t2v", "happyhorse-1.1-i2v"]);
  });

  test("builds a complete config from environment values", () => {
    expect(
      readAliyunVideoConfig({
        ALIYUN_BAILIAN_API_KEY: "test-key",
        ALIYUN_BAILIAN_BASE_URL: "https://workspace.example/api/v1",
      })
    ).toEqual({
      apiKey: "test-key",
      baseUrl: "https://workspace.example/api/v1",
    });
  });

  test("reads example inputs for i2v/r2v and video-edit", () => {
    expect(readAliyunVideoExampleInputs({})).toEqual({
      firstFrameUrl: undefined,
      referenceImageUrls: [],
      inputVideoUrl: undefined,
    });
    expect(
      readAliyunVideoExampleInputs({
        ALIYUN_BAILIAN_REFERENCE_IMAGE_URLS: "https://x/a.png, https://x/b.png",
        ALIYUN_BAILIAN_INPUT_VIDEO_URL: "https://x/source.mp4",
      })
    ).toEqual({
      firstFrameUrl: "https://x/a.png",
      referenceImageUrls: ["https://x/a.png", "https://x/b.png"],
      inputVideoUrl: "https://x/source.mp4",
    });
    expect(
      readAliyunVideoExampleInputs({
        ALIYUN_BAILIAN_FIRST_FRAME_URL: "https://x/first.png",
        ALIYUN_BAILIAN_REFERENCE_IMAGE_URLS:
          "https://x/ref1.png, https://x/ref2.png",
      })
    ).toEqual({
      firstFrameUrl: "https://x/first.png",
      referenceImageUrls: ["https://x/ref1.png", "https://x/ref2.png"],
      inputVideoUrl: undefined,
    });
  });
});
