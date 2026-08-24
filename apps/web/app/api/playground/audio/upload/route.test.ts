import { describe, expect, test } from "bun:test";

import { POST } from "./route";

describe("audio upload route", () => {
  test("requires a target model and file", async () => {
    globalThis.__PLAYGROUND_SHARED_AUDIO_LIMITER__ = { allow: () => true };
    const response = await POST(
      new Request("http://localhost/api/playground/audio/upload", {
        method: "POST",
        body: new FormData(),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    delete globalThis.__PLAYGROUND_SHARED_AUDIO_LIMITER__;
  });
});
