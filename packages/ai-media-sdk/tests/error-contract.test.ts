/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  SdkError,
  classifyHttpError,
  notImplemented,
  unknownModel,
} from "@ai-media/sdk";

describe("core error contract", () => {
  test("notImplemented builds a non-retryable NOT_IMPLEMENTED error", () => {
    const error = notImplemented("generateImage");

    expect(error).toBeInstanceOf(SdkError);
    expect(error.code).toBe("NOT_IMPLEMENTED");
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("generateImage");
  });

  test("unknownModel builds a non-retryable UNKNOWN_MODEL error", () => {
    const error = unknownModel("not-a-real-model");

    expect(error).toBeInstanceOf(SdkError);
    expect(error.code).toBe("UNKNOWN_MODEL");
    expect(error.retryable).toBe(false);
    expect(error.message).toBe('Unknown model id "not-a-real-model"');
    expect(error.message).not.toContain("provider");
  });

  test("unknownModel carries provider context when supplied", () => {
    const error = unknownModel("foo", "aliyun-bailian");

    expect(error.code).toBe("UNKNOWN_MODEL");
    expect(error.message).toBe('Unknown model id "foo" for provider "aliyun-bailian"');
    expect(error.message).not.toContain("apiKey");
  });

  test("classifyHttpError maps HTTP status to stable codes", () => {
    expect(classifyHttpError(401).code).toBe("AUTH_ERROR");
    expect(classifyHttpError(403).code).toBe("AUTH_ERROR");
    expect(classifyHttpError(401).retryable).toBe(false);

    expect(classifyHttpError(429).code).toBe("RATE_LIMITED");
    expect(classifyHttpError(429).retryable).toBe(true);

    expect(classifyHttpError(400).code).toBe("INVALID_REQUEST");
    expect(classifyHttpError(413).code).toBe("INVALID_REQUEST");
    expect(classifyHttpError(422).code).toBe("INVALID_REQUEST");
    expect(classifyHttpError(400).retryable).toBe(false);

    expect(classifyHttpError(500).code).toBe("PROVIDER_ERROR");
    expect(classifyHttpError(503).code).toBe("PROVIDER_ERROR");
    expect(classifyHttpError(500).retryable).toBe(false);

    expect(classifyHttpError(418).code).toBe("UNKNOWN");
  });

  test("classifyHttpError forwards sanitized messages and omits secrets", () => {
    const error = classifyHttpError(401, "azure returned 401");

    expect(error.message).toBe("azure returned 401");
    expect(error.message).not.toContain("Bearer");
    expect(error.message).not.toContain("api-key");
  });
});
