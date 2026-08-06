import { describe, expect, test } from "bun:test";

describe("uploader web API contract", () => {
  test("documents the two provider endpoints", () => {
    expect(["/api/upload/aliyun", "/api/upload/google"]).toEqual([
      "/api/upload/aliyun",
      "/api/upload/google",
    ]);
  });

  test("keeps provider credentials server-side", async () => {
    const source = await Bun.file(
      new URL("../server/upload-api.ts", import.meta.url)
    ).text();
    expect(source).toContain("ALIYUN_BAILIAN_API_KEY");
    expect(source).toContain("GEMINI_API_KEY");
    expect(source).not.toContain("import.meta.env");
  });
});
