import { afterEach, describe, expect, test } from "bun:test";

import {
  clearAllCredentials,
  clearCredentials,
  confirmCustomHost,
  getConfiguredProviders,
  getConfirmedHosts,
  getCredentials,
  isCredentialsComplete,
  missingCredentialFields,
  setCredentials,
  validateProviderEndpoint,
} from "@/lib/key-store";
import { installMockWindow, uninstallMockWindow } from "./helpers/mock-window";

afterEach(() => {
  uninstallMockWindow();
});

describe("key-store sanitization", () => {
  test("drops unknown providers and non-string fields on load", () => {
    const mock = installMockWindow();
    mock.store["ai-media-site.credentials.v1"] = JSON.stringify({
      "azure-openai": { apiKey: "k", endpoint: 42, apiVersion: "v" },
      "not-a-provider": { apiKey: "x" },
    });
    const creds = getCredentials("azure-openai");
    expect(creds?.apiKey).toBe("k");
    expect(creds?.apiVersion).toBe("v");
    // Non-string endpoint is dropped.
    expect(creds?.endpoint).toBeUndefined();
    expect(getCredentials("aliyun-bailian")).toBeUndefined();
  });

  test("drops entries without an apiKey", () => {
    const mock = installMockWindow();
    mock.store["ai-media-site.credentials.v1"] = JSON.stringify({
      "doubao-seedream": {
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      },
    });
    expect(getCredentials("doubao-seedream")).toBeUndefined();
  });

  test("tolerates corrupted JSON", () => {
    const mock = installMockWindow();
    mock.store["ai-media-site.credentials.v1"] = "{not-valid-json";
    expect(getCredentials("azure-openai")).toBeUndefined();
  });

  test("ignores values containing the pipe character", () => {
    const mock = installMockWindow();
    setCredentials("doubao-seedream", { apiKey: "abc|def" });
    expect(getCredentials("doubao-seedream")?.apiKey).toBe("abc|def");
    expect(mock.store["ai-media-site.credentials.v1"]).toContain("abc|def");
  });
});

describe("key-store completeness", () => {
  test("azure requires apiKey + endpoint + apiVersion", () => {
    expect(isCredentialsComplete("azure-openai", undefined)).toBe(false);
    expect(isCredentialsComplete("azure-openai", { apiKey: "k" })).toBe(false);
    expect(
      isCredentialsComplete("azure-openai", {
        apiKey: "k",
        endpoint: "https://x.openai.azure.com",
      })
    ).toBe(false);
    expect(
      isCredentialsComplete("azure-openai", {
        apiKey: "k",
        endpoint: "https://x.openai.azure.com",
        apiVersion: "2024-02-01",
      })
    ).toBe(true);
  });

  test("bailian requires apiKey + baseUrl", () => {
    expect(isCredentialsComplete("aliyun-bailian", { apiKey: "k" })).toBe(
      false
    );
    expect(
      isCredentialsComplete("aliyun-bailian", {
        apiKey: "k",
        baseUrl: "https://w.cn-beijing.maas.aliyuncs.com/api/v1",
      })
    ).toBe(true);
  });

  test("seedream requires only apiKey", () => {
    expect(isCredentialsComplete("doubao-seedream", { apiKey: "k" })).toBe(
      true
    );
  });

  test("minimax requires only apiKey", () => {
    expect(isCredentialsComplete("minimax", { apiKey: "k" })).toBe(true);
    expect(isCredentialsComplete("minimax", undefined)).toBe(false);
  });

  test("missingCredentialFields lists absent fields", () => {
    expect(missingCredentialFields("azure-openai", undefined)).toEqual([
      "API Key",
      "Endpoint",
      "API Version",
    ]);
    expect(missingCredentialFields("azure-openai", { apiKey: "k" })).toEqual([
      "Endpoint",
      "API Version",
    ]);
    expect(missingCredentialFields("doubao-seedream", { apiKey: "k" })).toEqual(
      []
    );
  });
});

describe("key-store persistence and isolation", () => {
  test("set and clear round-trip per provider", () => {
    installMockWindow();
    setCredentials("azure-openai", {
      apiKey: "az",
      endpoint: "https://x.openai.azure.com",
      apiVersion: "v",
    });
    setCredentials("doubao-seedream", { apiKey: "sd" });
    expect(getCredentials("azure-openai")?.apiKey).toBe("az");
    expect(getCredentials("doubao-seedream")?.apiKey).toBe("sd");

    clearCredentials("azure-openai");
    expect(getCredentials("azure-openai")).toBeUndefined();
    expect(getCredentials("doubao-seedream")?.apiKey).toBe("sd");

    clearAllCredentials();
    expect(getCredentials("doubao-seedream")).toBeUndefined();
  });

  test("configured providers reflect only complete credential sets", () => {
    installMockWindow();
    setCredentials("doubao-seedream", { apiKey: "sd" });
    setCredentials("azure-openai", { apiKey: "az" }); // incomplete
    const configured = getConfiguredProviders({
      "doubao-seedream": { apiKey: "sd" },
      "azure-openai": { apiKey: "az" },
    });
    expect(configured.has("doubao-seedream")).toBe(true);
    expect(configured.has("azure-openai")).toBe(false);
  });
});

describe("endpoint validation", () => {
  test("accepts allowlisted hosts as default", () => {
    const azure = validateProviderEndpoint(
      "azure-openai",
      "https://myresource.openai.azure.com"
    );
    expect(azure.ok).toBe(true);
    expect(azure.isCustomHost).toBe(false);

    const bailian = validateProviderEndpoint(
      "aliyun-bailian",
      "https://w.cn-beijing.maas.aliyuncs.com/api/v1"
    );
    expect(bailian.ok).toBe(true);
    expect(bailian.isCustomHost).toBe(false);

    const seedream = validateProviderEndpoint(
      "doubao-seedream",
      "https://ark.cn-beijing.volces.com/api/v3"
    );
    expect(seedream.ok).toBe(true);
    expect(seedream.isCustomHost).toBe(false);

    const minimax = validateProviderEndpoint(
      "minimax",
      "https://api.minimax.io"
    );
    expect(minimax.ok).toBe(true);
    expect(minimax.isCustomHost).toBe(false);
  });

  test("flags non-allowlisted hosts as custom", () => {
    const custom = validateProviderEndpoint(
      "doubao-seedream",
      "https://my-proxy.example.com"
    );
    expect(custom.ok).toBe(true);
    expect(custom.isCustomHost).toBe(true);
    expect(custom.host).toBe("my-proxy.example.com");
  });

  test("rejects non-HTTPS endpoints", () => {
    const http = validateProviderEndpoint(
      "doubao-seedream",
      "http://ark.cn-beijing.volces.com/api/v3"
    );
    expect(http.ok).toBe(false);
    expect(http.error).toContain("HTTPS");
  });

  test("rejects endpoints with embedded credentials", () => {
    const withUser = validateProviderEndpoint(
      "doubao-seedream",
      "https://user:pass@ark.cn-beijing.volces.com/api/v3"
    );
    expect(withUser.ok).toBe(false);
  });

  test("rejects non-standard ports", () => {
    const port = validateProviderEndpoint(
      "doubao-seedream",
      "https://ark.cn-beijing.volces.com:8080/api/v3"
    );
    expect(port.ok).toBe(false);
  });

  test("rejects invalid URLs and empty values", () => {
    expect(validateProviderEndpoint("doubao-seedream", "not a url").ok).toBe(
      false
    );
    expect(validateProviderEndpoint("doubao-seedream", "").ok).toBe(false);
    expect(validateProviderEndpoint("doubao-seedream", undefined).ok).toBe(
      false
    );
  });
});

describe("custom host confirmation", () => {
  test("confirm and revoke a custom host", () => {
    installMockWindow();
    confirmCustomHost("my-proxy.example.com");
    expect(getConfirmedHosts()).toContain("my-proxy.example.com");
    // Confirming twice does not duplicate.
    confirmCustomHost("my-proxy.example.com");
    expect(getConfirmedHosts().length).toBe(1);
  });
});
