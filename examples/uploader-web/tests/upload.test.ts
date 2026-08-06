import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  uploadToAliyun,
  uploadToGoogle,
} from "@/lib/upload";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("uploader web client", () => {
  test("posts Aliyun multipart form data", async () => {
    let request: Request | undefined;
    globalThis.fetch = mock(async (input, init) => {
      request = new Request(new URL(String(input), "http://localhost"), init);
      return response({
        url: "oss://dashscope-instant/file.png",
        expiresAt: "2030-01-01T00:00:00.000Z",
      });
    }) as unknown as typeof globalThis.fetch;

    const file = new File(["image"], "file.png", { type: "image/png" });
    const result = await uploadToAliyun(file, "qwen-image-2.0-pro");

    expect(result.url).toStartWith("oss://");
    expect(request?.method).toBe("POST");
    const form = await request?.formData();
    expect(form?.get("model")).toBe("qwen-image-2.0-pro");
    expect(form?.get("file")).toBeInstanceOf(File);
  });

  test("posts Google multipart form data", async () => {
    let request: Request | undefined;
    globalThis.fetch = mock(async (input, init) => {
      request = new Request(new URL(String(input), "http://localhost"), init);
      return response({
        url: "https://generativelanguage.googleapis.com/v1beta/files/1",
        name: "files/1",
      });
    }) as unknown as typeof globalThis.fetch;

    const file = new File(["audio"], "sample.mp3", { type: "audio/mpeg" });
    await uploadToGoogle(file, "audio/mpeg", "sample-audio");

    const form = await request?.formData();
    expect(form?.get("mimeType")).toBe("audio/mpeg");
    expect(form?.get("displayName")).toBe("sample-audio");
    expect(form?.get("file")).toBeInstanceOf(File);
  });

  test("maps server errors to UploadClientError", async () => {
    globalThis.fetch = mock(async () =>
      response({ code: "RATE_LIMITED", message: "try later" }, 429)
    ) as unknown as typeof globalThis.fetch;

    const file = new File(["image"], "file.png", { type: "image/png" });
    await expect(uploadToAliyun(file, "qwen-image-2.0-pro")).rejects.toEqual(
      expect.objectContaining({
        name: "UploadClientError",
        code: "RATE_LIMITED",
        statusCode: 429,
      })
    );
  });
});
