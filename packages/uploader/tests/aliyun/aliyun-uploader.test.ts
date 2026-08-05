/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { UPLOADER_ERROR_CODES, UploaderError } from "@ai-media/uploader/core";
import { createAliyunUploader } from "@ai-media/uploader/aliyun";

import { createFakeFetch } from "../helpers/fake-fetch.js";

const API_KEY = "sk-test-key";
const MODEL = "qwen-image-2.0-pro";

const POLICY_RESPONSE = {
  status: 200,
  json: {
    request_id: "req-1",
    data: {
      policy:
        "eyJleHBpcmF0aW9uIjoiMjAyNC0wNy0xOFQxNzozNjoxNS4wMDBaIiwiY29uZGl0aW9ucyI6W1siZXEiLCIkYnVja2V0IiwiZGFzaHNjb3BlLWluc3RhbnRcLzEifV19",
      signature: "Sm/tv7DcZuTZftFVvt5yOoSETsc=",
      upload_dir: "dashscope-instant/xxx/2024-07-18/xxx",
      upload_host: "https://dashscope-file-xxx.oss-cn-beijing.aliyuncs.com",
      expire_in_seconds: 300,
      max_file_size_mb: 100,
      capacity_limit_mb: 999999999,
      oss_access_key_id: "LTAxxx",
      x_oss_object_acl: "private",
      x_oss_forbid_overwrite: "true",
    },
  },
};

const OSS_SUCCESS_RESPONSE = { status: 200, text: "" };

describe("aliyun uploader", () => {
  test("upload returns oss:// URL with expiry and required headers", async () => {
    const { fetch, requests } = createFakeFetch([
      POLICY_RESPONSE,
      OSS_SUCCESS_RESPONSE,
    ]);
    const uploader = createAliyunUploader({ apiKey: API_KEY, fetch });

    const result = await uploader.upload({
      model: MODEL,
      fileBytes: new Uint8Array([1, 2, 3, 4]),
      fileName: "cat.png",
    });

    expect(result.url).toBe(
      "oss://dashscope-instant/xxx/2024-07-18/xxx/cat.png"
    );
    expect(result.requiresHeaders).toEqual({
      "X-DashScope-OssResourceResolve": "enable",
    });
    const now = Date.now();
    const minExpires = now + 47 * 60 * 60 * 1000;
    const maxExpires = now + 49 * 60 * 60 * 1000;
    expect(result.expiresAt.getTime()).toBeGreaterThan(minExpires);
    expect(result.expiresAt.getTime()).toBeLessThan(maxExpires);

    expect(requests).toHaveLength(2);
    expect(requests[0]!.method).toBe("GET");
    expect(requests[0]!.url).toContain("action=getPolicy");
    expect(requests[0]!.url).toContain(`model=${encodeURIComponent(MODEL)}`);
    expect(requests[0]!.headers.Authorization).toBe(`Bearer ${API_KEY}`);

    expect(requests[1]!.method).toBe("POST");
    expect(requests[1]!.url).toBe(
      "https://dashscope-file-xxx.oss-cn-beijing.aliyuncs.com"
    );
    const formBody = requests[1]!.body as Record<string, unknown>;
    expect(formBody.OSSAccessKeyId).toBe("LTAxxx");
    expect(formBody.Signature).toBe("Sm/tv7DcZuTZftFVvt5yOoSETsc=");
    expect(formBody.key).toBe("dashscope-instant/xxx/2024-07-18/xxx/cat.png");
    expect(formBody.success_action_status).toBe("200");
    expect(formBody.file).toBe("[Blob]");
  });

  test("upload requires a model", async () => {
    const { fetch } = createFakeFetch([POLICY_RESPONSE, OSS_SUCCESS_RESPONSE]);
    const uploader = createAliyunUploader({ apiKey: API_KEY, fetch });

    await expect(
      uploader.upload({
        model: "",
        fileBytes: new Uint8Array([1]),
        fileName: "x.png",
      })
    ).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
    });
  });

  test("upload requires a file source", async () => {
    const { fetch } = createFakeFetch([POLICY_RESPONSE]);
    const uploader = createAliyunUploader({ apiKey: API_KEY, fetch });

    await expect(uploader.upload({ model: MODEL })).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
    });
  });

  test("upload requires fileName with fileBytes", async () => {
    const { fetch } = createFakeFetch([POLICY_RESPONSE]);
    const uploader = createAliyunUploader({ apiKey: API_KEY, fetch });

    await expect(
      uploader.upload({
        model: MODEL,
        fileBytes: new Uint8Array([1]),
      })
    ).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
    });
  });

  test("policy HTTP 429 is classified as RATE_LIMITED", async () => {
    const { fetch } = createFakeFetch([{ status: 429, text: "rate limit" }]);
    const uploader = createAliyunUploader({ apiKey: API_KEY, fetch });

    await expect(
      uploader.upload({
        model: MODEL,
        fileBytes: new Uint8Array([1]),
        fileName: "x.png",
      })
    ).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.RATE_LIMITED,
      statusCode: 429,
    });
  });

  test("policy non-2xx (non-429) is classified as POLICY_ERROR", async () => {
    const { fetch } = createFakeFetch([{ status: 500, text: "oops" }]);
    const uploader = createAliyunUploader({ apiKey: API_KEY, fetch });

    await expect(
      uploader.upload({
        model: MODEL,
        fileBytes: new Uint8Array([1]),
        fileName: "x.png",
      })
    ).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.POLICY_ERROR,
      statusCode: 500,
    });
  });

  test("OSS upload non-200 is classified as UPLOAD_ERROR", async () => {
    const { fetch } = createFakeFetch([
      POLICY_RESPONSE,
      { status: 403, text: "AccessDenied" },
    ]);
    const uploader = createAliyunUploader({ apiKey: API_KEY, fetch });

    await expect(
      uploader.upload({
        model: MODEL,
        fileBytes: new Uint8Array([1]),
        fileName: "x.png",
      })
    ).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.UPLOAD_ERROR,
      statusCode: 403,
    });
  });

  test("policy response missing required fields throws INVALID_RESPONSE", async () => {
    const { fetch } = createFakeFetch([
      { status: 200, json: { data: { policy: "p" } } },
    ]);
    const uploader = createAliyunUploader({ apiKey: API_KEY, fetch });

    await expect(
      uploader.upload({
        model: MODEL,
        fileBytes: new Uint8Array([1]),
        fileName: "x.png",
      })
    ).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.INVALID_RESPONSE,
    });
  });

  test("UploaderError is thrown (not a plain Error)", async () => {
    const { fetch } = createFakeFetch([{ status: 429, text: "rl" }]);
    const uploader = createAliyunUploader({ apiKey: API_KEY, fetch });

    let caught: unknown;
    try {
      await uploader.upload({
        model: MODEL,
        fileBytes: new Uint8Array([1]),
        fileName: "x.png",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UploaderError);
  });
});
