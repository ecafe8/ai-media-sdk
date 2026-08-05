import type { ModelCapability, ModelId, ModelRegistry, SupportedModel } from "@ai-media/sdk";

/**
 * In-package model capability registry for Doubao-Seedream.
 *
 * Each entry binds a model id to its capabilities, supported parameters, and
 * accepted output formats. `provider.image(modelId)` looks up the registry to
 * build a bound model instance. All four registered models are served by the
 * synchronous Volcengine Ark `/images/generations` endpoint.
 */

/**
 * Supported public parameters per model (drives what the adapter forwards).
 */
export interface SeedreamParamSupport {
  readonly size?: boolean;
}

/**
 * Accepted output file formats for a model.
 */
export type SeedreamOutputFormat = "png" | "jpeg";

/**
 * A registry entry for a single Seedream model id.
 */
export interface SeedreamModelEntry {
  readonly capabilities: ModelCapability;
  readonly paramSupport: SeedreamParamSupport;
  readonly outputFormats: readonly SeedreamOutputFormat[];
}

/**
 * Capabilities shared by all four Seedream models: image T2I and I2I (edit).
 * `maxEditImages` is 10 for the 5.0 pro model and 14 for the others.
 * `maxN` is `1` because the synchronous Ark API returns a single image per
 * call (no `n` parameter in the documented request body).
 */
const makeCapability = (maxEditImages: number): ModelCapability => ({
  modality: "image",
  generate: true,
  edit: true,
  maxEditImages,
  maxN: 1,
});

const PRO_CAPABILITY = makeCapability(10);
const LITE_CAPABILITY = makeCapability(14);

const PARAM_SUPPORT_SIZE: SeedreamParamSupport = { size: true };

/**
 * The model registry. Aliases (`doubao-seedream-5-0-lite-260128`) map to the
 * same entry as their canonical id. All models run the synchronous Ark
 * `/images/generations` path. `supportedSizes` declares the closed tier enum
 * per model; `maxResolution` declares the pixel-size upper bound so callers
 * may also pass `WxH` values within the cap (the Ark API accepts either form).
 */
export const SEEDREAM_MODEL_REGISTRY: Readonly<
  Record<ModelId, SeedreamModelEntry>
> = {
  "doubao-seedream-5-0-pro-260628": {
    capabilities: {
      ...PRO_CAPABILITY,
      supportedSizes: ["1K", "2K"],
      maxResolution: { width: 2048, height: 2048 },
    },
    paramSupport: PARAM_SUPPORT_SIZE,
    outputFormats: ["png", "jpeg"],
  },
  "doubao-seedream-5-0-260128": {
    capabilities: {
      ...LITE_CAPABILITY,
      supportedSizes: ["2K", "3K", "4K"],
      maxResolution: { width: 4096, height: 4096 },
    },
    paramSupport: PARAM_SUPPORT_SIZE,
    outputFormats: ["png", "jpeg"],
  },
  "doubao-seedream-5-0-lite-260128": {
    capabilities: {
      ...LITE_CAPABILITY,
      supportedSizes: ["2K", "3K", "4K"],
      maxResolution: { width: 4096, height: 4096 },
    },
    paramSupport: PARAM_SUPPORT_SIZE,
    outputFormats: ["png", "jpeg"],
  },
  "doubao-seedream-4-5-251128": {
    capabilities: {
      ...LITE_CAPABILITY,
      supportedSizes: ["2K", "4K"],
      maxResolution: { width: 4096, height: 4096 },
    },
    paramSupport: PARAM_SUPPORT_SIZE,
    outputFormats: ["jpeg"],
  },
  "doubao-seedream-4-0-250828": {
    capabilities: {
      ...LITE_CAPABILITY,
      supportedSizes: ["1K", "2K", "4K"],
      maxResolution: { width: 4096, height: 4096 },
    },
    paramSupport: PARAM_SUPPORT_SIZE,
    outputFormats: ["jpeg"],
  },
};

const SEEDREAM_PROVIDER_ID: ModelRegistry["providerId"] = "doubao-seedream";

/**
 * Common projection of the Seedream registry for modality-neutral aggregation.
 *
 * Derived programmatically from `SEEDREAM_MODEL_REGISTRY` so it cannot drift.
 * Provider-specific fields (`paramSupport`, `outputFormats`) are intentionally
 * omitted; consumers needing them import `SEEDREAM_MODEL_REGISTRY` directly.
 */
export const seedreamModelRegistry: ModelRegistry = {
  providerId: SEEDREAM_PROVIDER_ID,
  models: Object.entries(SEEDREAM_MODEL_REGISTRY).map(
    ([id, entry]): SupportedModel => ({
      providerId: SEEDREAM_PROVIDER_ID,
      id,
      modality: entry.capabilities.modality,
      capabilities: entry.capabilities,
    })
  ),
};
