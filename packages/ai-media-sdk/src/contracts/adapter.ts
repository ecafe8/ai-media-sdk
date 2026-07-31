import type { ProviderId, ModelId } from "./provider-identity.ts";
import type { Transport } from "./transport.ts";
import type { GenerationResult, TaskHandle } from "./generation.ts";

/**
 * Provider adapter request/result contracts.
 *
 * Adapters translate modality-neutral `AdapterRequest`s into provider calls
 * through the shared transport and return generic `GenerationResult`s. Phase 0
 * exposes the boundary only; live adapters ship in later phases.
 */

/**
 * The modality a provider request targets.
 */
export type AdapterModality = "image" | "video" | "audio";

/**
 * A provider-agnostic request handed to a Provider adapter.
 */
export interface AdapterRequest {
  readonly provider: ProviderId;
  readonly model: ModelId;
  readonly modality: AdapterModality;
  readonly input: unknown;
}

/**
 * Options handed to a Provider adapter factory.
 *
 * `transport` lets callers inject (and observe) the shared transport; Phase 0
 * adapters retain it without invoking it.
 */
export interface AdapterOptions {
  readonly transport?: Transport;
}

/**
 * The contract every Provider adapter implements.
 *
 * `submit` is optional: only async-capable Providers implement it. `submitTask`
 * rejects models bound to an adapter that omits `submit`.
 */
export interface ProviderAdapter<TContent = unknown> {
  readonly providerId: ProviderId;
  generate(request: AdapterRequest): Promise<GenerationResult<TContent>>;
  edit(request: AdapterRequest): Promise<GenerationResult<TContent>>;
  submit?(request: AdapterRequest): Promise<TaskHandle<TContent>>;
}
