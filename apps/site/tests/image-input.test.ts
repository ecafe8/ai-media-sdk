import { describe, expect, test } from "bun:test";

import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  parseBulkUrls,
  validateImageFile,
} from "@/lib/image-input";

describe("validateImageFile", () => {
  test("accepts whitelisted raster types within the cap", () => {
    const file = new File([new Uint8Array(10)], "a.png", { type: "image/png" });
    expect(validateImageFile(file)).toEqual({ ok: true });
  });

  test("rejects SVG", () => {
    const file = new File(["<svg/>"], "a.svg", { type: "image/svg+xml" });
    const result = validateImageFile(file);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("SVG");
  });

  test("rejects unknown MIME types", () => {
    const file = new File(["x"], "a.txt", { type: "text/plain" });
    expect(validateImageFile(file).ok).toBe(false);
  });

  test("rejects files above the size cap with a readable message", () => {
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "big.png", {
      type: "image/png",
    });
    const result = validateImageFile(big);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("5.0 MB");
  });

  test("accepts a file exactly at the cap", () => {
    const exact = new File([new Uint8Array(MAX_IMAGE_BYTES)], "ok.png", {
      type: "image/png",
    });
    expect(validateImageFile(exact).ok).toBe(true);
  });

  test("whitelist covers the documented raster formats", () => {
    expect(ALLOWED_IMAGE_MIME_TYPES).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/bmp",
      "image/gif",
    ]);
  });
});

describe("parseBulkUrls", () => {
  test("splits on commas and newlines, preserving order", () => {
    const { valid, invalid } = parseBulkUrls(
      "https://a/1.png, https://b/2.png\nhttps://c/3.png"
    );
    expect(valid).toEqual([
      "https://a/1.png",
      "https://b/2.png",
      "https://c/3.png",
    ]);
    expect(invalid).toEqual([]);
  });

  test("collects invalid fragments separately", () => {
    const { valid, invalid } = parseBulkUrls(
      "https://a/1.png, not-a-url, ftp://x/y"
    );
    expect(valid).toEqual(["https://a/1.png"]);
    expect(invalid).toEqual(["not-a-url", "ftp://x/y"]);
  });

  test("ignores empty fragments", () => {
    const { valid, invalid } = parseBulkUrls(",, ,\n");
    expect(valid).toEqual([]);
    expect(invalid).toEqual([]);
  });
});
