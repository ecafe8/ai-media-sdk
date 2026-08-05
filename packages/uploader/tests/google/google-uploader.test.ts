/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { UPLOADER_ERROR_CODES } from "@ai-media/uploader/core";
import { createGoogleUploader } from "@ai-media/uploader/google";

import { createFakeFetch } from "../helpers/fake-fetch.js";

const API_KEY = "gem-key";

const START_RESPONSE = {
  status: 200,
  headers: {
    "X-Goog-Upload-URL":
      "https://upload.example.com/upload/v1beta/files?upload_id=abc",
  },
  json: {},
};

const FINALIZE_RESPONSE = {
  status: 200,
  json: {
    file: {
      name: "files/abc-123",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/abc-123",
      mimeType: "image/png",
      sizeBytes: "4",
      state: "ACTIVE",
    },
  },
};

describe("google uploader", () => {
  test("upload returns https:// URI, name, state, and expiry", async () => {
    const { fetch, requests } = createFakeFetch([
      START_RESPONSE,
      FINALIZE_RESPONSE,
    ]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    const result = await uploader.upload({
      fileBytes: new Uint8Array([1, 2, 3, 4]),
      fileName: "cat.png",
      mimeType: "image/png",
    });

    expect(result.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/files/abc-123"
    );
    expect(result.name).toBe("files/abc-123");
    expect(result.state).toBe("ACTIVE");
    expect(result.mimeType).toBe("image/png");
    expect(result.sizeBytes).toBe(4);
    const now = Date.now();
    expect(result.expiresAt.getTime()).toBeGreaterThan(
      now + 47 * 60 * 60 * 1000
    );
    expect(result.expiresAt.getTime()).toBeLessThan(now + 49 * 60 * 60 * 1000);
    expect(result.requiresHeaders).toBeUndefined();

    expect(requests).toHaveLength(2);
    expect(requests[0]!.method).toBe("POST");
    expect(requests[0]!.headers["x-goog-api-key"]).toBe(API_KEY);
    expect(requests[0]!.headers["X-Goog-Upload-Protocol"]).toBe("resumable");
    expect(requests[0]!.headers["X-Goog-Upload-Command"]).toBe("start");
    expect(requests[0]!.headers["X-Goog-Upload-Header-Content-Length"]).toBe(
      "4"
    );
    expect(requests[0]!.headers["X-Goog-Upload-Header-Content-Type"]).toBe(
      "image/png"
    );
    const startBody = JSON.parse(requests[0]!.body as string);
    expect(startBody.file.display_name).toBe("cat.png");

    expect(requests[1]!.url).toBe(
      "https://upload.example.com/upload/v1beta/files?upload_id=abc"
    );
    expect(requests[1]!.headers["X-Goog-Upload-Command"]).toBe(
      "upload, finalize"
    );
    expect(requests[1]!.headers["X-Goog-Upload-Offset"]).toBe("0");
    expect(requests[1]!.headers["Content-Length"]).toBe("4");
    expect(requests[1]!.body).toBe("[bytes:4]");
  });

  test("upload requires mimeType for fileBytes", async () => {
    const { fetch } = createFakeFetch([START_RESPONSE, FINALIZE_RESPONSE]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    await expect(
      uploader.upload({
        fileBytes: new Uint8Array([1]),
        fileName: "x.png",
      })
    ).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
    });
  });

  test("upload requires a file source", async () => {
    const { fetch } = createFakeFetch([START_RESPONSE]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    await expect(uploader.upload({})).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
    });
  });

  test("get retrieves file metadata", async () => {
    const { fetch, requests } = createFakeFetch([
      {
        status: 200,
        json: {
          name: "files/abc-123",
          uri: "https://example.com/abc-123",
          mimeType: "image/png",
          state: "ACTIVE",
        },
      },
    ]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    const result = await uploader.get("files/abc-123");
    expect(result.name).toBe("files/abc-123");
    expect(result.url).toBe("https://example.com/abc-123");
    expect(result.state).toBe("ACTIVE");
    expect(requests[0]!.method).toBe("GET");
    expect(requests[0]!.url).toContain("/v1beta/files/abc-123");
  });

  test("list follows nextPageToken pagination", async () => {
    const page1 = {
      status: 200,
      json: {
        files: [{ name: "files/1", uri: "https://x/1", state: "ACTIVE" }],
        nextPageToken: "tok-2",
      },
    };
    const page2 = {
      status: 200,
      json: {
        files: [{ name: "files/2", uri: "https://x/2", state: "ACTIVE" }],
      },
    };
    const { fetch, requests } = createFakeFetch([page1, page2]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    const collected = [];
    for await (const file of uploader.list()) {
      collected.push(file.name);
    }
    expect(collected).toEqual(["files/1", "files/2"]);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.url).toContain("pageToken=tok-2");
  });

  test("delete resolves on success", async () => {
    const { fetch, requests } = createFakeFetch([{ status: 200, text: "" }]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    await uploader.delete("files/abc-123");
    expect(requests[0]!.method).toBe("DELETE");
    expect(requests[0]!.url).toContain("/v1beta/files/abc-123");
  });

  test("get HTTP 404 is classified as NOT_FOUND", async () => {
    const { fetch } = createFakeFetch([{ status: 404, text: "not found" }]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    await expect(uploader.get("files/missing")).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.NOT_FOUND,
      statusCode: 404,
    });
  });

  test("delete HTTP 404 is classified as NOT_FOUND", async () => {
    const { fetch } = createFakeFetch([{ status: 404, text: "not found" }]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    await expect(uploader.delete("files/missing")).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.NOT_FOUND,
      statusCode: 404,
    });
  });

  test("upload start missing X-Goog-Upload-URL throws INVALID_RESPONSE", async () => {
    const { fetch } = createFakeFetch([
      { status: 200, headers: {}, json: {} },
      FINALIZE_RESPONSE,
    ]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    await expect(
      uploader.upload({
        fileBytes: new Uint8Array([1]),
        fileName: "x.png",
        mimeType: "image/png",
      })
    ).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.INVALID_RESPONSE,
    });
  });

  test("upload finalize non-2xx is classified as UPLOAD_ERROR", async () => {
    const { fetch } = createFakeFetch([
      START_RESPONSE,
      { status: 500, text: "fail" },
    ]);
    const uploader = createGoogleUploader({ apiKey: API_KEY, fetch });

    await expect(
      uploader.upload({
        fileBytes: new Uint8Array([1]),
        fileName: "x.png",
        mimeType: "image/png",
      })
    ).rejects.toMatchObject({
      code: UPLOADER_ERROR_CODES.UPLOAD_ERROR,
      statusCode: 500,
    });
  });
});
