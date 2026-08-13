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

  test("accepts the minimax provider past route validation", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "minimax",
          model: "MiniMax-H3",
          modality: "video",
          prompt: "a boy playing basketball",
          resolution: "2K",
          duration: 5,
          ratio: "16:9",
        }),
      })
    );
    // The provider passes route validation; without server credentials the
    // executor fails with a configuration error rather than VALIDATION_ERROR.
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("CONFIGURATION_ERROR");
  });

  test("rejects a non-string ratio before Provider dispatch", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "minimax",
          model: "MiniMax-H3",
          modality: "video",
          prompt: "p",
          ratio: 16,
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects a malformed last-frame URL before Provider dispatch", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "minimax",
          model: "MiniMax-H3",
          modality: "video",
          prompt: "p",
          referenceImageUrl: "https://x/first.png",
          lastFrameImageUrl: "not-a-url",
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects a size outside the model's supportedSizes pre-flight", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "doubao-seedream",
          model: "doubao-seedream-5-0-pro-260628",
          modality: "image",
          imageOperation: "generate",
          prompt: "a red apple",
          size: "8K",
          credentials: { apiKey: "test-key" },
        }),
      })
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.status).toBe("failed");
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.message).toContain('"8K"');
  });

  test("rejects n exceeding the model's maxN pre-flight", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "doubao-seedream",
          model: "doubao-seedream-5-0-pro-260628",
          modality: "image",
          imageOperation: "generate",
          prompt: "a red apple",
          n: 2,
          credentials: { apiKey: "test-key" },
        }),
      })
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.message).toContain("maximum of 1");
  });

  test("rejects a tier size on a pixel-only model pre-flight", async () => {
    const response = await POST(
      new Request("http://localhost/api/playground/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "aliyun-bailian",
          model: "qwen-image-2.0-pro",
          modality: "image",
          imageOperation: "generate",
          prompt: "a red apple",
          size: "2K",
          credentials: {
            apiKey: "test-key",
            baseUrl: "https://dashscope.aliyuncs.com",
          },
        }),
      })
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.message).toContain('"2K"');
  });

  test("rejects malformed reference video/audio URLs before Provider dispatch", async () => {
    for (const field of ["referenceVideoUrls", "referenceAudioUrls"]) {
      const response = await POST(
        new Request("http://localhost/api/playground/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: "minimax",
            model: "MiniMax-H3",
            modality: "video",
            prompt: "p",
            [field]: ["https://x/a.mp4", "not-a-url"],
          }),
        })
      );
      expect(response.status).toBe(422);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    }
  });
});
