import { describe, expect, test } from "bun:test";

import {
  clearStoredCredentials,
  isCredentialsComplete,
  normalizeCredentials,
  setStoredCredentials,
} from "./credentials";

describe("normalizeCredentials", () => {
  test("trims fields and drops empties", () => {
    expect(
      normalizeCredentials({
        apiKey: " key ",
        endpoint: " https://example.com ",
        apiVersion: "",
        baseUrl: "   ",
      })
    ).toEqual({ apiKey: "key", endpoint: "https://example.com" });
  });

  test("returns undefined when no usable apiKey remains", () => {
    expect(normalizeCredentials({ apiKey: "   " })).toBeUndefined();
    expect(normalizeCredentials(undefined)).toBeUndefined();
  });
});

describe("isCredentialsComplete", () => {
  test("requires endpoint and apiVersion for azure-openai", () => {
    expect(
      isCredentialsComplete("azure-openai", {
        apiKey: "key",
        endpoint: "https://example.com",
        apiVersion: "2024-02-01",
      })
    ).toBe(true);
    expect(isCredentialsComplete("azure-openai", { apiKey: "key" })).toBe(
      false
    );
  });

  test("requires baseUrl for aliyun-bailian", () => {
    expect(
      isCredentialsComplete("aliyun-bailian", {
        apiKey: "key",
        baseUrl: "https://example.com/api/v1",
      })
    ).toBe(true);
    expect(isCredentialsComplete("aliyun-bailian", { apiKey: "key" })).toBe(
      false
    );
  });

  test("accepts apiKey alone for doubao-seedream", () => {
    expect(isCredentialsComplete("doubao-seedream", { apiKey: "key" })).toBe(
      true
    );
    expect(isCredentialsComplete("doubao-seedream", undefined)).toBe(false);
  });
});

describe("stored credentials without a window", () => {
  test("set/clear are safe no-ops when window is unavailable", () => {
    expect(() =>
      setStoredCredentials("doubao-seedream", { apiKey: "key" })
    ).not.toThrow();
    expect(() => clearStoredCredentials("doubao-seedream")).not.toThrow();
  });
});
