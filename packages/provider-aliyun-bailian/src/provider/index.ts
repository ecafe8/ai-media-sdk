import {
  SdkError,
  classifyHttpError,
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
  type Transport,
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

/**
 * Options for constructing an Aliyun Bailian Provider.
 */
export interface AliyunBailianProviderOptions {
  /** Injected shared transport; a default transport is created when omitted. */
  readonly transport?: Transport;
}

/**
 * Aliyun Bailian Provider adapter, specialized to `ImageContent[]`.
 */
export interface AliyunBailianProvider extends ProviderAdapter<ImageContent[]> {
  readonly providerId: ProviderId;
  readonly config: Readonly<AliyunBailianConfig>;
  readonly transport: Transport;
  /** Create an image model instance bound to an Aliyun model id. */
  image: (modelId: string) => ImageModelInstance;
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
