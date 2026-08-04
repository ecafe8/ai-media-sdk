import {
  SdkError,
  classifyHttpError,
  createTaskHandle,
  createTransport,
  isImageEditInput,
  isImageGenerationInput,
  notImplemented,
  toImageUrl,
  TransportError,
  type AdapterRequest,
  type GenerationResult,
  type ImageContent,
  type ImageModelInstance,
  type ProviderAdapter,
  type ProviderId,
  type TaskHandle,
  type TaskPollResult,
  type TaskStatus,
  type Transport,
  type VideoContent,
  type VideoModelInstance,
} from "@ai-media/sdk";

import type { AliyunBailianConfig } from "../config/index.ts";
import type { AliyunImageProviderOptions } from "./options.ts";
import { ALIYUN_MODEL_REGISTRY, type AliyunModelEntry } from "./registry.ts";

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
  /** Create an image model instance bound to an Aliyun model id. */
  image: (modelId: string) => ImageModelInstance;
  /** Create a video model instance bound to a HappyHorse video model id. */
  video: (modelId: string) => VideoModelInstance;
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
          code: "INVALID_REQUEST",
          message: `Unknown Aliyun model id "${modelId}"`,
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
          code: "INVALID_REQUEST",
          message: `Unknown Aliyun model id "${modelId}"`,
        });
      }
      if (entry.family !== "happyhorse-video") {
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
      if (entry.family !== "happyhorse-video") {
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
      code: "INVALID_REQUEST",
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
    watermark?: boolean;
    seed?: number;
    thinking_mode?: string;
    color_palette?: unknown;
    enable_sequential?: boolean;
  } = {};
  if (typeof candidate.negative_prompt === "string") {
    options.negative_prompt = candidate.negative_prompt;
  }
  if (typeof candidate.prompt_extend === "boolean") {
    options.prompt_extend = candidate.prompt_extend;
  }
  if (typeof candidate.watermark === "boolean") {
    options.watermark = candidate.watermark;
  }
  if (typeof candidate.seed === "number") {
    options.seed = candidate.seed;
  }
  if (typeof candidate.thinking_mode === "string") {
    options.thinking_mode = candidate.thinking_mode;
  }
  if (candidate.color_palette !== undefined) {
    options.color_palette = candidate.color_palette;
  }
  if (typeof candidate.enable_sequential === "boolean") {
    options.enable_sequential = candidate.enable_sequential;
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

async function sendQwenRequest(
  transport: Transport,
  config: AliyunBailianConfig,
  modelId: string,
  content: QwenContentItem[],
  input: QwenInputParams,
  entry: AliyunModelEntry
): Promise<GenerationResult<ImageContent[]>> {
  const url = buildUrl(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  const body = {
    model: modelId,
    input: { messages: [{ role: "user", content }] },
    parameters: buildParameters(input, entry),
  };

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
  readonly prompt: string;
  readonly firstFrame?: ImageContent;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * Aliyun-native video options forwarded under `providerOptions.aliyun`.
 */
interface AliyunVideoOptions {
  readonly resolution?: string;
  readonly ratio?: string;
  readonly duration?: number;
  readonly watermark?: boolean;
  readonly seed?: number;
}

/**
 * DashScope async task poll response shape (shared by image and video async).
 */
interface AliyunTaskResponse {
  readonly output?: {
    readonly task_id?: string;
    readonly task_status?: string;
    readonly video_url?: string;
    readonly results?: ReadonlyArray<{ readonly url?: string }>;
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
 */
function isVideoGenerationInput(value: unknown): value is AliyunVideoInput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.prompt === "string";
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

function buildVideoBody(
  input: AliyunVideoInput,
  modelId: string,
  entry: AliyunModelEntry
): Record<string, unknown> {
  const body: Record<string, unknown> = { model: modelId };
  const inputObj: Record<string, unknown> = { prompt: input.prompt };

  if (entry.requiresFirstFrame) {
    if (!input.firstFrame) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "First-frame image input is required for this video model",
      });
    }
    inputObj.media = [
      { type: "first_frame", url: mapImageContent(input.firstFrame) },
    ];
  } else if (input.firstFrame) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "This video model does not accept a first-frame image",
    });
  }
  body.input = inputObj;

  const aliyun = readAliyunVideoOptions(input.providerOptions);
  const parameters: Record<string, unknown> = {};
  if (aliyun.resolution !== undefined) {
    parameters.resolution = aliyun.resolution;
  }
  // i2v follows the first-frame aspect ratio; `ratio` is not forwarded.
  if (aliyun.ratio !== undefined && !entry.requiresFirstFrame) {
    parameters.ratio = aliyun.ratio;
  }
  if (aliyun.duration !== undefined) parameters.duration = aliyun.duration;
  if (aliyun.watermark !== undefined) parameters.watermark = aliyun.watermark;
  if (aliyun.seed !== undefined) parameters.seed = aliyun.seed;
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
 * Submit a HappyHorse video generation task and return a `TaskHandle` whose
 * poll closure calls the shared `getTask` and extracts `output.video_url`.
 */
async function submitVideoTask(
  transport: Transport,
  config: AliyunBailianConfig,
  modelId: string,
  input: AliyunVideoInput,
  entry: AliyunModelEntry
): Promise<TaskHandle<VideoContent[]>> {
  const url = buildVideoUrl(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    "X-DashScope-Async": "enable",
  };
  const body = buildVideoBody(input, modelId, entry);

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
        { duration?: number; SR?: number; ratio?: string } | undefined;
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
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    "X-DashScope-Async": "enable",
  };
  const body: Record<string, unknown> = {
    model: modelId,
    input: { prompt: input.prompt },
  };
  const parameters = buildWanImageParameters(input, entry);
  if (Object.keys(parameters).length > 0) body.parameters = parameters;

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
      const results = task.output?.results;
      const content = results
        ?.filter(
          (result): result is { readonly url: string } =>
            typeof result.url === "string" && result.url.length > 0
        )
        .map((result) => ({ url: result.url }));
      if (!content || content.length === 0) {
        return {
          status: "failed",
          error: new SdkError({
            code: "PROVIDER_ERROR",
            message:
              "Aliyun Wan image task succeeded but returned no image urls",
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
