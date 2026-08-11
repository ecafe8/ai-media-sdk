import type { AliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import type { AzureOpenAIProvider } from "@ai-media/provider-azure-openai";
import type { SeedreamProvider } from "@ai-media/provider-seedream";
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

function configurationError(message: string): SitePlaygroundResponse {
  return {
    status: "failed",
    error: { code: "CONFIGURATION_ERROR", message },
  };
}

function invalidRequest(message: string): SitePlaygroundResponse {
  return {
    status: "failed",
    error: { code: "INVALID_REQUEST", message },
  };
}

function buildVideoProviderOptions(
  request: SiteGenerationRequest
): Record<string, unknown> {
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
      `${PROVIDER_LABELS[request.provider]} 缺少凭证：${missing.join("、")}。请在 API 设置中填写。`
    );
  }

  const model = getSiteModel(request.provider, request.model);
  if (!model) {
    return invalidRequest("所选模型不可用");
  }
  if (request.imageOperation === "edit" && !model.supportsEdit) {
    return invalidRequest("所选模型不支持图像编辑");
  }
  if (request.modality === "video") {
    if (!model.supportsVideo) {
      return invalidRequest("所选模型不支持视频生成");
    }
    if (request.provider !== "aliyun-bailian") {
      return invalidRequest("视频生成仅支持 Alibaba Bailian");
    }
    if (model.requiresFirstFrame && !request.referenceImage) {
      return invalidRequest("该视频模型需要首帧图片");
    }
    if (model.requiresInputVideo && !request.inputVideoUrl) {
      return invalidRequest("该视频模型需要源视频 URL");
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
      instance = (providerInstance as AliyunBailianProvider).video(
        request.model
      );
    } else if (request.provider === "azure-openai") {
      instance = (providerInstance as AzureOpenAIProvider).image(request.model);
    } else if (request.provider === "doubao-seedream") {
      instance = (providerInstance as SeedreamProvider).image(request.model);
    } else {
      instance = (providerInstance as AliyunBailianProvider).image(
        request.model
      );
    }
  } catch (error) {
    if (error instanceof EndpointNotUsableError) {
      return configurationError(error.message);
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
        ...(request.referenceImages?.length
          ? {
              referenceImages: request.referenceImages.map(toImageContent),
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
      typeof candidate.duration === "number" ? candidate.duration : undefined,
    imageCount:
      typeof candidate.video_count === "number"
        ? candidate.video_count
        : undefined,
  };
}

function toSafeError(
  error: unknown
): NonNullable<SitePlaygroundResponse["error"]> {
  if (error instanceof SdkError) {
    return {
      code: error.code,
      message: mapSdkErrorMessage(error.code, error.message),
    };
  }
  return { code: "UNKNOWN", message: "生成失败，请重试。" };
}

/**
 * Map an SDK error code to an actionable user-facing message. Exported for
 * testing; unknown codes fall back to a generic retry hint without leaking
 * internals.
 */
export function mapSdkErrorMessage(
  code: SdkErrorCode,
  detail?: string
): string {
  switch (code) {
    case "AUTH_ERROR":
      return "认证失败，请检查你的 API Key 是否正确。";
    case "INVALID_REQUEST":
      return detail
        ? `Provider 拒绝了请求：${detail}`
        : "请求不被支持，请检查模型与输入参数。";
    case "RATE_LIMITED":
      return "Provider 限流中，请稍后重试。";
    case "TIMEOUT":
      return "请求超时，请重试。";
    case "NETWORK_ERROR":
      return "无法连接 Provider，请检查网络与端点配置（浏览器直连要求端点支持 CORS；阿里云请使用标准 DashScope 端点）。";
    case "UNKNOWN_MODEL":
      return detail ?? "所选模型不可用。";
    case "PROVIDER_ERROR":
      return detail
        ? `Provider 返回错误：${detail}`
        : "Provider 处理失败，请重试。";
    case "NOT_IMPLEMENTED":
      return "当前 SDK 不支持该能力。";
    default:
      return "生成失败，请重试。";
  }
}

export type { SiteErrorCode };
