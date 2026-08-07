import {
  editImage,
  generateImage,
  submitImageTask,
  submitVideoTask,
  SdkError,
  createTransport,
  type GenerationResult,
  type ImageContent,
  type ImageModelInstance,
  type VideoModelInstance,
} from "@ai-media/sdk";
import {
  createAliyunBailianProvider,
  type AliyunBailianProvider,
} from "@ai-media/provider-aliyun-bailian";
import {
  createAzureOpenAIProvider,
  type AzureOpenAIProvider,
} from "@ai-media/provider-azure-openai";
import {
  createSeedreamProvider,
  type SeedreamProvider,
} from "@ai-media/provider-seedream";

import { loadConfig } from "@/lib/config";
import { getPlaygroundModel } from "./registry";
import {
  isProviderConfiguredByEnv,
  PlaygroundConfigurationError,
  resolveAliyunCredentials,
  resolveAzureCredentials,
  resolveSeedreamCredentials,
} from "./provider-credentials";
import type {
  PlaygroundModel,
  PlaygroundProvider,
  PlaygroundRequest,
  PlaygroundResponse,
} from "./types";

interface ProviderSelection {
  readonly model: PlaygroundModel;
  readonly instance: ImageModelInstance | VideoModelInstance;
}

export function getConfiguredProviders(): ReadonlySet<PlaygroundProvider> {
  const config = loadConfig();
  const configured = new Set<PlaygroundProvider>();
  for (const provider of [
    "azure-openai",
    "aliyun-bailian",
    "doubao-seedream",
  ] as const) {
    if (isProviderConfiguredByEnv(provider, config)) {
      configured.add(provider);
    }
  }
  return configured;
}

export function createProviderSelection(
  request: PlaygroundRequest
): ProviderSelection {
  const config = loadConfig();

  const model = getPlaygroundModel(request.provider, request.model);
  if (!model) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "The selected model is not available for this Provider",
    });
  }

  if (request.imageOperation === "edit" && !model.supportsEdit) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "The selected model does not support image editing",
    });
  }

  if (request.modality === "video") {
    if (!model.supportsVideo) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "The selected model does not support video generation",
      });
    }
    if (model.requiresFirstFrame && !request.referenceImageUrl) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "This video model requires a first-frame image URL",
      });
    }
    if (request.provider !== "aliyun-bailian") {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message:
          "Video generation is only supported for the Aliyun Bailian provider",
      });
    }
    const provider: AliyunBailianProvider = createAliyunBailianProvider(
      resolveAliyunCredentials(request.credentials, config),
      {
        transport: createTransport({
          defaultTimeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
        }),
      }
    );
    return { model, instance: provider.video(request.model) };
  }

  if (request.provider === "azure-openai") {
    const provider: AzureOpenAIProvider = createAzureOpenAIProvider(
      resolveAzureCredentials(request.credentials, config),
      {
        transport: createTransport({
          defaultTimeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
        }),
      }
    );
    return { model, instance: provider.image(request.model) };
  }

  if (request.provider === "doubao-seedream") {
    const provider: SeedreamProvider = createSeedreamProvider(
      resolveSeedreamCredentials(request.credentials, config),
      {
        transport: createTransport({
          defaultTimeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
        }),
      }
    );
    return { model, instance: provider.image(request.model) };
  }

  const provider: AliyunBailianProvider = createAliyunBailianProvider(
    resolveAliyunCredentials(request.credentials, config),
    {
      transport: createTransport({
        defaultTimeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
      }),
    }
  );
  return { model, instance: provider.image(request.model) };
}

export async function executePlaygroundRequest(
  request: PlaygroundRequest
): Promise<PlaygroundResponse> {
  const startedAt = Date.now();

  try {
    const config = loadConfig();
    logPlaygroundEvent("start", request, {
      timeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
    });
    const selection = createProviderSelection(request);

    if (request.modality === "video") {
      const model = selection.model;
      const videoRequest: Parameters<typeof submitVideoTask>[0] = {
        model: selection.instance as VideoModelInstance,
        prompt: request.prompt,
        ...(request.referenceImageUrl
          ? { firstFrame: { url: request.referenceImageUrl } }
          : {}),
        ...(request.referenceImageUrls?.length
          ? {
              referenceImages: request.referenceImageUrls.map((url) => ({
                url,
              })),
            }
          : {}),
        ...(request.inputVideoUrl
          ? { inputVideo: { url: request.inputVideoUrl } }
          : {}),
        providerOptions: {
          aliyun: {
            ...(request.resolution ? { resolution: request.resolution } : {}),
            ...(request.duration ? { duration: request.duration } : {}),
            ...(request.audioSetting
              ? { audio_setting: request.audioSetting }
              : {}),
            watermark: false,
          },
        },
      };
      // video-edit does not support duration; drop it when the model requires
      // an input video (the provider derives duration from the source).
      if (model.requiresInputVideo && videoRequest.providerOptions?.aliyun) {
        const opts = videoRequest.providerOptions.aliyun as Record<
          string,
          unknown
        >;
        delete opts.duration;
      }
      const task = await submitVideoTask(videoRequest);
      const result = await task.wait({
        pollIntervalMs: 15_000,
        timeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
      });
      const response: PlaygroundResponse = {
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
      logPlaygroundEvent("success", request, {
        durationMs: Date.now() - startedAt,
        requestId: result.requestId,
      });
      return response;
    }

    let result: GenerationResult<ImageContent[]>;
    if (request.imageOperation === "edit") {
      result = await editImage({
        model: selection.instance as ImageModelInstance,
        prompt: request.prompt,
        images: [{ url: request.referenceImageUrl }],
      });
    } else if (selection.model.supportsAsync) {
      const task = await submitImageTask({
        model: selection.instance as ImageModelInstance,
        prompt: request.prompt,
        n: request.n,
        size: request.size,
      });
      result = await task.wait({
        pollIntervalMs: 15_000,
        timeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
      });
    } else {
      result = await generateImage({
        model: selection.instance as ImageModelInstance,
        prompt: request.prompt,
        n: request.n,
        size: request.size,
      });
    }

    const response: PlaygroundResponse = {
      status: "succeeded",
      modality: "image",
      images: result.content,
      metadata: {
        provider: result.provider,
        model: result.model,
        requestId: result.requestId,
        ...readUsage(result.raw),
      },
    };
    logPlaygroundEvent("success", request, {
      durationMs: Date.now() - startedAt,
      requestId: result.requestId,
    });
    return response;
  } catch (error) {
    if (error instanceof PlaygroundConfigurationError) {
      logPlaygroundEvent("failure", request, {
        code: "CONFIGURATION_ERROR",
        durationMs: Date.now() - startedAt,
      });
      return {
        status: "failed",
        error: { code: "CONFIGURATION_ERROR", message: error.message },
      };
    }
    const safeError = toSafeError(error);
    logPlaygroundEvent("failure", request, {
      code: safeError.code,
      durationMs: Date.now() - startedAt,
      retryable: error instanceof SdkError ? error.retryable : false,
    });
    return { status: "failed", error: safeError };
  }
}

function logPlaygroundEvent(
  event: "start" | "success" | "failure",
  request: PlaygroundRequest,
  details: Readonly<Record<string, unknown>>
): void {
  const payload = {
    event: `playground.provider_request.${event}`,
    provider: request.provider,
    model: request.model,
    modality: request.modality,
    ...details,
  };

  if (event === "failure") {
    console.error(JSON.stringify(payload));
    return;
  }
  console.info(JSON.stringify(payload));
}

function readUsage(raw: unknown): {
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
      typeof candidate.duration === "number" ? candidate.duration : undefined,
    imageCount:
      typeof candidate.video_count === "number"
        ? candidate.video_count
        : undefined,
  };
}

function toSafeError(error: unknown): NonNullable<PlaygroundResponse["error"]> {
  if (error instanceof SdkError) {
    return {
      code: error.code,
      message: safeMessage(error.code, error.message),
    };
  }
  return {
    code: "UNKNOWN",
    message: "The image request failed. Please try again.",
  };
}

function safeMessage(code: SdkError["code"], detail?: string): string {
  switch (code) {
    case "AUTH_ERROR":
      return "Provider authentication failed. Check the server environment.";
    case "INVALID_REQUEST":
      return detail
        ? `The Provider rejected the request: ${detail}`
        : "The request is not supported. Check the selected model and inputs.";
    case "RATE_LIMITED":
      return "The Provider is rate limiting requests. Try again later.";
    case "TIMEOUT":
      return "The Provider request timed out. Try again.";
    case "NETWORK_ERROR":
      return "The Provider could not be reached. Check the server network.";
    case "NOT_IMPLEMENTED":
      return "This Provider capability is not available in the current SDK slice.";
    default:
      return "The image request failed. Please try again.";
  }
}
