import {
  type AdapterRequest,
  classifyHttpError,
  createTaskHandle,
  createTransport,
  type GenerationResult,
  type ImageContent,
  type ImageModelInstance,
  isImageEditInput,
  isImageGenerationInput,
  notImplemented,
  type ProviderAdapter,
  type ProviderId,
  SdkError,
  type SupportedModel,
  type TaskHandle,
  type TaskPollResult,
  type TaskStatus,
  type Transport,
  TransportError,
  toImageUrl,
  type VideoContent,
  type VideoModelInstance,
  type Wan3VideoMediaEntry,
} from "@ai-media/sdk";

import type { AliyunBailianConfig } from "../config/index.ts";
import type { AliyunImageProviderOptions } from "./options.ts";
import type {
  AliyunHappyHorseI2VParams,
  AliyunHappyHorseR2VParams,
  AliyunHappyHorseT2VParams,
  AliyunHappyHorseVideoEditParams,
  AliyunQwenImageParams,
  AliyunWan3VideoParams,
  AliyunWan26T2VParams,
  AliyunWan27ImageParams,
  AliyunWan27ProImageParams,
} from "./params.ts";
import {
  ALIYUN_MODEL_REGISTRY,
  type AliyunModelEntry,
  aliyunModelRegistry,
} from "./registry.ts";

/**
 * Alibaba Cloud Bailian (DashScope) Provider factory, model instance, and
 * adapter.
 *
 * The adapter builds Qwen-Image synchronous requests against
 * `multimodal-generation/generation` with `Authorization: Bearer`, mapping the
 * T2I (`content: [{text}]`) and I2I (`content: [{image}..., {text}]`) shapes
 * into `GenerationResult<ImageContent[]>`. Wan-family models stay
 * `NOT_IMPLEMENTED` pending the Phase 3 async `image-generation` contract.
 */

const ALIYUN_PROVIDER_ID: ProviderId = "aliyun-bailian";
const GENERATION_PATH = "/services/aigc/multimodal-generation/generation";
const IMAGE_GENERATION_PATH = "/services/aigc/image-generation/generation";
const VIDEO_SYNTHESIS_PATH = "/services/aigc/video-generation/video-synthesis";
const TASK_PATH_PREFIX = "/tasks/";

/**
 * Options for constructing an Aliyun Bailian Provider.
 */
export interface AliyunBailianProviderOptions {
  /** Injected shared transport; a default transport is created when omitted. */
  readonly transport?: Transport;
}

/**
 * Aliyun Bailian Provider adapter, specialized to `ImageContent[]` for the
 * image modality. The same object also implements `submit()` for the async
 * video modality (`VideoContent[]`); `video(modelId)` returns a
 * `VideoModelInstance` whose adapter is this provider bound to the video
 * content type.
 */
export interface AliyunBailianProvider extends ProviderAdapter<ImageContent[]> {
  readonly providerId: ProviderId;
  readonly config: Readonly<AliyunBailianConfig>;
  readonly transport: Transport;
  /**
   * Create an image model instance bound to an Aliyun model id.
   *
   * Literal overloads return family-typed `ImageModelInstance<...Params>`
   * (Qwen-multimodal or Wan-image family) so `generateImage`/`submitImageTask`
   * narrow `size`/`n` and `providerOptions.aliyun` at compile time. The string
   * fallback keeps the default `ImageGenerationInput` shape for dynamic ids.
   */
  image: {
    (
      modelId:
        | "qwen-image-3.0-pro"
        | "qwen-image-3.0"
        | "qwen-image-2.0-pro"
        | "qwen-image-2.0-pro-2026-06-22"
        | "qwen-image-2.0"
    ): ImageModelInstance<AliyunQwenImageParams>;
    (
      modelId: "wan2.7-image-pro"
    ): ImageModelInstance<AliyunWan27ProImageParams>;
    (modelId: "wan2.7-image"): ImageModelInstance<AliyunWan27ImageParams>;
    (modelId: "wan2.6-t2i"): ImageModelInstance<AliyunWan26T2VParams>;
    (modelId: string): ImageModelInstance;
  };
  /**
   * Create a video model instance bound to a supported Aliyun video model id.
   *
   * Literal overloads return family-typed `VideoModelInstance<...Params>` per
   * HappyHorse mode (t2v/i2v/r2v/video-edit) and Wan 3.0 so `submitVideoTask`
   * narrows `firstFrame`/`referenceImages`/`inputVideo`/`media` and
   * `providerOptions.aliyun.resolution`/`ratio`/`duration`/`audio`
   * at compile time. The string fallback keeps the default
   * `VideoGenerationInput` shape for dynamic ids.
   */
  video: {
    (
      modelId: "happyhorse-1.1-t2v"
    ): VideoModelInstance<AliyunHappyHorseT2VParams>;
    (
      modelId: "happyhorse-1.1-i2v"
    ): VideoModelInstance<AliyunHappyHorseI2VParams>;
    (
      modelId: "happyhorse-1.1-r2v"
    ): VideoModelInstance<AliyunHappyHorseR2VParams>;
    (
      modelId: "happyhorse-1.0-video-edit"
    ): VideoModelInstance<AliyunHappyHorseVideoEditParams>;
    (modelId: "wan3.0-video"): VideoModelInstance<AliyunWan3VideoParams>;
    (modelId: string): VideoModelInstance;
  };
  /** Enumerate the supported models projected from the Aliyun registry. */
  listModels: () => readonly SupportedModel[];
}

interface QwenContentItem {
  readonly text?: string;
  readonly image?: string;
}

interface QwenChoice {
  readonly finish_reason?: string;
  readonly message?: {
    readonly role?: string;
    readonly content?: QwenContentItem[];
  };
}

interface QwenImageResponse {
  readonly output?: { readonly choices?: QwenChoice[] };
  readonly usage?: {
    readonly width?: number;
    readonly height?: number;
    readonly image_count?: number;
  };
  readonly request_id?: string;
  readonly code?: string;
  readonly message?: string;
}

/**
 * Minimal input shape shared by T2I and I2I for parameter building.
 */
interface QwenInputParams {
  readonly n?: number;
  readonly size?: string;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

interface WanImageInput extends QwenInputParams {
  readonly prompt: string;
}

/**
 * Create an Aliyun Bailian Provider from typed configuration.
 *
 * The factory depends only on `@ai-media/sdk`; no DashScope SDK or other
 * external Provider runtime dependency is introduced. When no transport is
 * supplied a default shared transport is created so the adapter never calls
 * global `fetch` directly.
 */
export function createAliyunBailianProvider(
  config: AliyunBailianConfig,
  options?: AliyunBailianProviderOptions
): AliyunBailianProvider {
  const transport = options?.transport ?? createTransport();

  const provider: AliyunBailianProvider = {
    providerId: ALIYUN_PROVIDER_ID,
    config,
    transport,

    image: (modelId: string): ImageModelInstance => {
      const entry = ALIYUN_MODEL_REGISTRY[modelId];
      if (!entry) {
        throw new SdkError({
          code: "UNKNOWN_MODEL",
          message: `Unknown Aliyun model id "${modelId}"`,
        });
      }
      if (entry.capabilities.modality !== "image") {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: `Aliyun model "${modelId}" is not an image model`,
        });
      }
      return {
        providerId: ALIYUN_PROVIDER_ID,
        modelId,
        adapter: provider,
        capabilities: entry.capabilities,
      };
    },

    video: (modelId: string): VideoModelInstance => {
      const entry = ALIYUN_MODEL_REGISTRY[modelId];
      if (!entry) {
        throw new SdkError({
          code: "UNKNOWN_MODEL",
          message: `Unknown Aliyun model id "${modelId}"`,
        });
      }
      if (
        entry.family !== "happyhorse-video" &&
        entry.family !== "wan3-video"
      ) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: `Model "${modelId}" is not a video model`,
        });
      }
      // The provider object serves both image (generate/edit → ImageContent[])
      // and video (submit → VideoContent[]) modalities. For video models only
      // `submit` is called; the cast is safe because generate/edit are never
      // invoked for video models.
      return {
        providerId: ALIYUN_PROVIDER_ID,
        modelId,
        adapter: provider as unknown as ProviderAdapter<VideoContent[]>,
        capabilities: entry.capabilities,
      };
    },

    listModels: (): readonly SupportedModel[] => aliyunModelRegistry.models,

    async generate(
      request: AdapterRequest
    ): Promise<GenerationResult<ImageContent[]>> {
      const entry = requireRegistryEntry(request.model);
      if (entry.family !== "qwen-multimodal") {
        throw notImplemented(`aliyun-bailian.generateImage (${request.model})`);
      }
      if (!isImageGenerationInput(request.input)) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: "Aliyun adapter received a malformed image generation input",
        });
      }

      const input = request.input;
      const content: QwenContentItem[] = [{ text: input.prompt }];
      return sendQwenRequest(
        transport,
        config,
        request.model,
        content,
        input,
        entry
      );
    },

    async edit(
      request: AdapterRequest
    ): Promise<GenerationResult<ImageContent[]>> {
      const entry = requireRegistryEntry(request.model);
      if (entry.family !== "qwen-multimodal") {
        throw notImplemented(`aliyun-bailian.editImage (${request.model})`);
      }
      if (!isImageEditInput(request.input)) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: "Aliyun adapter received a malformed image edit input",
        });
      }

      const input = request.input;
      const content: QwenContentItem[] = input.images.map((image) => ({
        image: mapImageContent(image),
      }));
      content.push({ text: input.prompt });
      return sendQwenRequest(
        transport,
        config,
        request.model,
        content,
        input,
        entry
      );
    },

    async submit(request: AdapterRequest): Promise<TaskHandle<VideoContent[]>> {
      const entry = requireRegistryEntry(request.model);
      if (entry.family === "wan-image") {
        if (!isImageGenerationInput(request.input)) {
          throw new SdkError({
            code: "INVALID_REQUEST",
            message:
              "Aliyun adapter received a malformed image generation input",
          });
        }
        return submitWanImageTask(
          transport,
          config,
          request.model,
          request.input,
          entry
        ) as unknown as TaskHandle<VideoContent[]>;
      }
      if (
        entry.family !== "happyhorse-video" &&
        entry.family !== "wan3-video"
      ) {
        throw notImplemented(`aliyun-bailian.submit (${request.model})`);
      }
      if (!isVideoGenerationInput(request.input)) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: "Aliyun adapter received a malformed video generation input",
        });
      }
      return submitVideoTask(
        transport,
        config,
        request.model,
        request.input,
        entry
      );
    },
  };

  return provider;
}

function requireRegistryEntry(modelId: string): AliyunModelEntry {
  const entry = ALIYUN_MODEL_REGISTRY[modelId];
  if (!entry) {
    throw new SdkError({
      code: "UNKNOWN_MODEL",
      message: `Unknown Aliyun model id "${modelId}"`,
    });
  }
  return entry;
}

function buildUrl(config: AliyunBailianConfig): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  return `${base}${GENERATION_PATH}`;
}

function buildWanImageUrl(config: AliyunBailianConfig): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  return `${base}${IMAGE_GENERATION_PATH}`;
}

function buildParameters(
  input: QwenInputParams,
  entry: AliyunModelEntry
): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  if (entry.paramSupport.size && input.size !== undefined) {
    // DashScope Qwen image models use `*` between dimensions. Accept the
    // playground's provider-neutral `x` form as well.
    parameters.size = input.size.replace(/x/gi, "*");
  }
  if (entry.paramSupport.n && input.n !== undefined) {
    parameters.n = input.n;
  }

  const aliyun = readAliyunOptions(input.providerOptions);
  if (aliyun.negative_prompt !== undefined) {
    parameters.negative_prompt = aliyun.negative_prompt;
  }
  if (aliyun.prompt_extend !== undefined) {
    parameters.prompt_extend = aliyun.prompt_extend;
  }
  if (aliyun.prompt_extend_mode !== undefined) {
    parameters.prompt_extend_mode = aliyun.prompt_extend_mode;
  }
  if (aliyun.watermark !== undefined) {
    parameters.watermark = aliyun.watermark;
  }
  if (aliyun.seed !== undefined) {
    parameters.seed = aliyun.seed;
  }
  return parameters;
}

function buildWanImageParameters(
  input: WanImageInput,
  entry: AliyunModelEntry
): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  if (entry.paramSupport.size && input.size !== undefined) {
    parameters.size = input.size.replace(/x/gi, "*");
  }
  if (entry.paramSupport.n && input.n !== undefined) {
    parameters.n = input.n;
  }

  const aliyun = readAliyunOptions(input.providerOptions);
  // Qwen-style fields forwarded only when the model declares support
  // (wan2.6-t2i supports them; wan2.7-image does not).
  if (
    entry.paramSupport.negative_prompt &&
    aliyun.negative_prompt !== undefined
  ) {
    parameters.negative_prompt = aliyun.negative_prompt;
  }
  if (entry.paramSupport.prompt_extend && aliyun.prompt_extend !== undefined) {
    parameters.prompt_extend = aliyun.prompt_extend;
  }
  // Wan 2.7-specific fields (not forwarded for wan2.6-t2i).
  if (aliyun.watermark !== undefined) parameters.watermark = aliyun.watermark;
  if (aliyun.seed !== undefined) parameters.seed = aliyun.seed;
  if (aliyun.thinking_mode !== undefined) {
    parameters.thinking_mode = aliyun.thinking_mode;
  }
  if (aliyun.color_palette !== undefined) {
    parameters.color_palette = aliyun.color_palette;
  }
  if (aliyun.enable_sequential !== undefined) {
    parameters.enable_sequential = aliyun.enable_sequential;
  }
  if (aliyun.bbox_list !== undefined) {
    parameters.bbox_list = aliyun.bbox_list;
  }
  return parameters;
}

function readAliyunOptions(
  providerOptions?: Readonly<Record<string, unknown>>
): AliyunImageProviderOptions {
  const raw = providerOptions?.aliyun;
  if (typeof raw !== "object" || raw === null) return {};
  const candidate = raw as Record<string, unknown>;
  const options: {
    negative_prompt?: string;
    prompt_extend?: boolean;
    prompt_extend_mode?: "direct" | "agent";
    watermark?: boolean;
    seed?: number;
    thinking_mode?: boolean;
    color_palette?: ReadonlyArray<{ hex: string; ratio: string }>;
    enable_sequential?: boolean;
    bbox_list?: ReadonlyArray<
      ReadonlyArray<readonly [number, number, number, number]>
    >;
  } = {};
  if (typeof candidate.negative_prompt === "string") {
    options.negative_prompt = candidate.negative_prompt;
  }
  if (typeof candidate.prompt_extend === "boolean") {
    options.prompt_extend = candidate.prompt_extend;
  }
  if (
    candidate.prompt_extend_mode === "direct" ||
    candidate.prompt_extend_mode === "agent"
  ) {
    options.prompt_extend_mode = candidate.prompt_extend_mode;
  }
  if (typeof candidate.watermark === "boolean") {
    options.watermark = candidate.watermark;
  }
  if (typeof candidate.seed === "number") {
    options.seed = candidate.seed;
  }
  if (typeof candidate.thinking_mode === "boolean") {
    options.thinking_mode = candidate.thinking_mode;
  }
  if (Array.isArray(candidate.color_palette)) {
    options.color_palette = candidate.color_palette as ReadonlyArray<{
      hex: string;
      ratio: string;
    }>;
  }
  if (typeof candidate.enable_sequential === "boolean") {
    options.enable_sequential = candidate.enable_sequential;
  }
  if (Array.isArray(candidate.bbox_list)) {
    options.bbox_list = candidate.bbox_list as ReadonlyArray<
      ReadonlyArray<readonly [number, number, number, number]>
    >;
  }
  return options;
}

function mapImageContent(image: ImageContent): string {
  const imageUrl = toImageUrl(image);
  if (imageUrl) return imageUrl;
  throw new SdkError({
    code: "INVALID_REQUEST",
    message: "Edit input image must carry a url or base64",
  });
}

/**
 * Recursively detect whether any string value in the mapped request body uses
 * the `oss://` scheme. When true, the caller MUST send
 * `X-DashScope-OssResourceResolve: enable` so DashScope can resolve the
 * temporary OSS URL. The scan is a cheap prefix check over string leaves and
 * covers Qwen image content, video first-frame/reference/input-video URLs, and
 * any future path that embeds URLs in the body.
 */
function hasOssUrl(value: unknown): boolean {
  if (typeof value === "string") return value.startsWith("oss://");
  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasOssUrl(item)) return true;
    }
    return false;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      if (hasOssUrl(item)) return true;
    }
  }
  return false;
}

/**
 * Conditionally inject the `X-DashScope-OssResourceResolve: enable` header
 * when the request body references at least one `oss://` temporary URL. The
 * header is a no-op for requests that carry only `http:`/`https:`/`data:`
 * URLs, so non-temporary-URL requests stay byte-identical.
 */
function withOssResolveHeader(
  headers: Record<string, string>,
  body: unknown
): Record<string, string> {
  if (hasOssUrl(body)) {
    return { ...headers, "X-DashScope-OssResourceResolve": "enable" };
  }
  return headers;
}

async function sendQwenRequest(
  transport: Transport,
  config: AliyunBailianConfig,
  modelId: string,
  content: QwenContentItem[],
  input: QwenInputParams,
  entry: AliyunModelEntry
): Promise<GenerationResult<ImageContent[]>> {
  const url = buildUrl(config);
  const body = {
    model: modelId,
    input: { messages: [{ role: "user", content }] },
    parameters: buildParameters(input, entry),
  };
  const headers: Record<string, string> = withOssResolveHeader(
    {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body
  );

  let response;
  try {
    response = await transport.send<QwenImageResponse>({
      url,
      method: "POST",
      headers,
      body,
    });
  } catch (error) {
    throw mapTransportError(error);
  }

  if (response.status < 200 || response.status >= 300) {
    throw classifyHttpError(
      response.status,
      extractErrorMessage(response.data, config.apiKey)
    );
  }

  return mapQwenResponse(response.data, ALIYUN_PROVIDER_ID, modelId);
}

function mapTransportError(error: unknown): SdkError {
  if (error instanceof TransportError) {
    if (error.kind === "timeout") {
      return new SdkError({
        code: "TIMEOUT",
        message: error.message,
        cause: error,
      });
    }
    return new SdkError({
      code: "NETWORK_ERROR",
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof SdkError) return error;
  return new SdkError({
    code: "UNKNOWN",
    message: error instanceof Error ? error.message : "Unknown transport error",
    cause: error,
  });
}

function extractErrorMessage(
  data: QwenImageResponse | undefined,
  apiKey: string
): string | undefined {
  const message = [data?.code, data?.message]
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0
    )
    .join(": ");
  if (message.length > 0) {
    return message.replaceAll(apiKey, "[redacted]");
  }
  return undefined;
}

function mapQwenResponse(
  data: QwenImageResponse | undefined,
  providerId: ProviderId,
  model: string
): GenerationResult<ImageContent[]> {
  const choices = data?.output?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Aliyun returned no image choices in the response",
    });
  }

  const content: ImageContent[] = [];
  for (const choice of choices) {
    const items = choice.message?.content;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (typeof item.image === "string") {
        content.push({ url: item.image });
      }
    }
  }

  if (content.length === 0) {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Aliyun response contained no image URLs",
    });
  }

  return {
    content,
    provider: providerId,
    model,
    requestId: data?.request_id,
    raw: data?.usage,
  };
}

/**
 * Video generation input shape (provider-agnostic `VideoGenerationInput`).
 */
interface AliyunVideoInput {
  readonly prompt?: string;
  readonly firstFrame?: ImageContent;
  readonly referenceImages?: readonly ImageContent[];
  readonly inputVideo?: { readonly url: string };
  readonly media?: readonly Wan3VideoMediaEntry[];
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * Aliyun-native video options forwarded under `providerOptions.aliyun`.
 * HappyHorse uses `audio_setting`; Wan 3.0 uses `audio` (boolean).
 */
interface AliyunVideoOptions {
  readonly resolution?: string;
  readonly ratio?: string;
  readonly duration?: number;
  readonly watermark?: boolean;
  readonly seed?: number;
  readonly audio_setting?: string;
  readonly audio?: boolean;
}

/**
 * DashScope async task poll response shape (shared by image and video async).
 */
interface AliyunTaskResponse {
  readonly output?: {
    readonly task_id?: string;
    readonly task_status?: string;
    readonly video_url?: string;
    readonly choices?: QwenChoice[];
    readonly code?: string;
    readonly message?: string;
  };
  readonly usage?: Readonly<Record<string, unknown>>;
  readonly request_id?: string;
  readonly code?: string;
  readonly message?: string;
}

/**
 * DashScope async task submit response shape.
 */
interface AliyunTaskSubmitResponse {
  readonly output?: {
    readonly task_id?: string;
    readonly task_status?: string;
  };
  readonly request_id?: string;
  readonly code?: string;
  readonly message?: string;
}

/**
 * Type guard narrowing an `unknown` adapter input to the video input shape.
 *
 * Demonstrates structural shape only; per-model media/prompt validation is
 * performed by `validateVideoInput` / `validateWan3VideoInput` before any
 * transport call. Prompt is optional because Wan 3.0 accepts media-only
 * requests.
 */
function isVideoGenerationInput(value: unknown): value is AliyunVideoInput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.prompt === undefined || typeof candidate.prompt === "string";
}

function readAliyunVideoOptions(
  providerOptions?: Readonly<Record<string, unknown>>
): AliyunVideoOptions {
  const raw = providerOptions?.aliyun;
  if (typeof raw !== "object" || raw === null) return {};
  const candidate = raw as Record<string, unknown>;
  const options: {
    resolution?: string;
    ratio?: string;
    duration?: number;
    watermark?: boolean;
    seed?: number;
    audio_setting?: string;
    audio?: boolean;
  } = {};
  if (typeof candidate.resolution === "string") {
    options.resolution = candidate.resolution;
  }
  if (typeof candidate.ratio === "string") options.ratio = candidate.ratio;
  if (typeof candidate.duration === "number") {
    options.duration = candidate.duration;
  }
  if (typeof candidate.watermark === "boolean") {
    options.watermark = candidate.watermark;
  }
  if (typeof candidate.seed === "number") options.seed = candidate.seed;
  if (typeof candidate.audio_setting === "string") {
    options.audio_setting = candidate.audio_setting;
  }
  if (typeof candidate.audio === "boolean") {
    options.audio = candidate.audio;
  }
  return options;
}

function buildVideoUrl(config: AliyunBailianConfig): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  return `${base}${VIDEO_SYNTHESIS_PATH}`;
}

function buildTaskUrl(config: AliyunBailianConfig, taskId: string): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  return `${base}${TASK_PATH_PREFIX}${encodeURIComponent(taskId)}`;
}

/**
 * Resolve the allowed resolution values for a model from the registry entry.
 * Falls back to the full HappyHorse list when the entry does not declare
 * `supportedResolutions` (defensive; registry entries should always declare).
 */
function allowedResolutionsFor(entry: AliyunModelEntry): readonly string[] {
  return entry.supportedResolutions ?? ["480P", "720P", "1080P"];
}

/**
 * Fallback aspect-ratio list used when a registry entry does not declare
 * `supportedAspectRatios`. Real entries always declare it (i2v/video-edit
 * declare `[]` to mark "no ratio param").
 */
const HAPPYHORSE_RATIOS_FALLBACK: readonly string[] = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
  "9:21",
  "21:9",
];

/**
 * Validate model-specific media combination, prompt requirement, reference
 * counts, and input-video URL protocol before any transport call. The adapter
 * is the sole authority for these rules.
 */
function validateVideoInput(
  input: AliyunVideoInput,
  entry: AliyunModelEntry
): void {
  const isVideoEdit = entry.requiresInputVideo === true;
  const isR2v = entry.maxReferenceImages !== undefined && !isVideoEdit;
  const isI2v = entry.requiresFirstFrame === true;
  const isT2v = !isI2v && !isR2v && !isVideoEdit;

  if (isT2v) {
    if (input.firstFrame || input.referenceImages || input.inputVideo) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "This video model does not accept media inputs",
      });
    }
  }

  if (isI2v) {
    if (!input.firstFrame) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "First-frame image input is required for this video model",
      });
    }
    if (input.referenceImages || input.inputVideo) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message:
          "This video model does not accept reference images or input video",
      });
    }
  }

  if (isR2v) {
    if (!input.referenceImages || input.referenceImages.length === 0) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "Reference images are required for this video model",
      });
    }
    const max = entry.maxReferenceImages ?? 9;
    if (input.referenceImages.length > max) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `This video model accepts at most ${max} reference images`,
      });
    }
    if (input.firstFrame || input.inputVideo) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message:
          "This video model does not accept a first frame or input video",
      });
    }
  }

  if (isVideoEdit) {
    if (!input.inputVideo) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "An input video URL is required for this video model",
      });
    }
    const url = input.inputVideo.url;
    if (!url || (!url.startsWith("http:") && !url.startsWith("https:"))) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "The input video URL must be a public http or https URL",
      });
    }
    const max = entry.maxReferenceImages ?? 5;
    if (input.referenceImages && input.referenceImages.length > max) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `This video model accepts at most ${max} reference images`,
      });
    }
    if (input.firstFrame) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "This video model does not accept a first-frame image",
      });
    }
  }

  if (!isI2v && (!input.prompt || input.prompt.length === 0)) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "prompt must not be empty for this video model",
    });
  }
}

function buildVideoBody(
  input: AliyunVideoInput,
  modelId: string,
  entry: AliyunModelEntry
): Record<string, unknown> {
  validateVideoInput(input, entry);

  const isVideoEdit = entry.requiresInputVideo === true;
  const isR2v = entry.maxReferenceImages !== undefined && !isVideoEdit;
  const isI2v = entry.requiresFirstFrame === true;

  const body: Record<string, unknown> = { model: modelId };
  const inputObj: Record<string, unknown> = {};

  if (isI2v && input.firstFrame) {
    inputObj.prompt = input.prompt;
    inputObj.media = [
      { type: "first_frame", url: mapImageContent(input.firstFrame) },
    ];
  } else if (isR2v && input.referenceImages) {
    inputObj.prompt = input.prompt;
    inputObj.media = input.referenceImages.map((image) => ({
      type: "reference_image",
      url: mapImageContent(image),
    }));
  } else if (isVideoEdit) {
    inputObj.prompt = input.prompt;
    const media: Array<{ type: string; url: string }> = [
      { type: "video", url: input.inputVideo!.url },
    ];
    for (const image of input.referenceImages ?? []) {
      media.push({ type: "reference_image", url: mapImageContent(image) });
    }
    inputObj.media = media;
  } else {
    inputObj.prompt = input.prompt;
  }
  body.input = inputObj;

  const aliyun = readAliyunVideoOptions(input.providerOptions);
  const parameters: Record<string, unknown> = {};
  if (aliyun.resolution !== undefined) {
    const allowed = allowedResolutionsFor(entry);
    if (!allowed.includes(aliyun.resolution)) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `resolution must be one of ${allowed.join(", ")}`,
      });
    }
    parameters.resolution = aliyun.resolution;
  }
  if (aliyun.ratio !== undefined && !isI2v && !isVideoEdit) {
    const allowedRatios =
      entry.supportedAspectRatios ?? HAPPYHORSE_RATIOS_FALLBACK;
    if (allowedRatios.length > 0 && !allowedRatios.includes(aliyun.ratio)) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `ratio must be one of ${allowedRatios.join(", ")}`,
      });
    }
    parameters.ratio = aliyun.ratio;
  }
  if (aliyun.duration !== undefined && !isVideoEdit) {
    parameters.duration = aliyun.duration;
  }
  if (aliyun.watermark !== undefined) parameters.watermark = aliyun.watermark;
  if (aliyun.seed !== undefined) parameters.seed = aliyun.seed;
  if (aliyun.audio_setting !== undefined && isVideoEdit) {
    if (aliyun.audio_setting !== "auto" && aliyun.audio_setting !== "origin") {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: 'audio_setting must be "auto" or "origin"',
      });
    }
    parameters.audio_setting = aliyun.audio_setting;
  }
  if (Object.keys(parameters).length > 0) body.parameters = parameters;
  return body;
}

/**
 * Map a DashScope `task_status` string to the core `TaskStatus`.
 */
function mapTaskStatus(status: string | undefined): TaskStatus {
  switch (status) {
    case "PENDING":
      return "pending";
    case "RUNNING":
    case "PROCESSING":
      return "running";
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    case "CANCELED":
      return "cancelled";
    default:
      // UNKNOWN and anything unexpected map to a terminal failure.
      return "failed";
  }
}

/**
 * Shared async-task poll: `GET /tasks/{task_id}` with `Authorization: Bearer`.
 * Returns the raw task envelope for modality-specific content extraction.
 */
async function getTask(
  transport: Transport,
  config: AliyunBailianConfig,
  taskId: string
): Promise<AliyunTaskResponse> {
  const url = buildTaskUrl(config, taskId);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };
  let response;
  try {
    response = await transport.send<AliyunTaskResponse>({
      url,
      method: "GET",
      headers,
    });
  } catch (error) {
    throw mapTransportError(error);
  }
  if (response.status < 200 || response.status >= 300) {
    throw classifyHttpError(
      response.status,
      extractTaskErrorMessage(response.data, config.apiKey)
    );
  }
  return response.data;
}

/**
 * Submit a video generation task (HappyHorse or Wan 3.0) and return a
 * `TaskHandle` whose poll closure calls the shared `getTask` and extracts
 * `output.video_url`. Routes to `buildWan3VideoBody` for Wan 3.0 family
 * and `buildVideoBody` for HappyHorse.
 */
async function submitVideoTask(
  transport: Transport,
  config: AliyunBailianConfig,
  modelId: string,
  input: AliyunVideoInput,
  entry: AliyunModelEntry
): Promise<TaskHandle<VideoContent[]>> {
  if (entry.family === "wan3-video") {
    return submitWan3VideoTask(transport, config, modelId, input, entry);
  }
  const url = buildVideoUrl(config);
  const body = buildVideoBody(input, modelId, entry);
  const headers: Record<string, string> = withOssResolveHeader(
    {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body
  );

  let response;
  try {
    response = await transport.send<AliyunTaskSubmitResponse>({
      url,
      method: "POST",
      headers,
      body,
    });
  } catch (error) {
    throw mapTransportError(error);
  }
  if (response.status < 200 || response.status >= 300) {
    throw classifyHttpError(
      response.status,
      extractTaskSubmitErrorMessage(response.data, config.apiKey)
    );
  }

  const taskId = response.data?.output?.task_id;
  if (!taskId) {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Aliyun video task submission returned no task id",
    });
  }

  const poll = async (): Promise<TaskPollResult<VideoContent[]>> => {
    const task = await getTask(transport, config, taskId);
    const status = mapTaskStatus(task.output?.task_status);
    if (status === "succeeded") {
      const videoUrl = task.output?.video_url;
      if (!videoUrl) {
        return {
          status: "failed",
          error: new SdkError({
            code: "PROVIDER_ERROR",
            message: "Aliyun video task succeeded but returned no video url",
          }),
        };
      }
      const usage = task.usage as
        | { duration?: number; SR?: number; ratio?: string }
        | undefined;
      const video: VideoContent = {
        url: videoUrl,
        ...(typeof usage?.duration === "number"
          ? { duration: usage.duration }
          : {}),
      };
      const content: VideoContent[] = [video];
      const result: GenerationResult<VideoContent[]> = {
        content,
        provider: ALIYUN_PROVIDER_ID,
        model: modelId,
        requestId: task.request_id,
        raw: task.usage,
      };
      return { status, result };
    }
    if (status === "failed" || status === "cancelled") {
      return {
        status,
        error: new SdkError({
          code: "PROVIDER_ERROR",
          message: extractTaskFailureMessage(task, config.apiKey),
        }),
      };
    }
    return { status };
  };

  return createTaskHandle<VideoContent[]>({ taskId, poll });
}

/**
 * Validate Wan 3.0 media combinations, counts, URL/data forms, and parameter
 * ranges before any transport call. Enforces:
 * - At least one of prompt or media is present.
 * - `first_frame`/`last_frame` are mutually exclusive with `reference_*`,
 *   `file`, and `link`.
 * - `file` and `link` are mutually exclusive.
 * - At most 1 first_frame, 1 last_frame, 1 file, 1 link.
 * - At most 10 reference_image, 5 reference_video, 5 reference_audio.
 * - Base64 content is accepted only for image media.
 * - Reference video/audio total duration ≤ 15s when caller metadata exists.
 * - Duration [2, 30] or -1; input video duration + output ≤ 30 when metadata
 *   exists.
 * - Resolution/ratio/seed within supported ranges.
 */
function validateWan3VideoInput(
  input: AliyunVideoInput,
  _entry: AliyunModelEntry
): void {
  const media = input.media ?? [];
  const prompt = input.prompt ?? "";

  if (prompt.length === 0 && media.length === 0) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "Wan 3.0 requires at least a prompt or media input",
    });
  }

  let firstFrameCount = 0;
  let lastFrameCount = 0;
  let refImageCount = 0;
  let refVideoCount = 0;
  let refAudioCount = 0;
  let fileCount = 0;
  let linkCount = 0;
  let refVideoTotalDuration = 0;
  let refAudioTotalDuration = 0;
  let hasRefVideoMetadata = true;
  let hasRefAudioMetadata = true;

  for (const entry2 of media) {
    const type = entry2.type;
    if (type === "first_frame") {
      firstFrameCount++;
    } else if (type === "last_frame") {
      lastFrameCount++;
    } else if (type === "reference_image") {
      refImageCount++;
    } else if (type === "reference_video") {
      refVideoCount++;
      const dur = entry2.duration;
      if (typeof dur === "number") {
        refVideoTotalDuration += dur;
      } else {
        hasRefVideoMetadata = false;
      }
    } else if (type === "reference_audio") {
      refAudioCount++;
      const dur = entry2.duration;
      if (typeof dur === "number") {
        refAudioTotalDuration += dur;
      } else {
        hasRefAudioMetadata = false;
      }
    } else if (type === "file") {
      fileCount++;
    } else if (type === "link") {
      linkCount++;
    }

    // Base64 is only accepted for image media.
    const isImageType =
      type === "first_frame" ||
      type === "last_frame" ||
      type === "reference_image";
    const hasBase64 = "base64" in entry2 && entry2.base64 !== undefined;
    if (hasBase64 && !isImageType) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `Base64 content is not accepted for media type "${type}"`,
      });
    }

    // URL or base64 must be present for image; URL must be present for others.
    if (isImageType) {
      const hasUrl = "url" in entry2 && entry2.url !== undefined;
      if (!hasUrl && !hasBase64) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: `Media type "${type}" requires a url or base64`,
        });
      }
    } else {
      const hasUrl = "url" in entry2 && entry2.url !== undefined;
      if (!hasUrl) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: `Media type "${type}" requires a url`,
        });
      }
    }
  }

  // Mutual exclusivity: frames vs reference/file/link.
  const hasFrames = firstFrameCount > 0 || lastFrameCount > 0;
  const hasNonFrame =
    refImageCount + refVideoCount + refAudioCount + fileCount + linkCount > 0;
  if (hasFrames && hasNonFrame) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message:
        "first_frame/last_frame and reference_*/file/link are mutually exclusive",
    });
  }

  // file and link are mutually exclusive.
  if (fileCount > 0 && linkCount > 0) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "file and link are mutually exclusive",
    });
  }

  // Count limits.
  if (firstFrameCount > 1) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "Wan 3.0 accepts at most 1 first_frame",
    });
  }
  if (lastFrameCount > 1) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "Wan 3.0 accepts at most 1 last_frame",
    });
  }
  if (refImageCount > 10) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "Wan 3.0 accepts at most 10 reference_image entries",
    });
  }
  if (refVideoCount > 5) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "Wan 3.0 accepts at most 5 reference_video entries",
    });
  }
  if (refAudioCount > 5) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "Wan 3.0 accepts at most 5 reference_audio entries",
    });
  }
  if (fileCount > 1) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "Wan 3.0 accepts at most 1 file entry",
    });
  }
  if (linkCount > 1) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "Wan 3.0 accepts at most 1 link entry",
    });
  }

  // Total duration constraints when metadata is available.
  if (hasRefVideoMetadata && refVideoTotalDuration > 15) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message:
        "Wan 3.0 reference_video total duration must not exceed 15 seconds",
    });
  }
  if (hasRefAudioMetadata && refAudioTotalDuration > 15) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message:
        "Wan 3.0 reference_audio total duration must not exceed 15 seconds",
    });
  }
}

/**
 * Map a Wan 3.0 media entry to a DashScope `input.media[]` entry object.
 * Image media with base64 is mapped to a `data:{mime};base64,{data}` URI.
 */
function mapWan3MediaEntry(entry: Wan3VideoMediaEntry): {
  type: string;
  url: string;
} {
  if ("base64" in entry && entry.base64 !== undefined) {
    const mime =
      "mimeType" in entry ? (entry.mimeType ?? "image/png") : "image/png";
    return {
      type: entry.type,
      url: `data:${mime};base64,${entry.base64}`,
    };
  }
  // Validation guarantees url is present when base64 is absent.
  return { type: entry.type, url: entry.url ?? "" };
}

/**
 * Build the Wan 3.0 request body, including validation, media serialization,
 * and parameter forwarding.
 */
function buildWan3VideoBody(
  input: AliyunVideoInput,
  modelId: string,
  entry: AliyunModelEntry
): Record<string, unknown> {
  validateWan3VideoInput(input, entry);

  const body: Record<string, unknown> = { model: modelId };
  const inputObj: Record<string, unknown> = {};

  if (input.prompt && input.prompt.length > 0) {
    inputObj.prompt = input.prompt;
  }

  const media = input.media;
  if (media && media.length > 0) {
    inputObj.media = media.map((m) => mapWan3MediaEntry(m));
  }
  body.input = inputObj;

  const aliyun = readAliyunVideoOptions(input.providerOptions);
  const parameters: Record<string, unknown> = {};

  if (aliyun.resolution !== undefined) {
    const allowed = entry.supportedResolutions ?? ["480P", "720P", "1080P"];
    if (!allowed.includes(aliyun.resolution)) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `resolution must be one of ${allowed.join(", ")}`,
      });
    }
    parameters.resolution = aliyun.resolution;
  }

  if (aliyun.ratio !== undefined) {
    const allowedRatios = entry.supportedAspectRatios ?? [];
    if (allowedRatios.length > 0 && !allowedRatios.includes(aliyun.ratio)) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `ratio must be one of ${allowedRatios.join(", ")}`,
      });
    }
    parameters.ratio = aliyun.ratio;
  }

  if (aliyun.duration !== undefined) {
    const dur = aliyun.duration;
    if (dur !== -1 && (dur < 2 || dur > 30 || !Number.isInteger(dur))) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message:
          "duration must be an integer in [2, 30] or -1 for smart duration",
      });
    }
    parameters.duration = dur;
  }

  if (aliyun.audio !== undefined) {
    if (typeof aliyun.audio !== "boolean") {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "audio must be a boolean",
      });
    }
    parameters.audio = aliyun.audio;
  }

  if (aliyun.watermark !== undefined) {
    parameters.watermark = aliyun.watermark;
  }

  if (aliyun.seed !== undefined) {
    const seed = aliyun.seed;
    if (!Number.isInteger(seed) || seed < 0 || seed > 2147483647) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "seed must be an integer in [0, 2147483647]",
      });
    }
    parameters.seed = seed;
  }

  if (Object.keys(parameters).length > 0) body.parameters = parameters;
  return body;
}

/**
 * Submit a Wan 3.0 video generation task through the shared async lifecycle.
 * Uses the same endpoint, headers, task polling, and result mapping as
 * HappyHorse video; only body construction and validation differ.
 */
async function submitWan3VideoTask(
  transport: Transport,
  config: AliyunBailianConfig,
  modelId: string,
  input: AliyunVideoInput,
  entry: AliyunModelEntry
): Promise<TaskHandle<VideoContent[]>> {
  const url = buildVideoUrl(config);
  const body = buildWan3VideoBody(input, modelId, entry);
  const headers: Record<string, string> = withOssResolveHeader(
    {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body
  );

  let response;
  try {
    response = await transport.send<AliyunTaskSubmitResponse>({
      url,
      method: "POST",
      headers,
      body,
    });
  } catch (error) {
    throw mapTransportError(error);
  }
  if (response.status < 200 || response.status >= 300) {
    throw classifyHttpError(
      response.status,
      extractTaskSubmitErrorMessage(response.data, config.apiKey)
    );
  }

  const taskId = response.data?.output?.task_id;
  if (!taskId) {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Aliyun video task submission returned no task id",
    });
  }

  const poll = async (): Promise<TaskPollResult<VideoContent[]>> => {
    const task = await getTask(transport, config, taskId);
    const status = mapTaskStatus(task.output?.task_status);
    if (status === "succeeded") {
      const videoUrl = task.output?.video_url;
      if (!videoUrl) {
        return {
          status: "failed",
          error: new SdkError({
            code: "PROVIDER_ERROR",
            message: "Aliyun video task succeeded but returned no video url",
          }),
        };
      }
      const usage = task.usage as
        | { duration?: number; SR?: number; ratio?: string }
        | undefined;
      const video: VideoContent = {
        url: videoUrl,
        ...(typeof usage?.duration === "number"
          ? { duration: usage.duration }
          : {}),
      };
      const content: VideoContent[] = [video];
      const result: GenerationResult<VideoContent[]> = {
        content,
        provider: ALIYUN_PROVIDER_ID,
        model: modelId,
        requestId: task.request_id,
        raw: task.usage,
      };
      return { status, result };
    }
    if (status === "failed" || status === "cancelled") {
      return {
        status,
        error: new SdkError({
          code: "PROVIDER_ERROR",
          message: extractTaskFailureMessage(task, config.apiKey),
        }),
      };
    }
    return { status };
  };

  return createTaskHandle<VideoContent[]>({ taskId, poll });
}

async function submitWanImageTask(
  transport: Transport,
  config: AliyunBailianConfig,
  modelId: string,
  input: WanImageInput,
  entry: AliyunModelEntry
): Promise<TaskHandle<ImageContent[]>> {
  const body: Record<string, unknown> = {
    model: modelId,
    input: {
      messages: [{ role: "user", content: [{ text: input.prompt }] }],
    },
  };
  const parameters = buildWanImageParameters(input, entry);
  if (Object.keys(parameters).length > 0) body.parameters = parameters;

  const headers: Record<string, string> = withOssResolveHeader(
    {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body
  );

  let response;
  try {
    response = await transport.send<AliyunTaskSubmitResponse>({
      url: buildWanImageUrl(config),
      method: "POST",
      headers,
      body,
    });
  } catch (error) {
    throw mapTransportError(error);
  }
  if (response.status < 200 || response.status >= 300) {
    throw classifyHttpError(
      response.status,
      extractTaskSubmitErrorMessage(response.data, config.apiKey)
    );
  }

  const taskId = response.data?.output?.task_id;
  if (!taskId) {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Aliyun Wan image task submission returned no task id",
    });
  }

  const poll = async (): Promise<TaskPollResult<ImageContent[]>> => {
    const task = await getTask(transport, config, taskId);
    const status = mapTaskStatus(task.output?.task_status);
    if (status === "succeeded") {
      const content = mapTaskImageChoices(task.output?.choices);
      if (!content || content.length === 0) {
        return {
          status: "failed",
          error: new SdkError({
            code: "PROVIDER_ERROR",
            message:
              "Aliyun Wan image task succeeded but returned no image choices",
          }),
        };
      }
      const result: GenerationResult<ImageContent[]> = {
        content,
        provider: ALIYUN_PROVIDER_ID,
        model: modelId,
        requestId: task.request_id,
        raw: task.usage,
      };
      return { status, result };
    }
    if (status === "failed" || status === "cancelled") {
      return {
        status,
        error: new SdkError({
          code: "PROVIDER_ERROR",
          message: extractTaskFailureMessage(task, config.apiKey, "image"),
        }),
      };
    }
    return { status };
  };

  return createTaskHandle<ImageContent[]>({ taskId, poll });
}

function mapTaskImageChoices(
  choices: QwenChoice[] | undefined
): ImageContent[] {
  const content: ImageContent[] = [];
  for (const choice of choices ?? []) {
    for (const item of choice.message?.content ?? []) {
      if (typeof item.image === "string" && item.image.length > 0) {
        content.push({ url: item.image });
      }
    }
  }
  return content;
}

function extractTaskSubmitErrorMessage(
  data: AliyunTaskSubmitResponse | undefined,
  apiKey: string
): string | undefined {
  const message = data?.message;
  if (typeof message === "string" && message.length > 0) {
    return message.replaceAll(apiKey, "[redacted]");
  }
  return undefined;
}

function extractTaskErrorMessage(
  data: AliyunTaskResponse | undefined,
  apiKey: string
): string | undefined {
  const message = [data?.code, data?.message]
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0
    )
    .join(": ");
  if (message.length > 0) return message.replaceAll(apiKey, "[redacted]");
  return undefined;
}

function extractTaskFailureMessage(
  task: AliyunTaskResponse | undefined,
  apiKey: string,
  modality: "image" | "video" = "video"
): string {
  const message = [task?.output?.code, task?.output?.message]
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0
    )
    .join(": ");
  if (message.length > 0) return message.replaceAll(apiKey, "[redacted]");
  return `Aliyun ${modality} task failed`;
}
