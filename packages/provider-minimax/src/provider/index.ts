import {
  type AdapterRequest,
  classifyHttpError,
  createTaskHandle,
  createTransport,
  type GenerationResult,
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
  type VideoGenerationInput,
  type VideoModelInstance,
} from "@ai-media/sdk";

import { type MiniMaxConfig, resolveBaseUrl } from "../config/index.ts";
import type { MiniMaxH3VideoParams } from "./params.ts";
import {
  MINIMAX_MODEL_REGISTRY,
  type MiniMaxModelEntry,
  minimaxModelRegistry,
} from "./registry.ts";

/**
 * MiniMax (Hailuo) Provider factory, model instance, and adapter.
 *
 * The adapter builds MiniMax-H3 asynchronous video requests against the V2
 * API: `POST /v2/video_generation` accepts a multimodal `content[]` array
 * (text / image_url / video_url / audio_url with role labels) covering
 * text-to-video, first/last-frame image-to-video, and reference-to-video, and
 * returns a `task_id`; the poll closure queries
 * `GET /v2/query/video_generation/{task_id}` until the task reaches a
 * terminal state and maps `task.content.url` into `VideoContent[]`.
 */

const MINIMAX_PROVIDER_ID: ProviderId = "minimax";
const VIDEO_GENERATION_PATH = "/v2/video_generation";
const QUERY_PATH_PREFIX = "/v2/query/video_generation/";

/**
 * Options for constructing a MiniMax Provider.
 */
export interface MiniMaxProviderOptions {
  /** Injected shared transport; a default transport is created when omitted. */
  readonly transport?: Transport;
}

/**
 * MiniMax Provider adapter, specialized to `VideoContent[]` for the video
 * modality. MiniMax is video-only today: synchronous `generate`/`edit` always
 * fail with `NOT_IMPLEMENTED`.
 */
export interface MiniMaxProvider extends ProviderAdapter<VideoContent[]> {
  readonly providerId: ProviderId;
  readonly config: Readonly<MiniMaxConfig>;
  readonly transport: Transport;
  /**
   * Create a video model instance bound to a supported MiniMax model id.
   *
   * The literal overload returns a family-typed
   * `VideoModelInstance<MiniMaxH3VideoParams>` so `submitVideoTask` narrows
   * `prompt` and `providerOptions.minimax.resolution`/`duration`/`ratio` at
   * compile time. The string fallback keeps the default
   * `VideoGenerationInput` shape for dynamic ids.
   */
  video: {
    (modelId: "MiniMax-H3"): VideoModelInstance<MiniMaxH3VideoParams>;
    (modelId: string): VideoModelInstance;
  };
  /** Enumerate the supported models projected from the MiniMax registry. */
  listModels: () => readonly SupportedModel[];
}

/**
 * A single multimodal entry in the MiniMax V2 `content[]` request array.
 */
interface MiniMaxContentItem {
  readonly type: "text" | "image_url" | "video_url" | "audio_url";
  readonly text?: string;
  readonly image_url?: { readonly url: string };
  readonly video_url?: { readonly url: string };
  readonly audio_url?: { readonly url: string };
  readonly role?:
    | "first_frame"
    | "last_frame"
    | "reference_image"
    | "reference_video"
    | "reference_audio";
}

/**
 * OpenAI-style error detail shared by all MiniMax V2 error responses.
 */
interface MiniMaxOaiErrorDetail {
  readonly type?: string;
  readonly message?: string;
  readonly http_code?: string;
}

/**
 * MiniMax V2 task submit response shape.
 */
interface MiniMaxSubmitResponse {
  readonly task_id?: string;
  readonly type?: string;
  readonly error?: MiniMaxOaiErrorDetail;
  readonly request_id?: string;
}

/**
 * MiniMax V2 task object returned by the query endpoint.
 */
interface MiniMaxTask {
  readonly id?: string;
  readonly model?: string;
  readonly status?: string;
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
  readonly created_at?: number;
  readonly updated_at?: number;
  readonly content?: {
    readonly url?: string;
    readonly prompt?: string;
  };
  readonly resolution?: string;
  readonly duration?: number;
  readonly usage?: Readonly<Record<string, unknown>>;
  readonly ratio?: string;
  readonly task_type?: string;
  readonly modality?: string;
}

/**
 * MiniMax V2 task query response shape.
 */
interface MiniMaxTaskQueryResponse {
  readonly task?: MiniMaxTask;
  readonly type?: string;
  readonly error?: MiniMaxOaiErrorDetail;
  readonly request_id?: string;
}

/**
 * Runtime projection of `providerOptions.minimax` after type filtering.
 * `resolution`/`duration` are API-required and validated before transport.
 */
interface MiniMaxVideoRawOptions {
  readonly resolution?: string;
  readonly duration?: number;
  readonly ratio?: string;
  readonly callbackUrl?: string;
}

/**
 * The generation scenario derived from the supplied media inputs. MiniMax-H3
 * serves all scenarios from one model id; the API itself derives behavior
 * from the `content[]` roles.
 */
type MiniMaxVideoScenario = "t2v" | "i2v" | "r2v";

/**
 * Create a MiniMax Provider from typed configuration.
 *
 * The factory depends only on `@ai-media/sdk`; no MiniMax SDK or other
 * external Provider runtime dependency is introduced. When no transport is
 * supplied a default shared transport is created so the adapter never calls
 * global `fetch` directly.
 */
export function createMiniMaxProvider(
  config: MiniMaxConfig,
  options?: MiniMaxProviderOptions
): MiniMaxProvider {
  const transport = options?.transport ?? createTransport();

  const provider: MiniMaxProvider = {
    providerId: MINIMAX_PROVIDER_ID,
    config,
    transport,

    video: (modelId: string): VideoModelInstance => {
      const entry = MINIMAX_MODEL_REGISTRY[modelId];
      if (!entry) {
        throw new SdkError({
          code: "UNKNOWN_MODEL",
          message: `Unknown MiniMax model id "${modelId}"`,
        });
      }
      if (entry.capabilities.modality !== "video") {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: `MiniMax model "${modelId}" is not a video model`,
        });
      }
      return {
        providerId: MINIMAX_PROVIDER_ID,
        modelId,
        adapter: provider,
        capabilities: entry.capabilities,
      };
    },

    listModels: (): readonly SupportedModel[] => minimaxModelRegistry.models,

    async generate(
      request: AdapterRequest
    ): Promise<GenerationResult<VideoContent[]>> {
      throw notImplemented(`minimax.generate (${request.model})`);
    },

    async edit(
      request: AdapterRequest
    ): Promise<GenerationResult<VideoContent[]>> {
      throw notImplemented(`minimax.edit (${request.model})`);
    },

    async submit(request: AdapterRequest): Promise<TaskHandle<VideoContent[]>> {
      const entry = MINIMAX_MODEL_REGISTRY[request.model];
      if (!entry) {
        throw new SdkError({
          code: "UNKNOWN_MODEL",
          message: `Unknown MiniMax model id "${request.model}"`,
        });
      }
      if (!isVideoGenerationInput(request.input)) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message:
            "MiniMax adapter received a malformed video generation input",
        });
      }
      return submitMiniMaxVideoTask(
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

/**
 * Type guard narrowing an `unknown` adapter input to the video input shape.
 *
 * Demonstrates structural shape only; per-scenario media/prompt validation is
 * performed by `validateMiniMaxVideoInput` before any transport call.
 */
function isVideoGenerationInput(value: unknown): value is VideoGenerationInput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.prompt === undefined || typeof candidate.prompt === "string";
}

/**
 * Read `providerOptions.minimax` with runtime type filtering. Throws
 * `INVALID_REQUEST` when the namespace is absent because `resolution` and
 * `duration` are required by the MiniMax V2 API in every request.
 */
function readMiniMaxVideoOptions(
  providerOptions?: Readonly<Record<string, unknown>>
): MiniMaxVideoRawOptions {
  const raw = providerOptions?.minimax;
  if (typeof raw !== "object" || raw === null) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message:
        "MiniMax video requests require providerOptions.minimax with resolution and duration",
    });
  }
  const candidate = raw as Record<string, unknown>;
  const options: {
    resolution?: string;
    duration?: number;
    ratio?: string;
    callbackUrl?: string;
  } = {};
  if (typeof candidate.resolution === "string") {
    options.resolution = candidate.resolution;
  }
  if (typeof candidate.duration === "number") {
    options.duration = candidate.duration;
  }
  if (typeof candidate.ratio === "string") options.ratio = candidate.ratio;
  if (typeof candidate.callbackUrl === "string") {
    options.callbackUrl = candidate.callbackUrl;
  }
  return options;
}

function hasFrames(input: VideoGenerationInput): boolean {
  return input.firstFrame !== undefined || input.lastFrame !== undefined;
}

function hasReferences(input: VideoGenerationInput): boolean {
  return (
    (input.referenceImages?.length ?? 0) > 0 ||
    (input.referenceVideos?.length ?? 0) > 0 ||
    (input.referenceAudios?.length ?? 0) > 0
  );
}

function detectScenario(input: VideoGenerationInput): MiniMaxVideoScenario {
  if (hasFrames(input)) return "i2v";
  if (hasReferences(input)) return "r2v";
  return "t2v";
}

/**
 * Validate MiniMax-H3 media combinations and limits before any transport
 * call. Enforces:
 * - A non-empty prompt (required in every scenario).
 * - Image-to-video frames and reference media are mutually exclusive.
 * - `lastFrame` requires `firstFrame`.
 * - At most 9 reference images, 3 reference videos, 3 reference audios.
 * - Images require a url or base64; reference videos/audios require a url.
 * - Reference video/audio per-clip duration [2, 15]s and total ≤ 15s when
 *   caller-supplied metadata exists.
 */
function validateMiniMaxVideoInput(
  input: VideoGenerationInput,
  entry: MiniMaxModelEntry
): void {
  if (!input.prompt || input.prompt.trim().length === 0) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "MiniMax video requests require a non-empty prompt",
    });
  }

  if (hasFrames(input) && hasReferences(input)) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message:
        "Image-to-video frames and reference media are mutually exclusive",
    });
  }

  if (input.lastFrame !== undefined && input.firstFrame === undefined) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "lastFrame requires a firstFrame",
    });
  }

  const referenceImages = input.referenceImages ?? [];
  const referenceVideos = input.referenceVideos ?? [];
  const referenceAudios = input.referenceAudios ?? [];

  if (referenceImages.length > entry.maxReferenceImages) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `MiniMax accepts at most ${entry.maxReferenceImages} reference images`,
    });
  }
  if (referenceVideos.length > entry.maxReferenceVideos) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `MiniMax accepts at most ${entry.maxReferenceVideos} reference videos`,
    });
  }
  if (referenceAudios.length > entry.maxReferenceAudios) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `MiniMax accepts at most ${entry.maxReferenceAudios} reference audios`,
    });
  }

  for (const [label, image] of [
    ["firstFrame", input.firstFrame],
    ["lastFrame", input.lastFrame],
  ] as const) {
    if (image !== undefined && toImageUrl(image) === undefined) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `${label} requires a url or base64`,
      });
    }
  }

  referenceImages.forEach((image, index) => {
    if (toImageUrl(image) === undefined) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `referenceImages[${index}] requires a url or base64`,
      });
    }
  });

  validateReferenceDurations(
    "reference video",
    referenceVideos.map((video) => video.duration)
  );
  validateReferenceDurations(
    "reference audio",
    referenceAudios.map((audio) => audio.duration)
  );

  referenceVideos.forEach((video, index) => {
    if (!video.url) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `referenceVideos[${index}] requires a url`,
      });
    }
  });
  referenceAudios.forEach((audio, index) => {
    if (!audio.url) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `referenceAudios[${index}] requires a url`,
      });
    }
  });
}

/**
 * Validate caller-supplied reference duration metadata: each clip 2-15
 * seconds and a 15 second total. Entries without metadata are skipped; the
 * provider remains authoritative when metadata is unavailable.
 */
function validateReferenceDurations(
  label: string,
  durations: readonly (number | undefined)[]
): void {
  let total = 0;
  for (const duration of durations) {
    if (duration === undefined) continue;
    if (duration < 2 || duration > 15) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `Each ${label} must be 2-15 seconds`,
      });
    }
    total += duration;
  }
  if (total > 15) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `${label} total duration must not exceed 15 seconds`,
    });
  }
}

/**
 * Resolve the per-scenario `ratio` value. Text-to-video requires a concrete
 * ratio (never `adaptive`); image-to-video always resolves to `adaptive`;
 * reference-to-video defaults to `adaptive` and accepts any documented ratio.
 */
function resolveRatio(
  scenario: MiniMaxVideoScenario,
  options: MiniMaxVideoRawOptions,
  entry: MiniMaxModelEntry
): string {
  if (scenario === "t2v") {
    if (options.ratio === undefined) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message:
          "MiniMax text-to-video requires a ratio under providerOptions.minimax",
      });
    }
    if (options.ratio === "adaptive") {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: "MiniMax text-to-video ratio cannot be adaptive",
      });
    }
    if (!entry.supportedAspectRatios.includes(options.ratio)) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `ratio must be one of ${entry.supportedAspectRatios.join(", ")}`,
      });
    }
    return options.ratio;
  }
  if (scenario === "i2v") {
    return "adaptive";
  }
  const ratio = options.ratio ?? "adaptive";
  if (!entry.supportedAspectRatios.includes(ratio)) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `ratio must be one of ${entry.supportedAspectRatios.join(", ")}`,
    });
  }
  return ratio;
}

/**
 * Validate the API-required `resolution`/`duration` parameters and build the
 * MiniMax V2 request body, including the multimodal `content[]` array.
 */
function buildVideoBody(
  input: VideoGenerationInput,
  modelId: string,
  entry: MiniMaxModelEntry
): Record<string, unknown> {
  validateMiniMaxVideoInput(input, entry);
  const options = readMiniMaxVideoOptions(input.providerOptions);

  if (options.resolution === undefined) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "MiniMax video requests require a resolution",
    });
  }
  if (!entry.supportedResolutions.includes(options.resolution)) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `resolution must be one of ${entry.supportedResolutions.join(", ")}`,
    });
  }
  if (options.duration === undefined) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "MiniMax video requests require a duration",
    });
  }
  if (
    !Number.isInteger(options.duration) ||
    options.duration < 4 ||
    options.duration > 15
  ) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "duration must be an integer between 4 and 15",
    });
  }

  const scenario = detectScenario(input);
  const ratio = resolveRatio(scenario, options, entry);

  const content: MiniMaxContentItem[] = [];
  content.push({ type: "text", text: input.prompt });
  if (input.firstFrame !== undefined) {
    content.push({
      type: "image_url",
      image_url: { url: toImageUrl(input.firstFrame) as string },
      role: "first_frame",
    });
  }
  if (input.lastFrame !== undefined) {
    content.push({
      type: "image_url",
      image_url: { url: toImageUrl(input.lastFrame) as string },
      role: "last_frame",
    });
  }
  for (const image of input.referenceImages ?? []) {
    content.push({
      type: "image_url",
      image_url: { url: toImageUrl(image) as string },
      role: "reference_image",
    });
  }
  for (const video of input.referenceVideos ?? []) {
    content.push({
      type: "video_url",
      video_url: { url: video.url },
      role: "reference_video",
    });
  }
  for (const audio of input.referenceAudios ?? []) {
    content.push({
      type: "audio_url",
      audio_url: { url: audio.url },
      role: "reference_audio",
    });
  }

  const body: Record<string, unknown> = {
    model: modelId,
    content,
    resolution: options.resolution,
    duration: options.duration,
    ratio,
  };
  if (options.callbackUrl !== undefined) {
    body.callback_url = options.callbackUrl;
  }
  return body;
}

function buildSubmitUrl(config: MiniMaxConfig): string {
  return `${resolveBaseUrl(config)}${VIDEO_GENERATION_PATH}`;
}

function buildQueryUrl(config: MiniMaxConfig, taskId: string): string {
  return `${resolveBaseUrl(config)}${QUERY_PATH_PREFIX}${encodeURIComponent(taskId)}`;
}

/**
 * Map MiniMax task statuses to core task statuses. Unknown statuses map to a
 * terminal failure so polling cannot loop forever on a new provider state.
 */
function mapTaskStatus(status: string | undefined): TaskStatus {
  switch (status) {
    case "queued":
      return "pending";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "failed";
  }
}

/**
 * Shared async-task poll: `GET /v2/query/video_generation/{task_id}` with
 * `Authorization: Bearer`. Returns the raw query envelope for content
 * extraction.
 */
async function getTask(
  transport: Transport,
  config: MiniMaxConfig,
  taskId: string
): Promise<MiniMaxTaskQueryResponse> {
  const url = buildQueryUrl(config, taskId);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };
  let response;
  try {
    response = await transport.send<MiniMaxTaskQueryResponse>({
      url,
      method: "GET",
      headers,
    });
  } catch (error) {
    throw mapTransportError(error);
  }
  if (response.status < 200 || response.status >= 300) {
    throw classifyMiniMaxHttpError(
      response.status,
      response.data,
      config.apiKey
    );
  }
  return response.data;
}

/**
 * Submit a MiniMax-H3 video generation task and return a `TaskHandle` whose
 * poll closure calls the shared `getTask` and extracts `task.content.url`.
 */
async function submitMiniMaxVideoTask(
  transport: Transport,
  config: MiniMaxConfig,
  modelId: string,
  input: VideoGenerationInput,
  entry: MiniMaxModelEntry
): Promise<TaskHandle<VideoContent[]>> {
  const url = buildSubmitUrl(config);
  const body = buildVideoBody(input, modelId, entry);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  let response;
  try {
    response = await transport.send<MiniMaxSubmitResponse>({
      url,
      method: "POST",
      headers,
      body,
    });
  } catch (error) {
    throw mapTransportError(error);
  }
  if (response.status < 200 || response.status >= 300) {
    throw classifyMiniMaxHttpError(
      response.status,
      response.data,
      config.apiKey
    );
  }

  const taskId = response.data?.task_id;
  if (!taskId) {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "MiniMax video task submission returned no task id",
    });
  }

  const poll = async (): Promise<TaskPollResult<VideoContent[]>> => {
    const envelope = await getTask(transport, config, taskId);
    const task = envelope.task;
    const status = mapTaskStatus(task?.status);
    if (status === "succeeded") {
      const videoUrl = task?.content?.url;
      if (!videoUrl) {
        return {
          status: "failed",
          error: new SdkError({
            code: "PROVIDER_ERROR",
            message: "MiniMax video task succeeded but returned no video url",
          }),
        };
      }
      const video: VideoContent = {
        url: videoUrl,
        ...(typeof task?.duration === "number"
          ? { duration: task.duration }
          : {}),
      };
      const content: VideoContent[] = [video];
      const result: GenerationResult<VideoContent[]> = {
        content,
        provider: MINIMAX_PROVIDER_ID,
        model: modelId,
        raw: task?.usage,
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

/**
 * Classify a non-2xx MiniMax response. The OpenAI-style error message is
 * extracted and redacted; HTTP 402 (insufficient balance) has no core
 * classification and maps to a non-retryable `PROVIDER_ERROR`.
 */
function classifyMiniMaxHttpError(
  status: number,
  data: unknown,
  apiKey: string
): SdkError {
  const message = extractOaiErrorMessage(data, apiKey);
  if (status === 402) {
    return new SdkError({
      code: "PROVIDER_ERROR",
      message: message ?? "MiniMax reported insufficient balance (HTTP 402)",
    });
  }
  return classifyHttpError(status, message);
}

function extractOaiErrorMessage(
  data: unknown,
  apiKey: string
): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const candidate = data as {
    readonly error?: { readonly message?: unknown };
    readonly message?: unknown;
  };
  const message = candidate.error?.message ?? candidate.message;
  if (typeof message !== "string" || message.length === 0) return undefined;
  return message.replaceAll(apiKey, "[redacted]");
}

function extractTaskFailureMessage(
  task: MiniMaxTask | undefined,
  apiKey: string
): string {
  const message = [task?.error?.code, task?.error?.message]
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0
    )
    .join(": ");
  if (message.length > 0) return message.replaceAll(apiKey, "[redacted]");
  return "MiniMax video task failed";
}
