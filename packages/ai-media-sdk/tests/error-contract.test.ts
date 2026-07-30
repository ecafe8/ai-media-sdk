import { describe, expect, test } from "bun:test";

import {
  SdkError,
  editImage,
  generateImage,
  notImplemented,
} from "@ai-media/sdk";

describe("core error contract", () => {
  test("notImplemented builds a non-retryable NOT_IMPLEMENTED error", () => {
    const error = notImplemented("generateImage");

    expect(error).toBeInstanceOf(SdkError);
    expect(error.code).toBe("NOT_IMPLEMENTED");
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("generateImage");
  });

  test("generateImage rejects with NOT_IMPLEMENTED and makes no request", async () => {
    const call = () => generateImage({ model: "test-model", prompt: "p" });

    await expect(call()).rejects.toBeInstanceOf(SdkError);
    await expect(call()).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
      retryable: false,
    });
  });

  test("editImage rejects with NOT_IMPLEMENTED and makes no request", async () => {
    const call = () =>
      editImage({ model: "test-model", prompt: "p", image: {} });

    await expect(call()).rejects.toBeInstanceOf(SdkError);
    await expect(call()).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
      retryable: false,
    });
  });
});
