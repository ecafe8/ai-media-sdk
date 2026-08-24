import { describe, expect, test } from "bun:test";

import { POST } from "./route";

describe("audio stream route", () => {
  test("keeps audio disabled when the shared limiter is unavailable", async () => {
    delete globalThis.__PLAYGROUND_SHARED_AUDIO_LIMITER__;
    const response = await POST(
      new Request("http://localhost/api/playground/audio/stream", {
        method: "POST",
        body: JSON.stringify({
          provider: "aliyun-bailian",
          model: "qwen-audio-3.0-tts-flash",
          modality: "audio",
          text: "hello",
          voice: "Cherry",
        }),
      })
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("RATE_LIMIT_UNAVAILABLE");
  });

  test("rejects empty text before provider dispatch", async () => {
    globalThis.__PLAYGROUND_SHARED_AUDIO_LIMITER__ = { allow: () => true };
    const response = await POST(
      new Request("http://localhost/api/playground/audio/stream", {
        method: "POST",
        body: JSON.stringify({
          provider: "aliyun-bailian",
          model: "qwen-audio-3.0-tts-flash",
          modality: "audio",
          text: "",
          voice: "Cherry",
        }),
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    delete globalThis.__PLAYGROUND_SHARED_AUDIO_LIMITER__;
  });
});
