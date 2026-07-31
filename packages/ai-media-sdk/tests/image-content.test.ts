/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { toImageUrl } from "@ai-media/sdk";

describe("toImageUrl", () => {
  test("prefers a provider URL", () => {
    expect(
      toImageUrl({
        url: "https://example.com/image.png",
        base64: "aGVsbG8=",
      })
    ).toBe("https://example.com/image.png");
  });

  test("converts base64 to a PNG data URL by default", () => {
    expect(toImageUrl({ base64: "aGVsbG8=" })).toBe(
      "data:image/png;base64,aGVsbG8="
    );
  });

  test("uses the declared MIME type for base64 content", () => {
    expect(toImageUrl({ base64: "aGVsbG8=", mimeType: "image/jpeg" })).toBe(
      "data:image/jpeg;base64,aGVsbG8="
    );
  });

  test("does not wrap an existing data URL", () => {
    const dataUrl = "data:image/webp;base64,aGVsbG8=";
    expect(toImageUrl({ base64: dataUrl })).toBe(dataUrl);
  });

  test("returns undefined when no image payload is present", () => {
    expect(toImageUrl({})).toBeUndefined();
  });
});
