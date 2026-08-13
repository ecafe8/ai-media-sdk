import type { AliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import type { AzureOpenAIProvider } from "@ai-media/provider-azure-openai";
import type { MiniMaxProvider } from "@ai-media/provider-minimax";
import type { VolcengineProvider } from "@ai-media/provider-volcengine";
import {
  editImage,
  type GenerationResult,
  generateImage,
  type ImageContent,
  type ImageModelInstance,
  SdkError,
  type SdkErrorCode,
  submitImageTask,
  submitVideoTask,
  type VideoModelInstance,
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
  SiteErrorCode,
  SiteGenerationRequest,
  SitePlaygroundResponse,
} from "./playground/types";
import { buildSiteProvider, EndpointNotUsableError } from "./provider-client";

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
    return {
      code: error.code,
      message: mapSdkErrorMessage(error.code, error.message),
      ...(error.message ? { detail: error.message } : {}),
    };
  }
  return { code: "UNKNOWN", message: "Generation failed; please retry." };
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
