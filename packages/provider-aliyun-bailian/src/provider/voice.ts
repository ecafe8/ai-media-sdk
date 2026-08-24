import type {
  AudioContent,
  Transport,
  VoiceDesignResult,
  VoiceListResult,
  VoiceOperationResult,
  VoiceProfile,
} from "@ai-media/sdk";
import { classifyHttpError, SdkError } from "@ai-media/sdk";
import type { AliyunBailianConfig } from "../config/index.ts";

const CUSTOMIZATION_PATH = "/services/audio/tts/customization";

export interface CloneCreateInput {
  readonly protocol: "qwen-audio" | "qwen";
  readonly targetModel: string;
  readonly audioUrl?: string;
  readonly audio?: { readonly data: string };
  readonly text?: string;
  readonly prefix?: string;
  readonly preferredName?: string;
  readonly languageHints?: readonly string[];
  readonly language?: string;
}

export interface VoiceResourceManager {
  create(input: CloneCreateInput): Promise<VoiceOperationResult>;
  list(input: {
    readonly protocol: "qwen-audio" | "qwen";
    readonly prefix?: string;
    readonly pageIndex?: number;
    readonly pageSize?: number;
  }): Promise<VoiceListResult>;
  get(input: {
    readonly protocol: "qwen-audio" | "qwen";
    readonly id: string;
  }): Promise<VoiceOperationResult>;
  delete(input: {
    readonly protocol: "qwen-audio" | "qwen";
    readonly id: string;
  }): Promise<VoiceOperationResult>;
}

export interface VoiceCloningManager extends VoiceResourceManager {
  update(input: {
    readonly id: string;
    readonly audioUrl: string;
  }): Promise<VoiceOperationResult>;
}

export interface VoiceDesignCreateInput {
  readonly protocol: "qwen-audio" | "qwen";
  readonly targetModel: string;
  readonly voicePrompt: string;
  readonly previewText: string;
  readonly prefix?: string;
  readonly preferredName?: string;
  readonly languageHints?: readonly string[];
  readonly language?: string;
  readonly sampleRate?: number;
  readonly responseFormat?: "pcm" | "wav" | "mp3" | "opus";
}

export interface VoiceDesignManager
  extends Omit<VoiceResourceManager, "create"> {
  create(input: VoiceDesignCreateInput): Promise<VoiceDesignResult>;
}

export function createVoiceManagers(
  config: AliyunBailianConfig,
  transport: Transport
): {
  readonly voiceCloning: VoiceCloningManager;
  readonly voiceDesign: VoiceDesignManager;
} {
  const voiceCloning: VoiceCloningManager = {
    create: (input) => sendClone(config, transport, input),
    list: (input) =>
      sendList(
        config,
        transport,
        input.protocol === "qwen-audio"
          ? "voice-enrollment"
          : "qwen-voice-enrollment",
        input.protocol === "qwen-audio" ? "list_voice" : "list",
        input
      ),
    get: (input) =>
      sendOperation(
        config,
        transport,
        input.protocol === "qwen-audio"
          ? "voice-enrollment"
          : "qwen-voice-enrollment",
        input.protocol === "qwen-audio" ? "query_voice" : "query",
        input.protocol === "qwen-audio"
          ? { voice_id: input.id }
          : { voice: input.id }
      ),
    update: (input) =>
      sendOperation(config, transport, "voice-enrollment", "update_voice", {
        voice_id: input.id,
        url: input.audioUrl,
      }),
    delete: (input) =>
      sendOperation(
        config,
        transport,
        input.protocol === "qwen-audio"
          ? "voice-enrollment"
          : "qwen-voice-enrollment",
        input.protocol === "qwen-audio" ? "delete_voice" : "delete",
        input.protocol === "qwen-audio"
          ? { voice_id: input.id }
          : { voice: input.id }
      ),
  };
  const voiceDesign: VoiceDesignManager = {
    create: (input) => sendDesign(config, transport, input),
    list: (input) =>
      sendList(
        config,
        transport,
        input.protocol === "qwen-audio"
          ? "voice-enrollment"
          : "qwen-voice-design",
        input.protocol === "qwen-audio" ? "list_voice" : "list",
        input
      ),
    get: (input) =>
      sendOperation(
        config,
        transport,
        input.protocol === "qwen-audio"
          ? "voice-enrollment"
          : "qwen-voice-design",
        input.protocol === "qwen-audio" ? "query_voice" : "query",
        input.protocol === "qwen-audio"
          ? { voice_id: input.id }
          : { voice: input.id }
      ),
    delete: (input) =>
      sendOperation(
        config,
        transport,
        input.protocol === "qwen-audio"
          ? "voice-enrollment"
          : "qwen-voice-design",
        input.protocol === "qwen-audio" ? "delete_voice" : "delete",
        input.protocol === "qwen-audio"
          ? { voice_id: input.id }
          : { voice: input.id }
      ),
  };
  return { voiceCloning, voiceDesign };
}

async function sendClone(
  config: AliyunBailianConfig,
  transport: Transport,
  input: CloneCreateInput
): Promise<VoiceOperationResult> {
  if (input.audioUrl === undefined && input.audio === undefined)
    throw invalid("clone audio is required");
  const qwenAudio = input.protocol === "qwen-audio";
  const model = qwenAudio ? "voice-enrollment" : "qwen-voice-enrollment";
  if (qwenAudio && (!input.prefix || !/^[A-Za-z0-9]{1,10}$/.test(input.prefix)))
    throw invalid("prefix must be 1-10 alphanumeric characters");
  if (
    !qwenAudio &&
    (!input.preferredName || !/^[A-Za-z0-9_]{1,16}$/.test(input.preferredName))
  )
    throw invalid(
      "preferredName must be 1-16 alphanumeric or underscore characters"
    );
  const body = qwenAudio
    ? {
        model,
        input: {
          action: "create_voice",
          target_model: input.targetModel,
          prefix: input.prefix,
          url: input.audioUrl,
          language_hints: input.languageHints,
        },
      }
    : {
        model,
        input: {
          action: "create",
          target_model: input.targetModel,
          preferred_name: input.preferredName,
          audio:
            input.audio ??
            (input.audioUrl ? { data: input.audioUrl } : undefined),
          text: input.text,
          language: input.language,
        },
      };
  return send<VoiceOperationResult>(config, transport, body, mapOperation);
}

async function sendDesign(
  config: AliyunBailianConfig,
  transport: Transport,
  input: VoiceDesignCreateInput
): Promise<VoiceDesignResult> {
  const qwenAudio = input.protocol === "qwen-audio";
  if (
    input.voicePrompt.length === 0 ||
    input.voicePrompt.length > (qwenAudio ? 500 : 2048)
  )
    throw invalid("voicePrompt exceeds the model limit");
  if (
    input.previewText.length < (qwenAudio ? 15 : 1) ||
    input.previewText.length > (qwenAudio ? 200 : 1024)
  )
    throw invalid("previewText exceeds the model limit");
  const model = qwenAudio ? "voice-enrollment" : "qwen-voice-design";
  const body = qwenAudio
    ? {
        model,
        input: {
          action: "create_voice",
          target_model: input.targetModel,
          voice_prompt: input.voicePrompt,
          preview_text: input.previewText,
          prefix: input.prefix,
          language_hints: input.languageHints,
        },
        parameters: {
          sample_rate: input.sampleRate,
          response_format: input.responseFormat,
        },
      }
    : {
        model,
        input: {
          action: "create",
          target_model: input.targetModel,
          voice_prompt: input.voicePrompt,
          preview_text: input.previewText,
          preferred_name: input.preferredName,
          language: input.language,
        },
        parameters: {
          sample_rate: input.sampleRate,
          response_format: input.responseFormat,
        },
      };
  return send<VoiceDesignResult>(config, transport, body, mapDesign);
}

async function sendList(
  config: AliyunBailianConfig,
  transport: Transport,
  model: string,
  action: string,
  input?: {
    readonly prefix?: string;
    readonly pageIndex?: number;
    readonly pageSize?: number;
  }
): Promise<VoiceListResult> {
  const body = {
    model,
    input: {
      action,
      ...(input?.prefix ? { prefix: input.prefix } : {}),
      ...(input?.pageIndex !== undefined
        ? { page_index: input.pageIndex }
        : {}),
      ...(input?.pageSize !== undefined ? { page_size: input.pageSize } : {}),
    },
  };
  return send<VoiceListResult>(config, transport, body, mapList);
}

async function sendOperation(
  config: AliyunBailianConfig,
  transport: Transport,
  model: string,
  action: string,
  fields: Record<string, unknown>
): Promise<VoiceOperationResult> {
  return send<VoiceOperationResult>(
    config,
    transport,
    { model, input: { action, ...fields } },
    mapOperation
  );
}

async function send<T>(
  config: AliyunBailianConfig,
  transport: Transport,
  body: unknown,
  mapper: (data: Record<string, unknown>) => T
): Promise<T> {
  const response = await transport.send<Record<string, unknown>>({
    url: `${config.baseUrl.replace(/\/+$/, "")}${CUSTOMIZATION_PATH}`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });
  if (response.status < 200 || response.status >= 300)
    throw classifyHttpError(response.status, "Aliyun voice operation failed");
  return mapper(response.data ?? {});
}

function mapProfile(value: Record<string, unknown>): VoiceProfile | undefined {
  const id =
    typeof value.voice_id === "string"
      ? value.voice_id
      : typeof value.voice === "string"
        ? value.voice
        : undefined;
  if (!id) return undefined;
  return {
    id,
    ...(typeof value.target_model === "string"
      ? { targetModel: value.target_model }
      : {}),
    ...(typeof value.gmt_create === "string"
      ? { createdAt: value.gmt_create }
      : {}),
    ...(typeof value.gmt_modified === "string"
      ? { updatedAt: value.gmt_modified }
      : {}),
    ...(typeof value.status === "string" ? { status: value.status } : {}),
    ...(typeof value.language === "string" ? { language: value.language } : {}),
    ...(typeof value.voice_prompt === "string"
      ? { voicePrompt: value.voice_prompt }
      : {}),
    ...(typeof value.preview_text === "string"
      ? { previewText: value.preview_text }
      : {}),
    ...(typeof value.resource_link === "string"
      ? { resourceLink: value.resource_link }
      : {}),
    raw: value,
  };
}

function mapOperation(data: Record<string, unknown>): VoiceOperationResult {
  const output = (data.output ?? {}) as Record<string, unknown>;
  return {
    voice: mapProfile(output),
    requestId:
      typeof data.request_id === "string" ? data.request_id : undefined,
    raw: data,
  };
}

function mapList(data: Record<string, unknown>): VoiceListResult {
  const output = (data.output ?? {}) as Record<string, unknown>;
  const list = Array.isArray(output.voice_list) ? output.voice_list : [];
  return {
    voices: list
      .map((item) => mapProfile(item as Record<string, unknown>))
      .filter((item): item is VoiceProfile => item !== undefined),
    ...(typeof output.page_index === "number"
      ? { pageIndex: output.page_index }
      : {}),
    ...(typeof output.page_size === "number"
      ? { pageSize: output.page_size }
      : {}),
    ...(typeof output.total_count === "number"
      ? { totalCount: output.total_count }
      : {}),
    requestId:
      typeof data.request_id === "string" ? data.request_id : undefined,
    raw: data,
  };
}

function mapDesign(data: Record<string, unknown>): VoiceDesignResult {
  const operation = mapOperation(data);
  const output = (data.output ?? {}) as Record<string, unknown>;
  const preview = (output.preview_audio ?? {}) as Record<string, unknown>;
  const format =
    typeof preview.response_format === "string"
      ? preview.response_format
      : undefined;
  const previewAudio: AudioContent | undefined =
    typeof preview.data === "string"
      ? {
          base64: preview.data,
          ...(format ? { format, mimeType: `audio/${format}` } : {}),
          ...(typeof preview.sample_rate === "number"
            ? { sampleRate: preview.sample_rate }
            : {}),
        }
      : undefined;
  return { ...operation, ...(previewAudio ? { previewAudio } : {}) };
}

function invalid(message: string): SdkError {
  return new SdkError({ code: "INVALID_REQUEST", message });
}
