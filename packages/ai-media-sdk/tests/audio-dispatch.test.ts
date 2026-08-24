import { describe, expect, test } from "bun:test";
import {
  type AudioContent,
  type AudioStreamEvent,
  generateAudio,
  type ProviderAdapter,
  SdkError,
  streamAudio,
} from "@ai-media/sdk";

function audioModel(adapter: ProviderAdapter<AudioContent[]>) {
  return {
    providerId: "test",
    modelId: "test-tts",
    adapter,
    capabilities: { modality: "audio" as const, generate: true, edit: false },
  };
}

describe("core audio dispatch", () => {
  test("dispatches text and voice", async () => {
    let received: unknown;
    const result = {
      content: [{ url: "https://example.com/a.mp3" }],
      provider: "test",
      model: "test-tts",
    };
    const model = audioModel({
      providerId: "test",
      generate: async (request) => {
        received = request;
        return result;
      },
      edit: async () => result,
    });

    await expect(
      generateAudio({ model, text: "hello", voice: "Cherry" })
    ).resolves.toEqual(result);
    expect((received as { input: unknown }).input).toEqual({
      text: "hello",
      voice: "Cherry",
    });
  });

  test("rejects empty input before dispatch", async () => {
    let calls = 0;
    const model = audioModel({
      providerId: "test",
      generate: async () => {
        calls += 1;
        return { content: [], provider: "test", model: "test-tts" };
      },
      edit: async () => ({ content: [], provider: "test", model: "test-tts" }),
    });

    await expect(
      generateAudio({ model, text: " ", voice: "Cherry" })
    ).rejects.toBeInstanceOf(SdkError);
    expect(calls).toBe(0);
  });

  test("honors an aborted stream", async () => {
    const controller = new AbortController();
    const model = audioModel({
      providerId: "test",
      generate: async () => ({
        content: [],
        provider: "test",
        model: "test-tts",
      }),
      edit: async () => ({ content: [], provider: "test", model: "test-tts" }),
      async *streamAudio() {
        yield { type: "sentence-synthesis", audio: { base64: "chunk" } };
        controller.abort();
        yield { type: "complete" };
      },
    });
    const events: AudioStreamEvent[] = [];

    await expect(
      (async () => {
        for await (const event of streamAudio({
          model,
          text: "hello",
          voice: "Cherry",
          signal: controller.signal,
        })) {
          events.push(event);
        }
      })()
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(events).toHaveLength(1);
  });
});
