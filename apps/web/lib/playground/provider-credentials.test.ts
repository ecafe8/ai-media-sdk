import { describe, expect, test } from "bun:test";

import type { AppConfig } from "@/lib/config";
import {
  isProviderConfiguredByEnv,
  PlaygroundConfigurationError,
  resolveAliyunCredentials,
  resolveAzureCredentials,
  resolveSeedreamCredentials,
} from "./provider-credentials";

const EMPTY_CONFIG: AppConfig = {
  PLAYGROUND_PROVIDER_TIMEOUT_MS: 120_000,
};

const FULL_CONFIG: AppConfig = {
  AZURE_OPENAI_API_KEY: "env-azure-key",
  AZURE_OPENAI_ENDPOINT: "https://env.cognitiveservices.azure.com",
  AZURE_OPENAI_API_VERSION: "2024-02-01",
  AZURE_OPENAI_DEPLOYMENT: "gpt-image-2",
  ALIYUN_BAILIAN_API_KEY: "env-aliyun-key",
  ALIYUN_BAILIAN_BASE_URL: "https://env.maas.aliyuncs.com/api/v1",
  ARK_API_KEY: "env-ark-key",
  ARK_BASE_URL: "https://env.volces.com/api/v3",
  PLAYGROUND_PROVIDER_TIMEOUT_MS: 120_000,
};

describe("resolveAzureCredentials", () => {
  test("prefers complete visitor credentials over the environment", () => {
    const resolved = resolveAzureCredentials(
      {
        apiKey: " user-key ",
        endpoint: "https://user.example.com",
        apiVersion: "2025-01-01",
      },
      FULL_CONFIG
    );
    expect(resolved).toEqual({
      apiKey: "user-key",
      endpoint: "https://user.example.com",
      apiVersion: "2025-01-01",
    });
  });

  test("rejects partial visitor credentials instead of falling back", () => {
    expect(() =>
      resolveAzureCredentials({ apiKey: "user-key" }, FULL_CONFIG)
    ).toThrow(PlaygroundConfigurationError);
  });

  test("falls back to the environment without visitor credentials", () => {
    const resolved = resolveAzureCredentials(undefined, FULL_CONFIG);
    expect(resolved.apiKey).toBe("env-azure-key");
  });

  test("raises a configuration error when no source is complete", () => {
    expect(() => resolveAzureCredentials(undefined, EMPTY_CONFIG)).toThrow(
      /请填写你的 API Key/
    );
  });
});

describe("resolveAliyunCredentials", () => {
  test("prefers complete visitor credentials over the environment", () => {
    const resolved = resolveAliyunCredentials(
      { apiKey: "user-key", baseUrl: "https://user.maas.aliyuncs.com/api/v1" },
      FULL_CONFIG
    );
    expect(resolved).toEqual({
      apiKey: "user-key",
      baseUrl: "https://user.maas.aliyuncs.com/api/v1",
    });
  });

  test("rejects visitor apiKey without a base URL", () => {
    expect(() =>
      resolveAliyunCredentials({ apiKey: "user-key" }, FULL_CONFIG)
    ).toThrow(/Base URL/);
  });

  test("falls back to the environment without visitor credentials", () => {
    const resolved = resolveAliyunCredentials(undefined, FULL_CONFIG);
    expect(resolved.apiKey).toBe("env-aliyun-key");
  });

  test("raises a configuration error when no source is complete", () => {
    expect(() => resolveAliyunCredentials(undefined, EMPTY_CONFIG)).toThrow(
      PlaygroundConfigurationError
    );
  });
});

describe("resolveSeedreamCredentials", () => {
  test("prefers visitor credentials and keeps baseUrl optional", () => {
    expect(
      resolveSeedreamCredentials({ apiKey: "user-key" }, FULL_CONFIG)
    ).toEqual({ apiKey: "user-key" });
  });

  test("falls back to the environment including the base URL", () => {
    expect(resolveSeedreamCredentials(undefined, FULL_CONFIG)).toEqual({
      apiKey: "env-ark-key",
      baseUrl: "https://env.volces.com/api/v3",
    });
  });

  test("raises a configuration error when no source is complete", () => {
    expect(() => resolveSeedreamCredentials(undefined, EMPTY_CONFIG)).toThrow(
      /Ark API Key/
    );
  });
});

describe("isProviderConfiguredByEnv", () => {
  test("reports every Provider configured for a full environment", () => {
    expect(isProviderConfiguredByEnv("azure-openai", FULL_CONFIG)).toBe(true);
    expect(isProviderConfiguredByEnv("aliyun-bailian", FULL_CONFIG)).toBe(true);
    expect(isProviderConfiguredByEnv("doubao-seedream", FULL_CONFIG)).toBe(
      true
    );
  });

  test("reports no Provider configured for an empty environment", () => {
    expect(isProviderConfiguredByEnv("azure-openai", EMPTY_CONFIG)).toBe(false);
    expect(isProviderConfiguredByEnv("aliyun-bailian", EMPTY_CONFIG)).toBe(
      false
    );
    expect(isProviderConfiguredByEnv("doubao-seedream", EMPTY_CONFIG)).toBe(
      false
    );
  });
});
