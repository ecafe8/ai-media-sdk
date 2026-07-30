import { describe, expect, test } from "bun:test";

import { POST } from "./route";

describe("Playground generate route", () => {
  test("rejects an empty prompt before Provider dispatch", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "aliyun-bailian",
          model: "qwen-image-2.0-pro",
          mode: "generate",
          prompt: "  ",
        }),
      })
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      status: "failed",
      error: {
        code: "VALIDATION_ERROR",
        message: "Provide a Provider, model, mode, and non-empty prompt.",
      },
    });
  });

  test("rejects malformed reference URLs before Provider dispatch", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "aliyun-bailian",
          model: "qwen-image-2.0-pro",
          mode: "edit",
          prompt: "edit this image",
          referenceImageUrl: "not-a-url",
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
