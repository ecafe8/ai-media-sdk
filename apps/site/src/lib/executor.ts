import type { AliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import type { AzureOpenAIProvider } from "@ai-media/provider-azure-openai";
import type { MiniMaxProvider } from "@ai-media/provider-minimax";
import type { VolcengineProvider } from "@ai-media/provider-volcengine";
import {
  type AudioModelInstance,
  editImage,
  type GenerationResult,
  generateAudio,
  generateImage,
  type ImageContent,
  type ImageModelInstance,
  SdkError,
  type SdkErrorCode,
  streamAudio,
  submitImageTask,
  submitVideoTask,
  type VideoModelInstance,
  type VoiceDesignResult,
  type VoiceListResult,
  type VoiceOperationResult,
} from "@ai-media/sdk";

import {
  getConfirmedHosts,
  getCredentials,
  isCredentialsComplete,
  missingCredentialFields,
  PROVIDER_LABELS,
} from "./key-store";
import { getSiteModel } from "./playground/registry";
import type {
  ImageInput,
  SiteAudioStreamRequest,
  SiteErrorCode,
  SiteGenerationRequest,
  SiteModel,
  SitePlaygroundResponse,
  SiteVoiceCloningInput,
  SiteVoiceDesignInput,
} from "./playground/types";
import {
  buildSiteProvider,
  createSiteAliyunUploader,
  EndpointNotUsableError,
} from "./provider-client";

/**
 * Client-side playground executor. Mirrors the `apps/web` server executor
 * but runs entirely in the browser: credentials come from the key store,
 * provider calls go direct, and async tasks are polled here.
 */

const POLL_INTERVAL_MS = 15_000;
const VIDEO_TASK_WAIT_TIMEOUT_MS = 600_000;

export function toImageContent(input: ImageInput): ImageContent {
  if ("url" in input) return { url: input.url };
  return { base64: input.base64, mimeType: input.mimeType };
}

function configurationError(
  message: string,
  detail?: string
): SitePlaygroundResponse {
  return {
    status: "failed",
    error: {
      code: "CONFIGURATION_ERROR",
      message,
      ...(detail ? { detail } : {}),
    },
  };
}

function localError(
  code: SiteErrorCode,
  message: string
): SitePlaygroundResponse {
  return {
    status: "failed",
    error: { code, message },
  };
}

function buildVideoProviderOptions(
  request: SiteGenerationRequest
): Record<string, unknown> {
  if (request.provider === "minimax") {
    const minimax: Record<string, unknown> = {};
    if (request.resolution) minimax.resolution = request.resolution;
    if (request.duration !== undefined) minimax.duration = request.duration;
    if (request.ratio) minimax.ratio = request.ratio;
    return { minimax };
  }
  const aliyun: Record<string, unknown> = { watermark: false };
  if (request.resolution) aliyun.resolution = request.resolution;
  if (request.duration !== undefined) aliyun.duration = request.duration;
  if (request.audioSetting) aliyun.audio_setting = request.audioSetting;
  if (request.ratio) aliyun.ratio = request.ratio;
  return { aliyun };
}

function assertAudioRequest(request: SiteGenerationRequest): SiteModel {
  const model = getSiteModel(request.provider, request.model);
  if (model?.modality !== "audio") {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "The selected provider/model does not support audio",
    });
  }
  if (!request.text?.trim()) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "text must not be empty",
    });
  }
  if (!request.voice?.trim()) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "voice must not be empty",
    });
  }
  return model;
}

function audioInstance(
  provider: AliyunBailianProvider,
  model: string
): AudioModelInstance {
  return provider.audio(model);
}

export async function executeSiteAudioStream(
  request: SiteAudioStreamRequest
): Promise<AsyncIterable<import("@ai-media/sdk").AudioStreamEvent>> {
  const generationRequest: SiteGenerationRequest = {
    provider: request.provider,
    model: request.model,
    modality: "audio",
    prompt: "",
    text: request.text,
    voice: request.voice,
    providerOptions: request.providerOptions,
  };
  const model = assertAudioRequest(generationRequest);
  if (request.provider !== "aliyun-bailian") {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "Audio is only supported by Alibaba Bailian",
    });
  }
  const credentials = getCredentials(request.provider);
  if (!isCredentialsComplete(request.provider, credentials)) {
    throw new SdkError({
      code: "AUTH_ERROR",
      message: "Alibaba credentials are not configured",
    });
  }
  const provider = buildSiteProvider(
    request.provider,
    credentials!,
    getConfirmedHosts()
  ) as AliyunBailianProvider;
  return streamAudio({
    model: audioInstance(provider, model.id),
    text: request.text,
    voice: request.voice,
    providerOptions: request.providerOptions,
    signal: request.signal,
  });
}

function assertVoiceTarget(
  protocol: "qwen-audio" | "qwen",
  targetModel: string
): void {
  const model = getSiteModel("aliyun-bailian", targetModel);
  if (
    !model?.audio?.voiceResource?.targetModel ||
    !model.audio.voiceResource.protocols.includes(protocol)
  ) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "The voice protocol and target model are incompatible",
    });
  }
}

export async function executeSiteVoiceCloning(
  operation: "create" | "list" | "get" | "update" | "delete",
  input: SiteVoiceCloningInput & {
    readonly id?: string;
    readonly targetModel?: string;
  }
): Promise<VoiceOperationResult | VoiceListResult> {
  if (input.targetModel) assertVoiceTarget(input.protocol, input.targetModel);
  const provider = await siteAliyunProvider();
  if (operation === "create") {
    if (!input.targetModel)
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "A target model is required",
      });
    return provider.voiceCloning.create(
      input as SiteVoiceCloningInput & { readonly targetModel: string }
    );
  }
  if (operation === "list") return provider.voiceCloning.list(input);
  if (operation === "get")
    return provider.voiceCloning.get({
      protocol: input.protocol,
      id: input.id!,
    });
  if (operation === "delete")
    return provider.voiceCloning.delete({
      protocol: input.protocol,
      id: input.id!,
    });
  return provider.voiceCloning.update({
    id: input.id!,
    audioUrl: input.audioUrl!,
  });
}

export async function executeSiteVoiceDesign(
  operation: "create" | "list" | "get" | "delete",
  input: SiteVoiceDesignInput & {
    readonly id?: string;
    readonly targetModel?: string;
  }
): Promise<VoiceDesignResult | VoiceOperationResult | VoiceListResult> {
  if (input.targetModel) assertVoiceTarget(input.protocol, input.targetModel);
  const provider = await siteAliyunProvider();
  if (operation === "create") {
    if (!input.targetModel)
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "A target model is required",
      });
    return provider.voiceDesign.create(
      input as SiteVoiceDesignInput & { readonly targetModel: string }
    );
  }
  if (operation === "list") return provider.voiceDesign.list(input);
  if (operation === "get")
    return provider.voiceDesign.get({
      protocol: input.protocol,
      id: input.id!,
    });
  return provider.voiceDesign.delete({
    protocol: input.protocol,
    id: input.id!,
  });
}

export async function uploadSiteAudio(
  file: File,
  targetModel: string
): Promise<{ readonly url: string; readonly expiresAt: Date }> {
  const model = getSiteModel("aliyun-bailian", targetModel);
  if (!model?.audio?.voiceResource?.targetModel) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "A compatible audio target model is required",
    });
  }
  const credentials = getCredentials("aliyun-bailian");
  if (!isCredentialsComplete("aliyun-bailian", credentials)) {
    throw new SdkError({
      code: "AUTH_ERROR",
      message: "Alibaba credentials are not configured",
    });
  }
  const uploaded = await createSiteAliyunUploader(
    credentials!,
    getConfirmedHosts()
  ).upload({
    model: targetModel,
    fileBytes: new Uint8Array(await file.arrayBuffer()),
    fileName: file.name,
    mimeType: file.type,
  });
  return { url: uploaded.url, expiresAt: uploaded.expiresAt };
}

async function siteAliyunProvider(): Promise<AliyunBailianProvider> {
  const credentials = getCredentials("aliyun-bailian");
  if (!isCredentialsComplete("aliyun-bailian", credentials)) {
    throw new SdkError({
      code: "AUTH_ERROR",
      message: "Alibaba credentials are not configured",
    });
  }
  return buildSiteProvider(
    "aliyun-bailian",
    credentials!,
    getConfirmedHosts()
  ) as AliyunBailianProvider;
}

export async function executeSiteRequest(
  request: SiteGenerationRequest
): Promise<SitePlaygroundResponse> {
  const credentials = getCredentials(request.provider);
  if (!isCredentialsComplete(request.provider, credentials)) {
    const missing = missingCredentialFields(request.provider, credentials);
    return configurationError(
      `${PROVIDER_LABELS[request.provider]} is missing credentials: ${missing.join(", ")}. Configure them in API settings.`,
      missing.join(", ")
    );
  }

  const model = getSiteModel(request.provider, request.model);
  if (!model) {
    return localError("MODEL_UNAVAILABLE", "The selected model is unavailable");
  }
  if (request.imageOperation === "edit" && !model.supportsEdit) {
    return localError(
      "EDIT_NOT_SUPPORTED",
      "The selected model does not support image editing"
    );
  }
  if (request.modality === "audio") {
    try {
      assertAudioRequest(request);
      const providerInstance = buildSiteProvider(
        request.provider,
        credentials!,
        getConfirmedHosts()
      );
      if (request.provider !== "aliyun-bailian") {
        return localError(
          "INVALID_REQUEST",
          "Audio is only supported by Alibaba Bailian"
        );
      }
      const result = await generateAudio({
        model: (providerInstance as AliyunBailianProvider).audio(request.model),
        text: request.text!,
        voice: request.voice!,
        providerOptions: request.providerOptions,
      });
      return {
        status: "succeeded",
        modality: "audio",
        audio: result.content,
        metadata: {
          provider: result.provider,
          model: result.model,
          requestId: result.requestId,
        },
      };
    } catch (error) {
      if (error instanceof EndpointNotUsableError)
        return endpointNotUsableResponse(error);
      return { status: "failed", error: toSafeError(error) };
    }
  }
  if (request.modality === "video") {
    if (!model.supportsVideo) {
      return localError(
        "VIDEO_NOT_SUPPORTED",
        "The selected model does not support video generation"
      );
    }
    if (
      request.provider !== "aliyun-bailian" &&
      request.provider !== "minimax"
    ) {
      return localError(
        "VIDEO_PROVIDER_UNSUPPORTED",
        "Video generation is only supported for Alibaba Bailian and MiniMax"
      );
    }
    if (model.requiresFirstFrame && !request.referenceImage) {
      return localError(
        "FIRST_FRAME_REQUIRED",
        "This video model requires a first-frame image"
      );
    }
    if (model.requiresInputVideo && !request.inputVideoUrl) {
      return localError(
        "INPUT_VIDEO_REQUIRED",
        "This video model requires a source video URL"
      );
    }
  }

  let instance: ImageModelInstance | VideoModelInstance;
  try {
    const providerInstance = buildSiteProvider(
      request.provider,
      credentials!,
      getConfirmedHosts()
    );
    // `buildSiteProvider` returns the provider matching `request.provider`;
    // the assertions narrow the union per branch.
    if (request.modality === "video") {
      instance =
        request.provider === "minimax"
          ? (providerInstance as MiniMaxProvider).video(request.model)
          : (providerInstance as AliyunBailianProvider).video(request.model);
    } else if (request.provider === "azure-openai") {
      instance = (providerInstance as AzureOpenAIProvider).image(request.model);
    } else if (request.provider === "volcengine") {
      instance = (providerInstance as VolcengineProvider).image(request.model);
    } else {
      instance = (providerInstance as AliyunBailianProvider).image(
        request.model
      );
    }
  } catch (error) {
    if (error instanceof EndpointNotUsableError) {
      return endpointNotUsableResponse(error);
    }
    throw error;
  }

  try {
    if (request.modality === "video") {
      const providerOptions = buildVideoProviderOptions(request);
      // video-edit derives duration from the source video and takes no ratio.
      if (model.requiresInputVideo) {
        const aliyun = providerOptions.aliyun as Record<string, unknown>;
        delete aliyun.duration;
        delete aliyun.ratio;
      }
      const task = await submitVideoTask({
        model: instance as VideoModelInstance,
        prompt: request.prompt,
        ...(request.referenceImage
          ? { firstFrame: toImageContent(request.referenceImage) }
          : {}),
        ...(request.lastFrameImage
          ? { lastFrame: toImageContent(request.lastFrameImage) }
          : {}),
        ...(request.referenceImages?.length
          ? {
              referenceImages: request.referenceImages.map(toImageContent),
            }
          : {}),
        ...(request.referenceVideoUrls?.length
          ? {
              referenceVideos: request.referenceVideoUrls.map((url) => ({
                url,
              })),
            }
          : {}),
        ...(request.referenceAudioUrls?.length
          ? {
              referenceAudios: request.referenceAudioUrls.map((url) => ({
                url,
              })),
            }
          : {}),
        ...(request.inputVideoUrl
          ? { inputVideo: { url: request.inputVideoUrl } }
          : {}),
        providerOptions,
      });
      const result = await task.wait({
        pollIntervalMs: POLL_INTERVAL_MS,
        timeoutMs: VIDEO_TASK_WAIT_TIMEOUT_MS,
      });
      return {
        status: "succeeded",
        modality: "video",
        videos: result.content,
        metadata: {
          provider: result.provider,
          model: result.model,
          requestId: result.requestId,
          ...readVideoUsage(result.raw),
        },
      };
    }

    let result: GenerationResult<ImageContent[]>;
    if (request.imageOperation === "edit") {
      result = await editImage({
        model: instance as ImageModelInstance,
        prompt: request.prompt,
        images: [toImageContent(request.referenceImage!)],
        ...(request.providerOptions
          ? { providerOptions: request.providerOptions }
          : {}),
      });
    } else if (model.supportsAsync) {
      const task = await submitImageTask({
        model: instance as ImageModelInstance,
        prompt: request.prompt,
        n: request.n,
        size: request.size,
        ...(request.providerOptions
          ? { providerOptions: request.providerOptions }
          : {}),
      });
      result = await task.wait({ pollIntervalMs: POLL_INTERVAL_MS });
    } else {
      result = await generateImage({
        model: instance as ImageModelInstance,
        prompt: request.prompt,
        n: request.n,
        size: request.size,
        ...(request.providerOptions
          ? { providerOptions: request.providerOptions }
          : {}),
      });
    }

    return {
      status: "succeeded",
      modality: "image",
      images: result.content,
      metadata: {
        provider: result.provider,
        model: result.model,
        requestId: result.requestId,
        ...readImageUsage(result.raw),
      },
    };
  } catch (error) {
    const safe = toSafeError(error);
    return { status: "failed", error: safe };
  }
}

function readImageUsage(raw: unknown): {
  readonly width?: number;
  readonly height?: number;
  readonly imageCount?: number;
} {
  if (typeof raw !== "object" || raw === null) return {};
  const usage = (raw as { usage?: unknown }).usage;
  if (typeof usage !== "object" || usage === null) return {};
  const candidate = usage as Record<string, unknown>;
  return {
    width: typeof candidate.width === "number" ? candidate.width : undefined,
    height: typeof candidate.height === "number" ? candidate.height : undefined,
    imageCount:
      typeof candidate.image_count === "number"
        ? candidate.image_count
        : undefined,
  };
}

function readVideoUsage(raw: unknown): {
  readonly duration?: number;
  readonly imageCount?: number;
} {
  if (typeof raw !== "object" || raw === null) return {};
  const candidate = raw as Record<string, unknown>;
  return {
    duration:
      typeof candidate.duration === "number"
        ? candidate.duration
        : typeof candidate.output_seconds === "number"
          ? candidate.output_seconds
          : undefined,
    imageCount:
      typeof candidate.video_count === "number"
        ? candidate.video_count
        : undefined,
  };
}

/**
 * Map a structured endpoint failure to a response error. The `context`
 * fields drive localized interpolation in the UI (`errors.ENDPOINT_*`).
 */
function endpointNotUsableResponse(
  error: EndpointNotUsableError
): SitePlaygroundResponse {
  const code =
    error.reason === "MISSING_FIELD"
      ? "ENDPOINT_MISSING_FIELD"
      : error.reason === "INVALID_ENDPOINT"
        ? "ENDPOINT_INVALID"
        : "ENDPOINT_UNCONFIRMED";
  const context: Record<string, string> = {};
  if (error.field) context.field = error.field;
  if (error.host) context.host = error.host;
  if (error.endpointErrorCode) context.reason = error.endpointErrorCode;
  return {
    status: "failed",
    error: { code, message: error.message, context },
  };
}

function toSafeError(
  error: unknown
): NonNullable<SitePlaygroundResponse["error"]> {
  if (error instanceof SdkError) {
    const detail = sanitizeErrorDetail(error.message);
    return {
      code: error.code,
      message: mapSdkErrorMessage(error.code, detail),
      ...(detail ? { detail } : {}),
    };
  }
  return { code: "UNKNOWN", message: "Generation failed; please retry." };
}

function sanitizeErrorDetail(detail: string): string {
  return detail
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(
      /(?:api[-_ ]?key|authorization)\s*[:=]\s*[^,;\s]+/gi,
      "$1: [redacted]"
    )
    .slice(0, 500);
}

/**
 * Map an SDK error code to an actionable English fallback message. The UI
 * localizes from the error code; this text is the stable fallback and test
 * surface. Unknown codes fall back to a generic retry hint without leaking
 * internals.
 */
export function mapSdkErrorMessage(
  code: SdkErrorCode,
  detail?: string
): string {
  switch (code) {
    case "AUTH_ERROR":
      return "Authentication failed; please check your API key.";
    case "INVALID_REQUEST":
      return detail
        ? `The provider rejected the request: ${detail}`
        : "The request is not supported; please check the model and input parameters.";
    case "RATE_LIMITED":
      return "The provider is rate limiting; please try again later.";
    case "TIMEOUT":
      return "The request timed out; please retry.";
    case "NETWORK_ERROR":
      return "Cannot reach the provider; please check the network and endpoint configuration (direct browser access requires CORS support; for Alibaba use the standard DashScope endpoint).";
    case "UNKNOWN_MODEL":
      return detail ?? "The selected model is unavailable.";
    case "PROVIDER_ERROR":
      return detail
        ? `The provider returned an error: ${detail}`
        : "The provider failed to process the request; please retry.";
    case "NOT_IMPLEMENTED":
      return "This capability is not supported by the SDK yet.";
    default:
      return "Generation failed; please retry.";
  }
}

export type { SiteErrorCode };
