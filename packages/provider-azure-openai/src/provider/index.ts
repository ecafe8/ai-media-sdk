import {
  notImplemented,
  type AdapterRequest,
  type GenerationResult,
  type ImageContent,
  type ProviderAdapter,
  type ProviderId,
  type Transport,
} from "@ai-media/sdk";

import type { AzureOpenAIConfig } from "../config/index.js";

/**
 * Azure OpenAI Provider factory and adapter boundary.
 *
 * Phase 0 exposes the typed factory/model boundary only. Adapter methods are
 * explicit `NOT_IMPLEMENTED` stubs; the injected transport is retained but
 * never invoked, so no network call occurs.
 */

const AZURE_PROVIDER_ID: ProviderId = "azure-openai";

/**
 * Options for constructing an Azure OpenAI Provider.
 */
export interface AzureOpenAIProviderOptions {
  /** Injected shared transport; retained for future requests. */
  readonly transport?: Transport;
}

/**
 * Azure OpenAI Provider adapter, specialized to `ImageContent`.
 */
export interface AzureOpenAIProvider extends ProviderAdapter<ImageContent> {
  readonly providerId: ProviderId;
  readonly config: Readonly<AzureOpenAIConfig>;
  readonly transport?: Transport;
}

/**
 * Create an Azure OpenAI Provider from typed configuration.
 *
 * The factory depends only on `@ai-media/sdk`; no `openai` SDK or other
 * external Provider runtime dependency is introduced.
 */
export function createAzureOpenAIProvider(
  config: AzureOpenAIConfig,
  options?: AzureOpenAIProviderOptions
): AzureOpenAIProvider {
  const transport = options?.transport;

  return {
    providerId: AZURE_PROVIDER_ID,
    config,
    transport,
    async generate(
      _request: AdapterRequest
    ): Promise<GenerationResult<ImageContent>> {
      throw notImplemented("azure-openai.generateImage");
    },
    async edit(
      _request: AdapterRequest
    ): Promise<GenerationResult<ImageContent>> {
      throw notImplemented("azure-openai.editImage");
    },
  };
}
