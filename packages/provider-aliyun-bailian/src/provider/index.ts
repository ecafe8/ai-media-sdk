import {
  notImplemented,
  type AdapterRequest,
  type GenerationResult,
  type ImageContent,
  type ProviderAdapter,
  type ProviderId,
  type Transport,
} from "@ai-media/sdk";

import type { AliyunBailianConfig } from "../config/index.js";

/**
 * Alibaba Cloud Bailian Provider factory and adapter boundary.
 *
 * Phase 0 exposes the typed factory/model boundary only. Adapter methods are
 * explicit `NOT_IMPLEMENTED` stubs; the injected transport is retained but
 * never invoked, so no network call occurs. The Wan/Qwen package split is a
 * Phase 1 contract-probe outcome and remains replaceable.
 */

const ALIYUN_PROVIDER_ID: ProviderId = "aliyun-bailian";

/**
 * Options for constructing an Alibaba Bailian Provider.
 */
export interface AliyunBailianProviderOptions {
  /** Injected shared transport; retained for future requests. */
  readonly transport?: Transport;
}

/**
 * Alibaba Bailian Provider adapter, specialized to `ImageContent`.
 */
export interface AliyunBailianProvider extends ProviderAdapter<ImageContent> {
  readonly providerId: ProviderId;
  readonly config: Readonly<AliyunBailianConfig>;
  readonly transport?: Transport;
}

/**
 * Create an Alibaba Cloud Bailian Provider from typed configuration.
 *
 * The factory depends only on `@ai-media/sdk`; no DashScope or other external
 * Provider runtime dependency is introduced.
 */
export function createAliyunBailianProvider(
  config: AliyunBailianConfig,
  options?: AliyunBailianProviderOptions
): AliyunBailianProvider {
  const transport = options?.transport;

  return {
    providerId: ALIYUN_PROVIDER_ID,
    config,
    transport,
    async generate(
      _request: AdapterRequest
    ): Promise<GenerationResult<ImageContent>> {
      throw notImplemented("aliyun-bailian.generateImage");
    },
    async edit(
      _request: AdapterRequest
    ): Promise<GenerationResult<ImageContent>> {
      throw notImplemented("aliyun-bailian.editImage");
    },
  };
}
