import type {
  ModelCapability,
  ModelId,
  ModelRegistry,
  SupportedModel,
} from "@ai-media/sdk";

/**
 * In-package model registry for Azure OpenAI.
 *
 * Azure deployment names are user-defined in the Azure Portal, so they cannot
 * be universally enumerated. This registry lists the deployments this project
 * has live-confirmed (`gpt-image-2`, the Serverless Global Standard deployment)
 * so `provider.image(deployment)` can fast-validate known names and supply
 * their capabilities. Custom deployments are registered at runtime via
 * `createAzureModel(provider, deployment, capabilities?)`, which writes into
 * the provider instance's runtime map consulted by `image()`/`generate()`.
 */

/**
 * Capabilities for a known Azure image deployment.
 */
export interface AzureModelEntry {
  readonly capabilities: ModelCapability;
}

const GPT_IMAGE_2_CAPABILITY: ModelCapability = {
  modality: "image",
  generate: true,
  edit: false,
};

/**
 * The static known-deployment whitelist. Live-confirmed deployment is
 * `gpt-image-2` (Serverless Global Standard, API version `2024-02-01`).
 */
export const AZURE_MODEL_REGISTRY: Readonly<Record<ModelId, AzureModelEntry>> = {
  "gpt-image-2": { capabilities: GPT_IMAGE_2_CAPABILITY },
};

const AZURE_PROVIDER_ID: ModelRegistry["providerId"] = "azure-openai";

/**
 * Common projection of the Azure registry for modality-neutral aggregation.
 *
 * Derived programmatically from `AZURE_MODEL_REGISTRY` so it cannot drift.
 * Only the static known deployments are projected; runtime-registered custom
 * deployments are not included (they are per-instance state).
 */
export const azureModelRegistry: ModelRegistry = {
  providerId: AZURE_PROVIDER_ID,
  models: Object.entries(AZURE_MODEL_REGISTRY).map(
    ([id, entry]): SupportedModel => ({
      providerId: AZURE_PROVIDER_ID,
      id,
      modality: entry.capabilities.modality,
      capabilities: entry.capabilities,
    })
  ),
};

/**
 * Default capabilities for a custom deployment registered via
 * `createAzureModel` when the caller does not supply any.
 */
export const DEFAULT_AZURE_CUSTOM_CAPABILITY: ModelCapability = {
  modality: "image",
  generate: true,
  edit: false,
};
