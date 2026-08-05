/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { UPLOADER_ERROR_CODES, UploaderError } from "@ai-media/uploader/core";

describe("UploaderError", () => {
  test("carries code, statusCode, and cause", () => {
    const cause = new Error("upstream");
    const error = new UploaderError({
      code: UPLOADER_ERROR_CODES.POLICY_ERROR,
      message: "policy failed",
      statusCode: 500,
      cause,
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UploaderError");
    expect(error.code).toBe("POLICY_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.cause).toBe(cause);
    expect(error.message).toBe("policy failed");
  });

  test("omits statusCode and cause when not provided", () => {
    const error = new UploaderError({
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: "bad input",
    });
    expect(error.statusCode).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  test("error code constants are stable string literals", () => {
    expect(UPLOADER_ERROR_CODES.INVALID_REQUEST).toBe("INVALID_REQUEST");
    expect(UPLOADER_ERROR_CODES.POLICY_ERROR).toBe("POLICY_ERROR");
    expect(UPLOADER_ERROR_CODES.UPLOAD_ERROR).toBe("UPLOAD_ERROR");
    expect(UPLOADER_ERROR_CODES.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(UPLOADER_ERROR_CODES.NOT_FOUND).toBe("NOT_FOUND");
    expect(UPLOADER_ERROR_CODES.INVALID_RESPONSE).toBe("INVALID_RESPONSE");
    expect(UPLOADER_ERROR_CODES.UNKNOWN).toBe("UNKNOWN");
  });
});
