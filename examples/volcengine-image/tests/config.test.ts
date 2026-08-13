import { describe, expect, test } from "bun:test";

import { readVolcengineConfig, readVolcengineModels } from "../src/config.js";

describe("Volcengine Ark example configuration", () => {
  test("reports missing variables without making a request", () => {
    expect(() => readVolcengineConfig({})).toThrow("ARK_API_KEY");
  });

  test("uses the recommended Seedream 5.0 pro model by default", () => {
    expect(readVolcengineModels({})).toEqual([
      "doubao-seedream-5-0-pro-260628",
    ]);
  });

  test("parses a comma-separated model list", () => {
    expect(
      readVolcengineModels({
        VOLCENGINE_IMAGE_MODEL:
          "doubao-seedream-5-0-pro-260628, doubao-seedream-4-5-251128",
      })
    ).toEqual(["doubao-seedream-5-0-pro-260628", "doubao-seedream-4-5-251128"]);
  });

  test("builds a minimal config from only the API key", () => {
    expect(readVolcengineConfig({ ARK_API_KEY: "test-key" })).toEqual({
      apiKey: "test-key",
    });
  });

  test("forwards an explicit base URL when provided", () => {
    expect(
      readVolcengineConfig({
        ARK_API_KEY: "test-key",
        ARK_BASE_URL: "https://ark.example/api/v3",
      })
    ).toEqual({
      apiKey: "test-key",
      baseUrl: "https://ark.example/api/v3",
    });
  });
});
