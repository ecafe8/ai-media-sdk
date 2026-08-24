import { afterEach, describe, expect, test } from "bun:test";

import {
  executeSiteRequest,
  executeSiteVoiceCloning,
  mapSdkErrorMessage,
} from "@/lib/executor";
import { setCredentials } from "@/lib/key-store";
import { installMockWindow, uninstallMockWindow } from "./helpers/mock-window";

afterEach(() => {
  uninstallMockWindow();
});

function countFetchCalls(): { calls: () => number } {
  let count = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    count += 1;
    return original(...args);
  }) as typeof fetch;
  return {
    calls: () => {
      globalThis.fetch = original;
      return count;
    },
  };
}

describe("executor local interception", () => {
  test("audio requires text and voice without contacting the provider", async () => {
    installMockWindow();
    setCredentials("aliyun-bailian", {
      apiKey: "secret-key",
      baseUrl: "https://dashscope.aliyuncs.com",
    });
    const fetchSpy = countFetchCalls();
    const response = await executeSiteRequest({
      provider: "aliyun-bailian",
      model: "cosyvoice-v3.5-flash",
      modality: "audio",
      prompt: "",
      text: " ",
      voice: "longxiaochun",
    });
    expect(response.error?.code).toBe("INVALID_REQUEST");
    expect(fetchSpy.calls()).toBe(0);
  });

  test("voice protocol and target model are validated locally", async () => {
    installMockWindow();
    setCredentials("aliyun-bailian", {
      apiKey: "secret-key",
      baseUrl: "https://dashscope.aliyuncs.com",
    });
    const fetchSpy = countFetchCalls();
    await expect(
      executeSiteVoiceCloning("create", {
        protocol: "qwen",
        targetModel: "cosyvoice-v3.5-flash",
        audioUrl: "https://example.com/voice.wav",
        prefix: "voice",
      })
    ).rejects.toThrow("incompatible");
    expect(fetchSpy.calls()).toBe(0);
  });
  test("missing credentials fail locally without any network call", async () => {
    const fetchSpy = countFetchCalls();
    const response = await executeSiteRequest({
      provider: "volcengine",
      model: "doubao-seedream-4-5-251128",
      modality: "image",
      prompt: "a cat",
    });
    expect(response.status).toBe("failed");
    expect(response.error?.code).toBe("CONFIGURATION_ERROR");
    expect(response.error?.message).toContain("API Key");
    expect(fetchSpy.calls()).toBe(0);
  });

  test("partial credentials list the missing fields", async () => {
    installMockWindow();
    setCredentials("azure-openai", { apiKey: "k" });
    const fetchSpy = countFetchCalls();
    const response = await executeSiteRequest({
      provider: "azure-openai",
      model: "gpt-image-2",
      modality: "image",
      prompt: "a cat",
    });
    expect(response.status).toBe("failed");
    expect(response.error?.code).toBe("CONFIGURATION_ERROR");
    expect(response.error?.message).toContain("Endpoint");
    expect(response.error?.message).toContain("API Version");
    expect(fetchSpy.calls()).toBe(0);
  });

  test("unconfirmed custom endpoint is rejected before any request", async () => {
    installMockWindow();
    setCredentials("volcengine", {
      apiKey: "k",
      baseUrl: "https://my-proxy.example.com/api/v3",
    });
    const fetchSpy = countFetchCalls();
    const response = await executeSiteRequest({
      provider: "volcengine",
      model: "doubao-seedream-4-5-251128",
      modality: "image",
      prompt: "a cat",
    });
    expect(response.status).toBe("failed");
    expect(response.error?.code).toBe("ENDPOINT_UNCONFIRMED");
    expect(response.error?.context?.host).toBe("my-proxy.example.com");
    expect(fetchSpy.calls()).toBe(0);
  });

  test("unknown model is rejected locally", async () => {
    installMockWindow();
    setCredentials("volcengine", { apiKey: "k" });
    const fetchSpy = countFetchCalls();
    const response = await executeSiteRequest({
      provider: "volcengine",
      model: "no-such-model",
      modality: "image",
      prompt: "a cat",
    });
    expect(response.status).toBe("failed");
    expect(response.error?.code).toBe("MODEL_UNAVAILABLE");
    expect(fetchSpy.calls()).toBe(0);
  });

  test("video modality on an image-only model is rejected", async () => {
    installMockWindow();
    setCredentials("azure-openai", {
      apiKey: "k",
      endpoint: "https://r.openai.azure.com",
      apiVersion: "2024-02-01",
    });
    const fetchSpy = countFetchCalls();
    const response = await executeSiteRequest({
      provider: "azure-openai",
      model: "gpt-image-2",
      modality: "video",
      prompt: "a cat",
    });
    expect(response.status).toBe("failed");
    expect(response.error?.code).toBe("VIDEO_NOT_SUPPORTED");
    expect(response.error?.message).toContain("video");
    expect(fetchSpy.calls()).toBe(0);
  });

  test("edit on a model without edit support is rejected locally", async () => {
    installMockWindow();
    setCredentials("azure-openai", {
      apiKey: "k",
      endpoint: "https://r.openai.azure.com",
      apiVersion: "2024-02-01",
    });
    const fetchSpy = countFetchCalls();
    const response = await executeSiteRequest({
      provider: "azure-openai",
      model: "gpt-image-2",
      modality: "image",
      imageOperation: "edit",
      prompt: "a cat",
      referenceImage: { url: "https://example.com/a.png" },
    });
    expect(response.status).toBe("failed");
    expect(response.error?.code).toBe("EDIT_NOT_SUPPORTED");
    expect(response.error?.message).toContain("editing");
    expect(fetchSpy.calls()).toBe(0);
  });

  test("minimax video without credentials is blocked locally", async () => {
    const fetchSpy = countFetchCalls();
    const response = await executeSiteRequest({
      provider: "minimax",
      model: "MiniMax-H3",
      modality: "video",
      prompt: "a cat",
    });
    expect(response.status).toBe("failed");
    expect(response.error?.code).toBe("CONFIGURATION_ERROR");
    expect(response.error?.message).toContain("API Key");
    expect(fetchSpy.calls()).toBe(0);
  });

  test("minimax video passes the video gate and reaches endpoint validation", async () => {
    installMockWindow();
    setCredentials("minimax", {
      apiKey: "k",
      baseUrl: "https://my-proxy.example.com/v1",
    });
    const fetchSpy = countFetchCalls();
    const response = await executeSiteRequest({
      provider: "minimax",
      model: "MiniMax-H3",
      modality: "video",
      prompt: "a cat",
    });
    // An ENDPOINT_UNCONFIRMED error naming the custom host means the request
    // passed the video-provider gate and model lookup and only stopped at the
    // unconfirmed endpoint check.
    expect(response.status).toBe("failed");
    expect(response.error?.code).toBe("ENDPOINT_UNCONFIRMED");
    expect(response.error?.message).toContain("my-proxy.example.com");
    expect(fetchSpy.calls()).toBe(0);
  });
});

describe("executor error message mapping", () => {
  test("auth errors point at the API key", () => {
    expect(mapSdkErrorMessage("AUTH_ERROR")).toContain("API key");
  });

  test("rate limit and timeout messages are actionable", () => {
    expect(mapSdkErrorMessage("RATE_LIMITED")).toContain("try again later");
    expect(mapSdkErrorMessage("TIMEOUT")).toContain("retry");
  });

  test("network errors mention connectivity", () => {
    expect(mapSdkErrorMessage("NETWORK_ERROR")).toContain("Cannot reach");
  });

  test("invalid request includes provider detail when present", () => {
    expect(mapSdkErrorMessage("INVALID_REQUEST", "bad size")).toContain(
      "bad size"
    );
    expect(mapSdkErrorMessage("INVALID_REQUEST")).toContain("not supported");
  });

  test("unknown codes fall back to a generic message", () => {
    expect(mapSdkErrorMessage("UNKNOWN")).toBe(
      "Generation failed; please retry."
    );
  });
});
