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
          modality: "image",
          imageOperation: "generate",
          prompt: "  ",
        }),
      })
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      status: "failed",
      error: {
        code: "VALIDATION_ERROR",
        message: "Provide a Provider, model, modality, and non-empty prompt.",
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
          modality: "image",
          imageOperation: "edit",
          prompt: "edit this image",
          referenceImageUrl: "not-a-url",
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects a non-HTTP input video URL before Provider dispatch", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "aliyun-bailian",
          model: "happyhorse-1.0-video-edit",
          modality: "video",
          prompt: "edit",
          inputVideoUrl: "ftp://x/source.mp4",
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects malformed reference image URLs before Provider dispatch", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "aliyun-bailian",
          model: "happyhorse-1.1-r2v",
          modality: "video",
          prompt: "p",
          referenceImageUrls: ["https://x/a.png", "not-a-url"],
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects credentials with an empty apiKey", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "doubao-seedream",
          model: "doubao-seedream-4-5-251128",
          modality: "image",
          imageOperation: "generate",
          prompt: "a red apple",
          credentials: { apiKey: "   " },
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects credentials with a non-HTTP endpoint", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "azure-openai",
          model: "gpt-image-2",
          modality: "image",
          imageOperation: "generate",
          prompt: "a red apple",
          credentials: {
            apiKey: "key",
            endpoint: "javascript:alert(1)",
            apiVersion: "2024-02-01",
          },
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects a non-object credentials field", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "doubao-seedream",
          model: "doubao-seedream-4-5-251128",
          modality: "image",
          imageOperation: "generate",
          prompt: "a red apple",
          credentials: "not-an-object",
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
