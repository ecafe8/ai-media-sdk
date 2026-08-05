import {
  SdkError,
  classifyHttpError,
  createTransport,
  isImageGenerationInput,
  notImplemented,
  TransportError,
  type AdapterRequest,
  type GenerationResult,
  type ImageContent,
  type ImageModelInstance,
  type ModelCapability,
  type ModelId,
  type ProviderAdapter,
  type ProviderId,
  type SupportedModel,
  type Transport,
} from "@ai-media/sdk";

import type { AzureOpenAIConfig } from "../config/index.ts";
import type { AzureImageProviderOptions } from "./options.ts";
import type { AzureGptImage2Params } from "./params.ts";
import {
  AZURE_MODEL_REGISTRY,
  DEFAULT_AZURE_CUSTOM_CAPABILITY,
  azureModelRegistry,
  type AzureModelEntry,
} from "./registry.ts";

/**
 * Azure OpenAI Provider factory, model instance, and adapter.
 *
 * The adapter builds the Azure image generations request, authenticates with
 * `Authorization: Bearer {apiKey}`, sends it through the shared transport, and
 * maps the synchronous `data[]` response into `GenerationResult<ImageContent[]>`.
 * Aliyun remains out of scope here; `editImage` stays `NOT_IMPLEMENTED`.
 */

const AZURE_PROVIDER_ID: ProviderId = "azure-openai";

/**
 * Options for constructing an Azure OpenAI Provider.
 */
export interface AzureOpenAIProviderOptions {
  /** Injected shared transport; a default transport is created when omitted. */
  readonly transport?: Transport;
}

/**
 * Azure OpenAI Provider adapter, specialized to `ImageContent[]`.
 */
export interface AzureOpenAIProvider extends ProviderAdapter<ImageContent[]> {
  readonly providerId: ProviderId;
  readonly config: Readonly<AzureOpenAIConfig>;
  readonly transport: Transport;
  /**
   * Create an image model instance bound to an Azure deployment.
   *
   * Literal overloads return a typed `ImageModelInstance<AzureGptImage2Params>`
   * for known deployments so `generateImage`/`submitImageTask` narrow `size`
   * to the documented Azure values and `providerOptions.azure` to the
   * `AzureImageProviderOptions` shape at compile time. The string fallback
   * keeps the default `ImageGenerationInput` shape for custom deployments
   * registered via `createAzureModel`.
   */
  image: {
    (deployment: "gpt-image-2"): ImageModelInstance<AzureGptImage2Params>;
    (deployment: string): ImageModelInstance;
  },
  /**
   * Register a custom deployment and bind an image model instance. Bypasses
   * the known-deployment whitelist; the registered entry is visible to
   * subsequent `image()`/`generate()` lookups on this instance.
   */
  createModel: (
    deployment: string,
    capabilities?: ModelCapability
  ) => ImageModelInstance;
  /** Enumerate the supported models projected from the Azure registry. */
  listModels: () => readonly SupportedModel[];
}

interface AzureImageItem {
  readonly url?: string;
  readonly b64_json?: string;
}

interface AzureImageResponse {
  readonly created?: number;
  readonly data?: AzureImageItem[];
  readonly error?: { readonly message?: string };
}

/**
 * Create an Azure OpenAI Provider from typed configuration.
 *
 * The factory depends only on `@ai-media/sdk`; no `openai` SDK or other
 * external Provider runtime dependency is introduced. When no transport is
 * supplied a default shared transport is created so the adapter never calls
 * global `fetch` directly.
 */
export function createAzureOpenAIProvider(
  config: AzureOpenAIConfig,
  options?: AzureOpenAIProviderOptions
): AzureOpenAIProvider {
  const transport = options?.transport ?? createTransport();

  // Per-instance runtime registry seeded from the static known-deployment
  // whitelist. `createAzureModel` writes custom deployments here so the
  // defensive re-check inside `generate()` recognizes them.
  const runtimeRegistry = new Map<ModelId, AzureModelEntry>(
    Object.entries(AZURE_MODEL_REGISTRY).map(([id, entry]) => [id, entry])
  );

  function requireAzureRegistryEntry(deployment: string): AzureModelEntry {
    const entry = runtimeRegistry.get(deployment);
    if (!entry) {
      throw new SdkError({
        code: "UNKNOWN_MODEL",
        message: `Unknown Azure deployment "${deployment}". Use createAzureModel() to register a custom deployment.`,
      });
    }
    return entry;
  }

  const provider: AzureOpenAIProvider = {
    providerId: AZURE_PROVIDER_ID,
    config,
    transport,

    image: (deployment: string): ImageModelInstance => {
      const entry = requireAzureRegistryEntry(deployment);
      return {
        providerId: AZURE_PROVIDER_ID,
        modelId: deployment,
        adapter: provider,
        capabilities: entry.capabilities,
      };
    },

    createModel: (
      deployment: string,
      capabilities?: ModelCapability
    ): ImageModelInstance => {
      const resolvedCapabilities = capabilities ?? DEFAULT_AZURE_CUSTOM_CAPABILITY;
      runtimeRegistry.set(deployment, { capabilities: resolvedCapabilities });
      return {
        providerId: AZURE_PROVIDER_ID,
        modelId: deployment,
        adapter: provider,
        capabilities: resolvedCapabilities,
      };
    },

    listModels: (): readonly SupportedModel[] => azureModelRegistry.models,

    async generate(
      request: AdapterRequest
    ): Promise<GenerationResult<ImageContent[]>> {
      requireAzureRegistryEntry(request.model);
      if (!isImageGenerationInput(request.input)) {
        throw new SdkError({
          code: "INVALID_REQUEST",
          message: "Azure adapter received a malformed image generation input",
        });
      }

      const input = request.input;
      const deployment = request.model;
      const azureOptions = readAzureOptions(input.providerOptions);

      const url = buildGenerationsUrl(
        config.endpoint,
        deployment,
        config.apiVersion
      );
      const headers: Record<string, string> = {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      };
      const body = buildRequestBody(input, azureOptions);

      let response;
      try {
        response = await transport.send<AzureImageResponse>({
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
          extractErrorMessage(response.data)
        );
      }

      return mapAzureResponse(response.data, AZURE_PROVIDER_ID, deployment);
    },

    async edit(): Promise<GenerationResult<ImageContent[]>> {
      throw notImplemented("azure-openai.editImage");
    },
  };

  return provider;
}

/**
 * Register a custom Azure deployment on a provider instance and return a bound
 * image model instance. Bypasses the known-deployment whitelist; the entry is
 * visible to subsequent `image()`/`generate()` lookups on that instance.
 *
 * Thin wrapper over `provider.createModel(deployment, capabilities?)` so the
 * escape hatch is also available as a package-level export.
 */
export function createAzureModel(
  provider: AzureOpenAIProvider,
  deployment: string,
  capabilities?: ModelCapability
): ImageModelInstance {
  return provider.createModel(deployment, capabilities);
}

function buildGenerationsUrl(
  endpoint: string,
  deployment: string,
  apiVersion: string
): string {
  const base = endpoint.replace(/\/+$/, "");
  return `${base}/openai/deployments/${encodeURIComponent(deployment)}/images/generations?api-version=${encodeURIComponent(apiVersion)}`;
}

function buildRequestBody(
  input: {
    readonly prompt: string;
    readonly n?: number;
    readonly size?: string;
  },
  azure: AzureImageProviderOptions
): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt: input.prompt };
  if (input.n !== undefined) body.n = input.n;
  if (input.size !== undefined) body.size = input.size;
  if (azure.quality !== undefined) body.quality = azure.quality;
  if (azure.output_format !== undefined)
    body.output_format = azure.output_format;
  if (azure.output_compression !== undefined) {
    body.output_compression = azure.output_compression;
  }
  return body;
}

function readAzureOptions(
  providerOptions?: Readonly<Record<string, unknown>>
): AzureImageProviderOptions {
  const raw = providerOptions?.azure;
  if (typeof raw !== "object" || raw === null) return {};
  const candidate = raw as Record<string, unknown>;
  const options: {
    quality?: string;
    output_format?: string;
    output_compression?: number;
  } = {};
  if (typeof candidate.quality === "string")
    options.quality = candidate.quality;
  if (typeof candidate.output_format === "string") {
    options.output_format = candidate.output_format;
  }
  if (typeof candidate.output_compression === "number") {
    options.output_compression = candidate.output_compression;
  }
  return options;
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
  data: AzureImageResponse | undefined
): string | undefined {
  const message = data?.error?.message;
  if (typeof message === "string" && message.length > 0) {
    return redactSecrets(message);
  }
  return undefined;
}

function redactSecrets(text: string): string {
  return text;
}

function mapAzureResponse(
  data: AzureImageResponse | undefined,
  providerId: ProviderId,
  model: string
): GenerationResult<ImageContent[]> {
  const items = data?.data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new SdkError({
      code: "PROVIDER_ERROR",
      message: "Azure returned no image data in the response",
    });
  }

  const content: ImageContent[] = items.map((item) => ({
    url: item.url,
    base64: item.b64_json,
  }));

  return {
    content,
    provider: providerId,
    model,
    createdAt:
      typeof data?.created === "number"
        ? new Date(data.created * 1000).toISOString()
        : undefined,
  };
}
