import {
  type AudioContent,
  type AudioGenerationInput,
  type AudioStreamEvent,
  type AudioUsage,
  classifyHttpError,
  type GenerationResult,
  SdkError,
  type Transport,
} from "@ai-media/sdk";
import type { AliyunBailianConfig } from "../config/index.ts";

export interface AliyunQwenAudioOptions {
  readonly format?: "mp3" | "pcm" | "wav" | "opus";
  readonly sampleRate?: number;
  readonly volume?: number;
  readonly rate?: number;
  readonly pitch?: number;
  readonly enableSsml?: boolean;
  readonly wordTimestampEnabled?: boolean;
  readonly seed?: number;
  readonly languageHints?: readonly string[];
  readonly instruction?: string;
  readonly enableAigcTag?: boolean;
  readonly aigcPropagator?: string;
  readonly aigcPropagateId?: string;
  readonly hotFix?: unknown;
  readonly enableMarkdownFilter?: boolean;
  readonly languageType?: string;
  readonly instructions?: string;
  readonly optimizeInstructions?: boolean;
}

export interface AliyunMiniMaxOptions {
  readonly voiceSetting?: {
    readonly voiceId?: string;
    readonly speed?: number;
    readonly vol?: number;
    readonly pitch?: number;
    readonly emotion?: string;
  };
  readonly audioSetting?: {
    readonly sampleRate?: number;
    readonly bitrate?: number;
    readonly format?: "mp3" | "wav" | "pcm";
    readonly channel?: number;
  };
}

export interface AliyunAudioInput extends AudioGenerationInput {
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

export function readAudioOptions(
  providerOptions?: Readonly<Record<string, unknown>>
): AliyunQwenAudioOptions & AliyunMiniMaxOptions {
  const raw = providerOptions?.aliyun;
  if (typeof raw !== "object" || raw === null) return {};
  const value = raw as Record<string, unknown>;
  return value as AliyunQwenAudioOptions & AliyunMiniMaxOptions;
}

export function mimeType(format: string | undefined): string | undefined {
  if (format === undefined) return undefined;
  if (format === "pcm") return "audio/pcm";
  return `audio/${format}`;
}

export async function generateAliyunAudio(
  transport: Transport,
  config: AliyunBailianConfig,
  model: string,
  input: AudioGenerationInput,
  family: "qwen-audio-tts" | "qwen-tts" | "minimax-tts"
): Promise<GenerationResult<AudioContent[]>> {
  const options = readAudioOptions(input.providerOptions);
  const body =
    family === "qwen-audio-tts"
      ? {
          model,
          input: {
            text: input.text,
            voice: input.voice,
            format: options.format,
            sample_rate: options.sampleRate,
            volume: options.volume,
            rate: options.rate,
            pitch: options.pitch,
            enable_ssml: options.enableSsml,
            word_timestamp_enabled: options.wordTimestampEnabled,
            seed: options.seed,
            language_hints: options.languageHints,
            instruction: options.instruction,
            enable_aigc_tag: options.enableAigcTag,
            aigc_propagator: options.aigcPropagator,
            aigc_propagate_id: options.aigcPropagateId,
            hot_fix: options.hotFix,
            enable_markdown_filter: options.enableMarkdownFilter,
          },
        }
      : family === "qwen-tts"
        ? {
            model,
            input: {
              text: input.text,
              voice: input.voice,
              language_type: options.languageType,
              instructions: options.instructions,
              optimize_instructions: options.optimizeInstructions,
            },
          }
        : {
            model,
            input: {
              text: input.text,
              voice_setting: {
                voice_id: options.voiceSetting?.voiceId ?? input.voice,
                speed: options.voiceSetting?.speed,
                vol: options.voiceSetting?.vol,
                pitch: options.voiceSetting?.pitch,
                emotion: options.voiceSetting?.emotion,
              },
              audio_setting: {
                sample_rate: options.audioSetting?.sampleRate,
                bitrate: options.audioSetting?.bitrate,
                format: options.audioSetting?.format,
                channel: options.audioSetting?.channel,
              },
            },
          };
  const path =
    family === "qwen-audio-tts"
      ? "/services/audio/tts/SpeechSynthesizer"
      : "/services/aigc/multimodal-generation/generation";
  const response = await transport.send<Record<string, unknown>>({
    url: `${config.baseUrl.replace(/\/+$/, "")}${path}`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });
  if (response.status < 200 || response.status >= 300)
    throw classifyHttpError(response.status, "Aliyun audio generation failed");
  const output = (response.data?.output ?? {}) as Record<string, unknown>;
  const audio = (output.audio ?? {}) as Record<string, unknown>;
  const demoAudio =
    typeof output.demo_audio === "string" ? output.demo_audio : undefined;
  const format =
    typeof audio.format === "string" ? audio.format : options.format;
  const sampleRate =
    typeof audio.sample_rate === "number"
      ? audio.sample_rate
      : options.sampleRate;
  const content: AudioContent = {
    ...(typeof audio.url === "string"
      ? { url: audio.url }
      : demoAudio
        ? { url: demoAudio }
        : {}),
    ...(typeof audio.data === "string" && audio.data.length > 0
      ? { base64: audio.data }
      : {}),
    ...(typeof audio.id === "string" ? { id: audio.id } : {}),
    ...(typeof audio.expires_at === "number"
      ? { expiresAt: audio.expires_at }
      : {}),
    ...(format ? { format, mimeType: mimeType(format) } : {}),
    ...(sampleRate !== undefined ? { sampleRate } : {}),
    ...(typeof audio.channels === "number" ? { channels: audio.channels } : {}),
    ...(typeof audio.bit_depth === "number"
      ? { bitDepth: audio.bit_depth }
      : {}),
    ...(typeof audio.encoding === "string" ? { encoding: audio.encoding } : {}),
  };
  if (!content.url && !content.base64)
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Aliyun audio response contained no audio data",
    });
  return {
    content: [content],
    provider: "aliyun-bailian",
    model,
    requestId:
      typeof response.data?.request_id === "string"
        ? response.data.request_id
        : undefined,
    usage: mapUsage(response.data?.usage),
    raw: response.data,
  };
}

function mapUsage(value: unknown): AudioUsage | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const usage = value as Record<string, unknown>;
  return {
    ...(typeof usage.characters === "number"
      ? { characters: usage.characters }
      : {}),
    ...(typeof usage.input_tokens === "number"
      ? { inputTokens: usage.input_tokens }
      : {}),
    ...(typeof usage.output_tokens === "number"
      ? { outputTokens: usage.output_tokens }
      : {}),
    ...(typeof usage.total_tokens === "number"
      ? { totalTokens: usage.total_tokens }
      : {}),
    ...(typeof usage.count === "number" ? { count: usage.count } : {}),
    raw: value,
  };
}

export async function* streamAliyunAudio(
  transport: Transport,
  config: AliyunBailianConfig,
  model: string,
  input: AudioGenerationInput,
  family: "qwen-audio-tts" | "qwen-tts" | "minimax-tts",
  signal?: AbortSignal
): AsyncIterable<AudioStreamEvent> {
  if (typeof transport.sendStream !== "function") {
    throw new SdkError({
      code: "NOT_IMPLEMENTED",
      message: "Streaming transport is not available",
    });
  }
  const options = readAudioOptions(input.providerOptions);
  const body =
    family === "qwen-audio-tts"
      ? {
          model,
          input: {
            text: input.text,
            voice: input.voice,
            format: options.format,
            sample_rate: options.sampleRate,
            volume: options.volume,
            rate: options.rate,
            pitch: options.pitch,
            enable_ssml: options.enableSsml,
            word_timestamp_enabled: options.wordTimestampEnabled,
            instruction: options.instruction,
          },
        }
      : family === "qwen-tts"
        ? {
            model,
            input: {
              text: input.text,
              voice: input.voice,
              language_type: options.languageType,
              instructions: options.instructions,
              optimize_instructions: options.optimizeInstructions,
            },
          }
        : {
            model,
            input: {
              text: input.text,
              voice_setting: {
                voice_id: options.voiceSetting?.voiceId ?? input.voice,
                speed: options.voiceSetting?.speed,
                vol: options.voiceSetting?.vol,
                pitch: options.voiceSetting?.pitch,
                emotion: options.voiceSetting?.emotion,
              },
              audio_setting: options.audioSetting,
            },
          };
  const path =
    family === "qwen-audio-tts"
      ? "/services/audio/tts/SpeechSynthesizer"
      : "/services/aigc/multimodal-generation/generation";
  const response = await transport.sendStream({
    url: `${config.baseUrl.replace(/\/+$/, "")}${path}`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-SSE": "enable",
    },
    signal,
    body,
  });
  if (response.status < 200 || response.status >= 300)
    throw classifyHttpError(response.status, "Aliyun audio streaming failed");
  let pending = "";
  for await (const chunk of response.body) {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      const event = parseAudioStreamEvent(payload);
      if (event) yield event;
    }
  }
}

function parseAudioStreamEvent(payload: string): AudioStreamEvent | undefined {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Aliyun returned invalid audio stream data",
    });
  }
  const output = (data.output ?? {}) as Record<string, unknown>;
  const audio = (output.audio ?? {}) as Record<string, unknown>;
  const type = output.type;
  const index = (output.sentence as Record<string, unknown> | undefined)?.index;
  if (type === "sentence-begin")
    return {
      type,
      index: typeof index === "number" ? index : undefined,
      text:
        typeof output.original_text === "string"
          ? output.original_text
          : undefined,
    };
  if (type === "sentence-end")
    return {
      type,
      index: typeof index === "number" ? index : undefined,
      text:
        typeof output.original_text === "string"
          ? output.original_text
          : undefined,
      words: Array.isArray(
        (output.sentence as Record<string, unknown> | undefined)?.words
      )
        ? (
            (output.sentence as Record<string, unknown>).words as Array<
              Record<string, unknown>
            >
          ).map((word) => ({
            text: typeof word.text === "string" ? word.text : "",
            ...(typeof word.begin_index === "number"
              ? { beginIndex: word.begin_index }
              : {}),
            ...(typeof word.end_index === "number"
              ? { endIndex: word.end_index }
              : {}),
            ...(typeof word.begin_time === "number"
              ? { beginTime: word.begin_time }
              : {}),
            ...(typeof word.end_time === "number"
              ? { endTime: word.end_time }
              : {}),
          }))
        : undefined,
    };
  if (typeof audio.data === "string" && audio.data.length > 0)
    return {
      type: "sentence-synthesis",
      index: typeof index === "number" ? index : undefined,
      audio: {
        base64: audio.data,
        encoding: "base64",
        format: "pcm",
        mimeType: "audio/pcm",
        ...(typeof audio.sample_rate === "number"
          ? { sampleRate: audio.sample_rate }
          : {}),
        ...(typeof audio.channels === "number"
          ? { channels: audio.channels }
          : {}),
        ...(typeof audio.bit_depth === "number"
          ? { bitDepth: audio.bit_depth }
          : {}),
        ...(typeof audio.id === "string" ? { id: audio.id } : {}),
      },
    };
  if (output.finish_reason === "stop")
    return {
      type: "complete",
      audio:
        typeof audio.url === "string"
          ? {
              url: audio.url,
              ...(typeof audio.expires_at === "number"
                ? { expiresAt: audio.expires_at }
                : {}),
            }
          : undefined,
    };
  if (type === "error" || output.code || output.error) {
    const source =
      typeof output.error === "object" && output.error !== null
        ? (output.error as Record<string, unknown>)
        : output;
    return {
      type: "error",
      code: typeof source.code === "string" ? source.code : "PROVIDER_ERROR",
      message:
        typeof source.message === "string"
          ? source.message
          : "Aliyun audio stream failed",
    };
  }
  return undefined;
}
