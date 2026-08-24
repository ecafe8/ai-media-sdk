import {
  type AliyunBailianProvider,
  createAliyunBailianProvider,
} from "@ai-media/provider-aliyun-bailian";
import { type AudioStreamEvent, SdkError } from "@ai-media/sdk";
import type { AliyunUploader } from "@ai-media/uploader/aliyun";
import { createAliyunUploader } from "@ai-media/uploader/aliyun";
import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import {
  PlaygroundConfigurationError,
  resolveAliyunCredentials,
} from "./provider-credentials";
import { createProviderSelection } from "./server";
import type { PlaygroundCredentials, PlaygroundRequest } from "./types";

export const MAX_AUDIO_JSON_BYTES = 64 * 1024;
export const MAX_AUDIO_TEXT_LENGTH = 10_000;
export const MAX_AUDIO_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_AUDIO_MULTIPART_BYTES = MAX_AUDIO_UPLOAD_BYTES + 1024 * 1024;

interface SharedLimiter {
  allow(key: string): boolean | Promise<boolean>;
}

declare global {
  // Provided by the deployment's shared rate-limit integration.
  var __PLAYGROUND_SHARED_AUDIO_LIMITER__: SharedLimiter | undefined;
}

export async function consumeAudioLimit(
  request: Request
): Promise<Response | undefined> {
  const limiter = globalThis.__PLAYGROUND_SHARED_AUDIO_LIMITER__;
  if (!limiter)
    return errorResponse(
      "RATE_LIMIT_UNAVAILABLE",
      "Audio features are unavailable.",
      503
    );
  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await limiter.allow(client))) {
    return errorResponse(
      "RATE_LIMITED",
      "Too many audio requests. Try again later.",
      429
    );
  }
  return undefined;
}

export async function readJson(request: Request): Promise<unknown | Response> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_AUDIO_JSON_BYTES) {
    return errorResponse(
      "VALIDATION_ERROR",
      "The request body exceeds the 64 KiB limit.",
      413
    );
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return errorResponse(
      "VALIDATION_ERROR",
      "The request body is invalid.",
      400
    );
  }
}

export function parseAudioRequest(
  value: unknown
): PlaygroundRequest | Response {
  if (!isRecord(value) || value.family !== undefined) {
    return errorResponse("VALIDATION_ERROR", "Invalid audio request.", 422);
  }
  if (
    value.provider !== "aliyun-bailian" ||
    typeof value.model !== "string" ||
    value.modality !== "audio" ||
    typeof value.text !== "string" ||
    value.text.trim().length === 0 ||
    value.text.length > MAX_AUDIO_TEXT_LENGTH ||
    typeof value.voice !== "string" ||
    value.voice.trim().length === 0
  ) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Audio requests require non-empty text and voice.",
      422
    );
  }
  const credentials = parseCredentials(value.credentials);
  if (value.credentials !== undefined && !credentials) {
    return errorResponse("VALIDATION_ERROR", "Invalid credentials.", 422);
  }
  return {
    provider: "aliyun-bailian",
    model: value.model,
    modality: "audio",
    prompt: "",
    text: value.text,
    voice: value.voice,
    providerOptions: isRecord(value.providerOptions)
      ? value.providerOptions
      : undefined,
    credentials,
  };
}

export function createAudioProvider(request: PlaygroundRequest): {
  readonly provider: AliyunBailianProvider;
  readonly instance: ReturnType<AliyunBailianProvider["audio"]>;
} {
  const config = loadConfig();
  const provider = createAliyunBailianProvider(
    resolveAliyunCredentials(request.credentials, config)
  );
  const selection = createProviderSelection(request);
  return {
    provider,
    instance: selection.instance as ReturnType<AliyunBailianProvider["audio"]>,
  };
}

export function createAliyunProvider(
  request: PlaygroundRequest
): AliyunBailianProvider {
  const config = loadConfig();
  return createAliyunBailianProvider(
    resolveAliyunCredentials(request.credentials, config)
  );
}

export function toAudioError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof PlaygroundConfigurationError) {
    return { code: "CONFIGURATION_ERROR", message: error.message };
  }
  if (error instanceof SdkError) {
    const message =
      error.code === "INVALID_REQUEST"
        ? error.message
        : "The audio request failed.";
    return { code: error.code, message };
  }
  return { code: "UNKNOWN", message: "The audio request failed." };
}

export function errorResponse(
  code: string,
  message: string,
  status: number
): Response {
  return NextResponse.json(
    { status: "failed", error: { code, message } },
    { status }
  );
}

export function credentialsFromHeader(
  request: Request
): PlaygroundCredentials | undefined {
  const value = request.headers.get("x-playground-credentials");
  if (!value) return undefined;
  try {
    return parseCredentials(JSON.parse(value));
  } catch {
    return undefined;
  }
}

export function sseEvent(
  event: AudioStreamEvent | { type: "error"; code: string; message: string }
): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCredentials(value: unknown): PlaygroundCredentials | undefined {
  if (value === undefined) return undefined;
  if (
    !isRecord(value) ||
    typeof value.apiKey !== "string" ||
    value.apiKey.trim() === ""
  )
    return undefined;
  if (value.baseUrl !== undefined && typeof value.baseUrl !== "string")
    return undefined;
  return {
    apiKey: value.apiKey,
    ...(typeof value.baseUrl === "string" ? { baseUrl: value.baseUrl } : {}),
  };
}

export function createUploader(request: PlaygroundRequest): AliyunUploader {
  const config = loadConfig();
  const credentials = resolveAliyunCredentials(request.credentials, config);
  return createAliyunUploader({
    apiKey: credentials.apiKey,
    baseUrl: credentials.baseUrl,
    timeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
  });
}
