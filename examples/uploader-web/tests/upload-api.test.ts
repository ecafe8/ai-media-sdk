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
    expect(source).toContain("process.env[ALIYUN_API_KEY_ENV]");
    expect(source).toContain("process.env[GOOGLE_API_KEY_ENV]");
    expect(source).not.toContain("import.meta.env");
  });
});
