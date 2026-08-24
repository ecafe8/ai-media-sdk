import { describe, expect, test } from "bun:test";
import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import type { Transport, TransportRequest } from "@ai-media/sdk";
import { generateAudio } from "@ai-media/sdk";

const config = {
  apiKey: "test-key",
  baseUrl: "https://workspace.cn-beijing.maas.aliyuncs.com/api/v1",
};

function fakeTransport(response: unknown) {
  const requests: Array<Record<string, unknown>> = [];
  return {
    requests,
    transport: {
      async send<T>(request: TransportRequest) {
        requests.push(request as unknown as Record<string, unknown>);
        return { status: 200, headers: {}, data: response as T };
      },
    } satisfies Transport,
  };
}

describe("Aliyun audio and voice APIs", () => {
  test("maps Qwen-Audio URL output", async () => {
    const fake = fakeTransport({
      request_id: "request-1",
      output: {
        audio: {
          url: "https://example.com/audio.wav",
          id: "audio-1",
          expires_at: 123,
        },
      },
    });
    const provider = createAliyunBailianProvider(config, {
      transport: fake.transport,
    });
    const result = await generateAudio({
      model: provider.audio("qwen-audio-3.0-tts-flash"),
      text: "你好，欢迎使用语音合成。",
      voice: "longanhuan_v3.6",
      providerOptions: { aliyun: { format: "wav", sampleRate: 24000 } },
    });
    expect(result.content[0]).toEqual({
      url: "https://example.com/audio.wav",
      id: "audio-1",
      expiresAt: 123,
      format: "wav",
      mimeType: "audio/wav",
      sampleRate: 24000,
    });
    expect(fake.requests[0]?.url).toBe(
      `${config.baseUrl}/services/audio/tts/SpeechSynthesizer`
    );
  });

  test("maps Qwen-TTS and MiniMax request protocols", async () => {
    const fake = fakeTransport({
      request_id: "request-2",
      output: { audio: { data: "base64-audio" } },
    });
    const provider = createAliyunBailianProvider(config, {
      transport: fake.transport,
    });
    await generateAudio({
      model: provider.audio("qwen3-tts-flash"),
      text: "Hello",
      voice: "Cherry",
      providerOptions: { aliyun: { languageType: "English" } },
    });
    await generateAudio({
      model: provider.audio("MiniMax/speech-2.8-hd"),
      text: "你好",
      voice: "male-qn-qingse",
      providerOptions: {
        aliyun: {
          voiceSetting: { emotion: "happy" },
          audioSetting: { format: "mp3", sampleRate: 32000 },
        },
      },
    });
    expect(fake.requests[0]?.url).toBe(
      `${config.baseUrl}/services/aigc/multimodal-generation/generation`
    );
    expect(fake.requests[1]?.url).toBe(fake.requests[0]?.url);
    const body = fake.requests[1]?.body as
      | { input?: { voice_setting?: unknown } }
      | undefined;
    expect(body?.input?.voice_setting).toBeDefined();
  });

  test("maps MiniMax demo audio and preserves usage", async () => {
    const fake = fakeTransport({
      request_id: "request-minimax",
      output: { demo_audio: "https://example.com/demo.mp3" },
      usage: { characters: 2 },
    });
    const provider = createAliyunBailianProvider(config, {
      transport: fake.transport,
    });
    const result = await generateAudio({
      model: provider.audio("MiniMax/speech-2.8-turbo"),
      text: "你好",
      voice: "MiniMax001",
    });
    expect(result.content[0]?.url).toBe("https://example.com/demo.mp3");
    expect(result.usage).toMatchObject({ characters: 2 });
  });

  test("maps stream PCM metadata and terminal errors", async () => {
    const fake = fakeTransport({});
    const provider = createAliyunBailianProvider(config, {
      transport: {
        ...fake.transport,
        async sendStream() {
          return {
            status: 200,
            headers: {},
            body: (async function* () {
              yield `data: ${JSON.stringify({ output: { type: "sentence-synthesis", audio: { data: "pcm", sample_rate: 24000, channels: 1, bit_depth: 16 } } })}\n`;
              yield `data: ${JSON.stringify({ output: { type: "error", code: "BAD_AUDIO", message: "failed" } })}\n`;
            })(),
          };
        },
      },
    });
    const events = [];
    for await (const event of provider.audio("cosyvoice-v3.5-flash").adapter
      .streamAudio!({
      provider: "aliyun-bailian",
      model: "cosyvoice-v3.5-flash",
      modality: "audio",
      input: { text: "hello", voice: "voice" },
    }))
      events.push(event);
    expect(events[0]).toMatchObject({
      audio: { sampleRate: 24000, channels: 1, bitDepth: 16 },
    });
    expect(events[1]).toEqual({
      type: "error",
      code: "BAD_AUDIO",
      message: "failed",
    });
  });

  test("normalizes designed voice preview audio", async () => {
    const fake = fakeTransport({
      request_id: "request-3",
      output: {
        voice_id: "designed-voice",
        target_model: "cosyvoice-v3.5-plus",
        preview_audio: {
          data: "preview-base64",
          sample_rate: 24000,
          response_format: "wav",
        },
      },
    });
    const provider = createAliyunBailianProvider(config, {
      transport: fake.transport,
    });
    const result = await provider.voiceDesign.create({
      protocol: "qwen-audio",
      targetModel: "cosyvoice-v3.5-plus",
      voicePrompt: "沉稳的中年男性，音色低沉浑厚",
      previewText: "各位听众朋友们大家好，欢迎收听本期节目",
      prefix: "announcer",
    });
    expect(result.voice?.id).toBe("designed-voice");
    expect(result.previewAudio).toEqual({
      base64: "preview-base64",
      sampleRate: 24000,
      format: "wav",
      mimeType: "audio/wav",
    });
  });

  test("routes Qwen voice management actions explicitly", async () => {
    const fake = fakeTransport({
      request_id: "request-4",
      output: { voice: "qwen-voice", target_model: "qwen3-tts-vc-2026-01-22" },
    });
    const provider = createAliyunBailianProvider(config, {
      transport: fake.transport,
    });
    await provider.voiceCloning.create({
      protocol: "qwen",
      targetModel: "qwen3-tts-vc-2026-01-22",
      preferredName: "my_voice",
      audioUrl: "https://example.com/sample.wav",
    });
    await provider.voiceCloning.delete({ protocol: "qwen", id: "qwen-voice" });
    const body = fake.requests[1]?.body as
      | { model?: string; input?: { action?: string; voice?: string } }
      | undefined;
    expect(body?.model).toBe("qwen-voice-enrollment");
    expect(body?.input).toEqual({ action: "delete", voice: "qwen-voice" });
  });
});
