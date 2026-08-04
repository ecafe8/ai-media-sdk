import { describe, expect, test } from "bun:test";

import { readAzureConfig } from "../src/config.js";

describe("Azure example configuration", () => {
  test("reports missing variables without making a request", () => {
    expect(() => readAzureConfig({})).toThrow("AZURE_OPENAI_API_KEY");
  });

  test("builds a complete config from environment values", () => {
    expect(
      readAzureConfig({
        AZURE_OPENAI_API_KEY: "test-key",
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
        AZURE_OPENAI_API_VERSION: "2024-02-01",
        AZURE_OPENAI_DEPLOYMENT: "gpt-image-2",
      })
    ).toEqual({
      apiKey: "test-key",
      endpoint: "https://example.openai.azure.com",
      apiVersion: "2024-02-01",
    });
  });
});
