/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { readExampleConfig } from "../src/config.js";

describe("uploader-aliyun example config", () => {
  test("reads required env and applies defaults", () => {
    const config = readExampleConfig(
      {
        ALIYUN_BAILIAN_API_KEY: "sk-key",
        ALIYUN_BAILIAN_BASE_URL: "https://ws.cn-beijing.maas.aliyuncs.com/api/v1",
        UPLOADER_ALIYUN_IMAGE_PATH: "/tmp/cat.png",
      },
      []
    );
    expect(config.provider.apiKey).toBe("sk-key");
    expect(config.provider.baseUrl).toBe(
      "https://ws.cn-beijing.maas.aliyuncs.com/api/v1"
    );
    expect(config.model).toBe("qwen-image-2.0-pro");
    expect(config.imagePath).toBe("/tmp/cat.png");
    expect(config.prompt).toBe("把这张图片转换为水彩画风格");
  });

  test("image path can come from CLI argv", () => {
    const config = readExampleConfig(
      {
        ALIYUN_BAILIAN_API_KEY: "sk-key",
        ALIYUN_BAILIAN_BASE_URL: "https://ws.maas.aliyuncs.com/api/v1",
      },
      ["./local.png"]
    );
    expect(config.imagePath).toBe("./local.png");
  });

  test("missing API key throws actionable error without secrets", () => {
    expect(() =>
      readExampleConfig(
        {
          ALIYUN_BAILIAN_BASE_URL: "https://ws.maas.aliyuncs.com/api/v1",
          UPLOADER_ALIYUN_IMAGE_PATH: "/tmp/x.png",
        },
        []
      )
    ).toThrow(/ALIYUN_BAILIAN_API_KEY/);
  });

  test("missing base URL throws actionable error", () => {
    expect(() =>
      readExampleConfig(
        {
          ALIYUN_BAILIAN_API_KEY: "sk-key",
          UPLOADER_ALIYUN_IMAGE_PATH: "/tmp/x.png",
        },
        []
      )
    ).toThrow(/ALIYUN_BAILIAN_BASE_URL/);
  });

  test("missing image path throws actionable error", () => {
    expect(() =>
      readExampleConfig(
        {
          ALIYUN_BAILIAN_API_KEY: "sk-key",
          ALIYUN_BAILIAN_BASE_URL: "https://ws.maas.aliyuncs.com/api/v1",
        },
        []
      )
    ).toThrow(/UPLOADER_ALIYUN_IMAGE_PATH/);
  });

  test("error message never leaks the API key", () => {
    let message = "";
    try {
      readExampleConfig(
        {
          ALIYUN_BAILIAN_API_KEY: "sk-secret-key-123",
          UPLOADER_ALIYUN_IMAGE_PATH: "/tmp/x.png",
        },
        []
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain("sk-secret-key-123");
  });

  test("custom prompt overrides default", () => {
    const config = readExampleConfig(
      {
        ALIYUN_BAILIAN_API_KEY: "sk-key",
        ALIYUN_BAILIAN_BASE_URL: "https://ws.maas.aliyuncs.com/api/v1",
        UPLOADER_ALIYUN_IMAGE_PATH: "/tmp/cat.png",
        UPLOADER_ALIYUN_PROMPT: "describe in one sentence",
      },
      []
    );
    expect(config.prompt).toBe("describe in one sentence");
  });
});
