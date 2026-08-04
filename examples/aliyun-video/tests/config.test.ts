import { describe, expect, test } from "bun:test";

import { readAliyunVideoConfig, readAliyunVideoModel } from "../src/config.js";

describe("Aliyun HappyHorse video example configuration", () => {
  test("reports missing variables without making a request", () => {
    expect(() => readAliyunVideoConfig({})).toThrow("ALIYUN_BAILIAN_API_KEY");
  });

  test("uses the HappyHorse t2v model by default", () => {
    expect(readAliyunVideoModel({})).toBe("happyhorse-1.1-t2v");
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
