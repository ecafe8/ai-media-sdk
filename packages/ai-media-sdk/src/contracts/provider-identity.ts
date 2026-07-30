/**
 * Provider and model identity contracts.
 *
 * These string-branded identifiers keep provider and model references stable
 * across the modality-neutral core. They are intentionally simple in Phase 0;
 * concrete provider/model registries arrive in later phases.
 */

/**
 * Stable identifier for a Provider adapter (e.g. `"azure-openai"`).
 */
export type ProviderId = string;

/**
 * Stable identifier for a model (e.g. `"dall-e-3"`).
 */
export type ModelId = string;

/**
 * Descriptive metadata for a Provider adapter.
 */
export interface ProviderInfo {
  readonly id: ProviderId;
  readonly name: string;
}

/**
 * Descriptive metadata for a single model offered by a Provider.
 */
export interface ModelInfo {
  readonly id: ModelId;
  readonly providerId: ProviderId;
  readonly name: string;
}
