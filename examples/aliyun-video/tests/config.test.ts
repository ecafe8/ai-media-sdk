import { describe, expect, test } from "bun:test";

import { readAliyunVideoConfig, readAliyunVideoModels } from "../src/config.js";

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
});
