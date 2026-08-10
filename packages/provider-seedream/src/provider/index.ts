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

import { resolveBaseUrl, type SeedreamConfig } from "../config/index.ts";
import type { SeedreamImageProviderOptions } from "./options.ts";
import type {
  Seedream5LiteParams,
  Seedream5ProParams,
  Seedream40Params,
  Seedream45Params,
} from "./params.ts";
import {
  SEEDREAM_MODEL_REGISTRY,
  type SeedreamModelEntry,
  seedreamModelRegistry,
} from "./registry.ts";

/**
 * Volcengine Ark Doubao-Seedream Provider factory, model instance, and adapter.
 *
 * The adapter builds the OpenAI-compatible `/images/generations` request with
 * `Authorization: Bearer`, sending T2I (no `image` field) and I2I (single
 * string or `string[]` `image` field) through the shared transport, and maps
 * the synchronous `data[]` response into `GenerationResult<ImageContent[]>`.
 */
const SEEDREAM_PROVIDER_ID: ProviderId = "doubao-seedream";
const GENERATIONS_PATH = "/images/generations";

/**
 * Options for constructing a Seedream Provider.
 */
export interface SeedreamProviderOptions {
  /** Injected shared transport; a default transport is created when omitted. */
  readonly transport?: Transport;
}

/**
 * Doubao-Seedream Provider adapter, specialized to `ImageContent[]`.
 */
export interface SeedreamProvider extends ProviderAdapter<ImageContent[]> {
  readonly providerId: ProviderId;
  readonly config: Readonly<SeedreamConfig>;
  readonly transport: Transport;
  /**
   * Create an image model instance bound to a Seedream model id.
   *
   * Literal overloads return family-typed `ImageModelInstance<Seedream*Params>`
   * per model generation so `generateImage`/`editImage` narrow `size` to the
   * model's tier enum literal union and `providerOptions.seedream` to the
   * `SeedreamImageProviderOptions` shape at compile time. The string fallback
   * keeps the default `ImageGenerationInput` shape for dynamic ids.
   */
  image: {
    (
      modelId: "doubao-seedream-5-0-pro-260628"
    ): ImageModelInstance<Seedream5ProParams>;
    (
      modelId: "doubao-seedream-5-0-260128" | "doubao-seedream-5-0-lite-260128"
    ): ImageModelInstance<Seedream5LiteParams>;
    (
      modelId: "doubao-seedream-4-5-251128"
    ): ImageModelInstance<Seedream45Params>;
    (
      modelId: "doubao-seedream-4-0-250828"
    ): ImageModelInstance<Seedream40Params>;
    (modelId: string): ImageModelInstance;
  };
  /** Enumerate the supported models projected from the Seedream registry. */
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
interface SeedreamInputParams {
  readonly prompt: string;
  readonly size?: string;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * Create a Doubao-Seedream Provider from typed configuration.
 *
 * The factory depends only on `@ai-media/sdk`; no Volcengine Ark SDK or other
 * external Provider runtime dependency is introduced. When no transport is
 * supplied a default shared transport is created so the adapter never calls
 * global `fetch` directly.
 */
export function createSeedreamProvider(
  config: SeedreamConfig,
  options?: SeedreamProviderOptions
): SeedreamProvider {
  const transport = options?.transport ?? createTransport();

  const provider: SeedreamProvider = {
    providerId: SEEDREAM_PROVIDER_ID,
    config,
    transport,

    image: (modelId: string): ImageModelInstance => {
      const entry = SEEDREAM_MODEL_REGISTRY[modelId];
      if (!entry) {
        throw new SdkError({
          code: "UNKNOWN_MODEL",
          message: `Unknown Seedream model id "${modelId}"`,
        });
      }
      return {
        providerId: SEEDREAM_PROVIDER_ID,
        modelId,
        adapter: provider,
        capabilities: entry.capabilities,
      };
    },

    listModels: (): readonly SupportedModel[] => seedreamModelRegistry.models,

    async generate(
      request: AdapterRequest
    ): Promise<GenerationResult<ImageContent[]>> {
      requireRegistryEntry(request.model);
      if (!isImageGenerationInput(request.input)) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message:
            "Seedream adapter received a malformed image generation input",
        });
      }

      const input = request.input;
      const body = buildRequestBody(input, request.model);
      return sendSeedreamRequest(transport, config, body, request.model);
    },

    async edit(
      request: AdapterRequest
    ): Promise<GenerationResult<ImageContent[]>> {
      requireRegistryEntry(request.model);
      if (!isImageEditInput(request.input)) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: "Seedream adapter received a malformed image edit input",
        });
      }

      const input = request.input;
      const imageField = mapImageInput(input.images);
      const body = {
        ...buildRequestBody(input, request.model),
        image: imageField,
      };
      return sendSeedreamRequest(transport, config, body, request.model);
    },
  };

  return provider;
}

function requireRegistryEntry(modelId: string): SeedreamModelEntry {
  const entry = SEEDREAM_MODEL_REGISTRY[modelId];
  if (!entry) {
    throw new SdkError({
      code: "UNKNOWN_MODEL",
      message: `Unknown Seedream model id "${modelId}"`,
    });
  }
  return entry;
}

function buildRequestBody(
  input: SeedreamInputParams,
  modelId: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: modelId,
    prompt: input.prompt,
  };
  if (input.size !== undefined) body.size = input.size;

  const seedream = readSeedreamOptions(input.providerOptions);
  if (seedream.response_format !== undefined) {
    body.response_format = seedream.response_format;
  }
  if (seedream.output_format !== undefined) {
    body.output_format = seedream.output_format;
  }
  if (seedream.watermark !== undefined) body.watermark = seedream.watermark;
  if (seedream.optimize_prompt_options !== undefined) {
    body.optimize_prompt_options = seedream.optimize_prompt_options;
  }
  return body;
}

function readSeedreamOptions(
  providerOptions?: Readonly<Record<string, unknown>>
): SeedreamImageProviderOptions {
  const raw = providerOptions?.seedream;
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

function buildUrl(config: SeedreamConfig): string {
  return `${resolveBaseUrl(config)}${GENERATIONS_PATH}`;
}

async function sendSeedreamRequest(
  transport: Transport,
  config: SeedreamConfig,
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

  return mapSeedreamResponse(response.data, SEEDREAM_PROVIDER_ID, modelId);
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

function mapSeedreamResponse(
  data: ArkImageResponse | undefined,
  providerId: ProviderId,
  model: string
): GenerationResult<ImageContent[]> {
  const items = data?.data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Seedream returned no image data in the response",
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
