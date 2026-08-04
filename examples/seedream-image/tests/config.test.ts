import { describe, expect, test } from "bun:test";

import { readSeedreamConfig, readSeedreamModels } from "../src/config.js";

describe("Doubao-Seedream example configuration", () => {
  test("reports missing variables without making a request", () => {
    expect(() => readSeedreamConfig({})).toThrow("ARK_API_KEY");
  });

  test("uses the recommended Seedream 5.0 pro model by default", () => {
    expect(readSeedreamModels({})).toEqual(["doubao-seedream-5-0-pro-260628"]);
  });

  test("parses a comma-separated model list", () => {
    expect(
      readSeedreamModels({
        SEEDREAM_MODEL:
          "doubao-seedream-5-0-pro-260628, doubao-seedream-4-5-251128",
      })
    ).toEqual(["doubao-seedream-5-0-pro-260628", "doubao-seedream-4-5-251128"]);
  });

  test("builds a minimal config from only the API key", () => {
    expect(readSeedreamConfig({ ARK_API_KEY: "test-key" })).toEqual({
      apiKey: "test-key",
    });
  });

  test("forwards an explicit base URL when provided", () => {
    expect(
      readSeedreamConfig({
        ARK_API_KEY: "test-key",
        ARK_BASE_URL: "https://ark.example/api/v3",
      })
    ).toEqual({
      apiKey: "test-key",
      baseUrl: "https://ark.example/api/v3",
    });
  });
});
