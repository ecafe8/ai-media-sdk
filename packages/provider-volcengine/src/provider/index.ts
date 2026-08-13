import {
  type AdapterRequest,
  classifyHttpError,
  createTransport,
  type GenerationResult,
  type ImageContent,
  type ImageModelInstance,
  isImageEditInput,
  isImageGenerationInput,
  type ProviderAdapter,
  type ProviderId,
  SdkError,
  type SupportedModel,
  type Transport,
  TransportError,
  toImageUrl,
} from "@ai-media/sdk";

import { resolveBaseUrl, type VolcengineConfig } from "../config/index.ts";
import type { VolcengineImageProviderOptions } from "./options.ts";
import type {
  VolcengineSeedream5LiteParams,
  VolcengineSeedream5ProParams,
  VolcengineSeedream40Params,
  VolcengineSeedream45Params,
} from "./params.ts";
import {
  VOLCENGINE_MODEL_REGISTRY,
  type VolcengineModelEntry,
  volcengineModelRegistry,
} from "./registry.ts";

/**
 * Volcengine Ark Provider factory, model instance, and adapter.
 *
 * The adapter builds the OpenAI-compatible `/images/generations` request with
 * `Authorization: Bearer`, sending T2I (no `image` field) and I2I (single
 * string or `string[]` `image` field) through the shared transport, and maps
 * the synchronous `data[]` response into `GenerationResult<ImageContent[]>`.
 */
const VOLCENGINE_PROVIDER_ID: ProviderId = "volcengine";
const GENERATIONS_PATH = "/images/generations";

/**
 * Options for constructing a Volcengine Ark Provider.
 */
export interface VolcengineProviderOptions {
  /** Injected shared transport; a default transport is created when omitted. */
  readonly transport?: Transport;
}

/**
 * Volcengine Ark Provider adapter, specialized to `ImageContent[]`.
 */
export interface VolcengineProvider extends ProviderAdapter<ImageContent[]> {
  readonly providerId: ProviderId;
  readonly config: Readonly<VolcengineConfig>;
  readonly transport: Transport;
  /**
   * Create an image model instance bound to a Volcengine Ark model id.
   *
   * Literal overloads return family-typed
   * `ImageModelInstance<VolcengineSeedream*Params>` per model generation so
   * `generateImage`/`editImage` narrow `size` to the model's tier enum literal
   * union and `providerOptions.volcengine` to the
   * `VolcengineImageProviderOptions` shape at compile time. The string fallback
   * keeps the default `ImageGenerationInput` shape for dynamic ids.
   */
  image: {
    (
      modelId: "doubao-seedream-5-0-pro-260628"
    ): ImageModelInstance<VolcengineSeedream5ProParams>;
    (
      modelId: "doubao-seedream-5-0-260128" | "doubao-seedream-5-0-lite-260128"
    ): ImageModelInstance<VolcengineSeedream5LiteParams>;
    (
      modelId: "doubao-seedream-4-5-251128"
    ): ImageModelInstance<VolcengineSeedream45Params>;
    (
      modelId: "doubao-seedream-4-0-250828"
    ): ImageModelInstance<VolcengineSeedream40Params>;
    (modelId: string): ImageModelInstance;
  };
  /** Enumerate the supported models projected from the Volcengine registry. */
  listModels: () => readonly SupportedModel[];
}

interface ArkImageItem {
  readonly url?: string;
  readonly b64_json?: string;
  readonly size?: string;
}

interface ArkImageResponse {
  readonly created?: number;
  readonly data?: ArkImageItem[];
  readonly request_id?: string;
  readonly usage?: Readonly<Record<string, unknown>>;
  readonly error?: { readonly code?: string; readonly message?: string };
}

/**
 * Minimal input shape for parameter building shared by T2I and I2I.
 */
interface VolcengineInputParams {
  readonly prompt: string;
  readonly size?: string;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * Create a Volcengine Ark Provider from typed configuration.
 *
 * The factory depends only on `@ai-media/sdk`; no Volcengine Ark SDK or other
 * external Provider runtime dependency is introduced. When no transport is
 * supplied a default shared transport is created so the adapter never calls
 * global `fetch` directly.
 */
export function createVolcengineProvider(
  config: VolcengineConfig,
  options?: VolcengineProviderOptions
): VolcengineProvider {
  const transport = options?.transport ?? createTransport();

  const provider: VolcengineProvider = {
    providerId: VOLCENGINE_PROVIDER_ID,
    config,
    transport,

    image: (modelId: string): ImageModelInstance => {
      const entry = VOLCENGINE_MODEL_REGISTRY[modelId];
      if (!entry) {
        throw new SdkError({
          code: "UNKNOWN_MODEL",
          message: `Unknown Volcengine Ark model id "${modelId}"`,
        });
      }
      return {
        providerId: VOLCENGINE_PROVIDER_ID,
        modelId,
        adapter: provider,
        capabilities: entry.capabilities,
      };
    },

    listModels: (): readonly SupportedModel[] => volcengineModelRegistry.models,

    async generate(
      request: AdapterRequest
    ): Promise<GenerationResult<ImageContent[]>> {
      requireRegistryEntry(request.model);
      if (!isImageGenerationInput(request.input)) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message:
            "Volcengine Ark adapter received a malformed image generation input",
        });
      }

      const input = request.input;
      const body = buildRequestBody(input, request.model);
      return sendVolcengineRequest(transport, config, body, request.model);
    },

    async edit(
      request: AdapterRequest
    ): Promise<GenerationResult<ImageContent[]>> {
      requireRegistryEntry(request.model);
      if (!isImageEditInput(request.input)) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message:
            "Volcengine Ark adapter received a malformed image edit input",
        });
      }

      const input = request.input;
      const imageField = mapImageInput(input.images);
      const body = {
        ...buildRequestBody(input, request.model),
        image: imageField,
      };
      return sendVolcengineRequest(transport, config, body, request.model);
    },
  };

  return provider;
}

function requireRegistryEntry(modelId: string): VolcengineModelEntry {
  const entry = VOLCENGINE_MODEL_REGISTRY[modelId];
  if (!entry) {
    throw new SdkError({
      code: "UNKNOWN_MODEL",
      message: `Unknown Volcengine Ark model id "${modelId}"`,
    });
  }
  return entry;
}

function buildRequestBody(
  input: VolcengineInputParams,
  modelId: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: modelId,
    prompt: input.prompt,
  };
  if (input.size !== undefined) body.size = input.size;

  const volcengine = readVolcengineOptions(input.providerOptions);
  if (volcengine.response_format !== undefined) {
    body.response_format = volcengine.response_format;
  }
  if (volcengine.output_format !== undefined) {
    body.output_format = volcengine.output_format;
  }
  if (volcengine.watermark !== undefined) body.watermark = volcengine.watermark;
  if (volcengine.optimize_prompt_options !== undefined) {
    body.optimize_prompt_options = volcengine.optimize_prompt_options;
  }
  return body;
}

function readVolcengineOptions(
  providerOptions?: Readonly<Record<string, unknown>>
): VolcengineImageProviderOptions {
  const raw = providerOptions?.volcengine;
  if (typeof raw !== "object" || raw === null) return {};
  const candidate = raw as Record<string, unknown>;
  const options: {
    watermark?: boolean;
    output_format?: "png" | "jpeg";
    response_format?: "url" | "b64_json";
    optimize_prompt_options?: { mode?: "standard" | "fast" };
  } = {};
  if (typeof candidate.watermark === "boolean") {
    options.watermark = candidate.watermark;
  }
  if (
    typeof candidate.output_format === "string" &&
    (candidate.output_format === "png" || candidate.output_format === "jpeg")
  ) {
    options.output_format = candidate.output_format;
  }
  if (
    typeof candidate.response_format === "string" &&
    (candidate.response_format === "url" ||
      candidate.response_format === "b64_json")
  ) {
    options.response_format = candidate.response_format;
  }
  if (
    typeof candidate.optimize_prompt_options === "object" &&
    candidate.optimize_prompt_options !== null
  ) {
    const optimize = candidate.optimize_prompt_options as Record<
      string,
      unknown
    >;
    if (
      typeof optimize.mode === "string" &&
      (optimize.mode === "standard" || optimize.mode === "fast")
    ) {
      options.optimize_prompt_options = { mode: optimize.mode };
    }
  }
  return options;
}

/**
 * Map the SDK's `ImageContent[]` to the Ark `image` field: a single string for
 * one reference image, or a `string[]` for 1-N references preserving input
 * order. Each entry is the URL or a `data:{mime};base64,{base64}` data URI.
 */
function mapImageInput(images: readonly ImageContent[]): string | string[] {
  const entries = images.map((image) => mapImageContent(image));
  if (entries.length === 1) return entries[0]!;
  return entries;
}

function mapImageContent(image: ImageContent): string {
  const imageUrl = toImageUrl(image);
  if (imageUrl) return imageUrl;
  throw new SdkError({
    code: "INVALID_REQUEST",
    message: "Edit input image must carry a url or base64",
  });
}

function buildUrl(config: VolcengineConfig): string {
  return `${resolveBaseUrl(config)}${GENERATIONS_PATH}`;
}

async function sendVolcengineRequest(
  transport: Transport,
  config: VolcengineConfig,
  body: Record<string, unknown>,
  modelId: string
): Promise<GenerationResult<ImageContent[]>> {
  const url = buildUrl(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  let response;
  try {
    response = await transport.send<ArkImageResponse>({
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

  return mapVolcengineResponse(response.data, VOLCENGINE_PROVIDER_ID, modelId);
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
  data: ArkImageResponse | undefined,
  apiKey: string
): string | undefined {
  const message = data?.error?.message;
  if (typeof message === "string" && message.length > 0) {
    return message.replaceAll(apiKey, "[redacted]");
  }
  return undefined;
}

function mapVolcengineResponse(
  data: ArkImageResponse | undefined,
  providerId: ProviderId,
  model: string
): GenerationResult<ImageContent[]> {
  const items = data?.data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Volcengine Ark returned no image data in the response",
    });
  }

  const content: ImageContent[] = items.map((item) => {
    const dimensions = parseSize(item.size);
    const image: ImageContent = {
      url: item.url,
      base64: item.b64_json,
      ...(dimensions
        ? { width: dimensions.width, height: dimensions.height }
        : {}),
    };
    return image;
  });

  return {
    content,
    provider: providerId,
    model,
    requestId: data?.request_id,
    createdAt:
      typeof data?.created === "number"
        ? new Date(data.created * 1000).toISOString()
        : undefined,
    raw: data?.usage,
  };
}

/**
 * Parse a `"WxH"` size string (e.g. `"2048x2048"`) into numeric dimensions.
 * Returns `undefined` when the value is missing or does not match the shape.
 */
function parseSize(
  size: string | undefined
): { width: number; height: number } | undefined {
  if (typeof size !== "string") return undefined;
  const match = size.match(/^(\d+)x(\d+)$/i);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  return { width, height };
}
