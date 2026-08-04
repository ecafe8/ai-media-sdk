import { describe, expect, test } from "bun:test";

import { readAliyunConfig, readAliyunModel } from "../src/config.js";

describe("Alibaba Bailian example configuration", () => {
  test("reports missing variables without making a request", () => {
    expect(() => readAliyunConfig({})).toThrow("ALIYUN_BAILIAN_API_KEY");
  });

  test("uses the recommended editable Qwen model by default", () => {
    expect(readAliyunModel({})).toBe("qwen-image-2.0-pro-2026-06-22");
  });

  test("builds a complete config from environment values", () => {
    expect(
      readAliyunConfig({
        ALIYUN_BAILIAN_API_KEY: "test-key",
        ALIYUN_BAILIAN_BASE_URL: "https://workspace.example/api/v1",
      })
    ).toEqual({
      apiKey: "test-key",
      baseUrl: "https://workspace.example/api/v1",
    });
  });
});
