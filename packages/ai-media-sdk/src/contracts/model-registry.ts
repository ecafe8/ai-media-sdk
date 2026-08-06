import type { ModelCapability } from "./capabilities.ts";
import type { ModelId, ProviderId } from "./provider-identity.ts";

/**
 * Model-registry aggregation contracts.
 *
 * The core stays free of any Provider-specific model list. Each Provider
 * projects its in-package registry into the common `SupportedModel` shape and
 * exposes it both as a `ModelRegistry` const and via a `listModels()` instance
 * method. Consumers aggregate multiple providers through
 * `collectSupportedModels` and query with `findSupportedModel`/
 * `isSupportedModel`.
 */

/**
 * Common projection of a model offered by a Provider.
 *
 * `label` is optional display text; Provider-specific fields (endpoint family,
 * parameter support, first-frame requirements, etc.) are intentionally absent
 * and remain on each Provider's full in-package registry entry.
 */
export interface SupportedModel {
  readonly providerId: ProviderId;
  readonly id: ModelId;
  readonly label?: string;
  readonly modality: "image" | "video" | "audio";
  readonly capabilities: ModelCapability;
}

/**
 * A Provider's supported-model list as a static const.
 *
 * Providers export a `*ModelRegistry` const of this shape for consumers that
 * aggregate without constructing a Provider instance.
 */
export interface ModelRegistry {
  readonly providerId: ProviderId;
  readonly models: readonly SupportedModel[];
}

/**
 * A Provider instance that can enumerate its own supported models.
 *
 * Provider factory interfaces implement this so callers can introspect a
 * configured instance at runtime. `collectSupportedModels` accepts both
 * `ModelRegistry` consts and `ModelListable` instances.
 */
export interface ModelListable {
  readonly providerId: ProviderId;
  listModels(): readonly SupportedModel[];
}

/**
 * Aggregate source: either a static `ModelRegistry` const or a runtime
 * `ModelListable` Provider instance.
 */
export type ModelRegistrySource = ModelRegistry | ModelListable;

function isModelListable(source: ModelRegistrySource): source is ModelListable {
  return (
    typeof source === "object" &&
    source !== null &&
    "listModels" in source &&
    typeof (source as ModelListable).listModels === "function"
  );
}

/**
 * Collect a flat `SupportedModel[]` from any mix of `ModelRegistry` consts and
 * `ModelListable` Provider instances, preserving source order. When the same
 * `(providerId, id)` pair appears more than once, only the first occurrence is
 * kept. Does not perform network access.
 */
export function collectSupportedModels(
  ...sources: ReadonlyArray<ModelRegistrySource>
): readonly SupportedModel[] {
  const seen = new Set<string>();
  const out: SupportedModel[] = [];
  for (const source of sources) {
    const models = isModelListable(source)
      ? source.listModels()
      : source.models;
    for (const model of models) {
      const key = `${model.providerId}:${model.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(model);
    }
  }
  return out;
}

/**
 * Find a `SupportedModel` by `(providerId, modelId)` in an aggregate. Returns
 * `undefined` when the pair is absent. Does not throw and does not perform
 * network access.
 */
export function findSupportedModel(
  models: readonly SupportedModel[],
  providerId: ProviderId,
  modelId: ModelId
): SupportedModel | undefined {
  return models.find(
    (model) => model.providerId === providerId && model.id === modelId
  );
}

/**
 * Return whether a `(providerId, modelId)` pair is present in an aggregate.
 * Does not perform network access.
 */
export function isSupportedModel(
  models: readonly SupportedModel[],
  providerId: ProviderId,
  modelId: ModelId
): boolean {
  return findSupportedModel(models, providerId, modelId) !== undefined;
}
