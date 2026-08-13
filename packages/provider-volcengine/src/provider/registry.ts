import type {
  ModelCapability,
  ModelId,
  ModelRegistry,
  SupportedModel,
} from "@ai-media/sdk";

/**
 * In-package model capability registry for Volcengine Ark.
 *
 * Each entry binds a model id to its capabilities, supported parameters, and
 * accepted output formats. `provider.image(modelId)` looks up the registry to
 * build a bound model instance. All four registered Doubao-Seedream models are
 * served by the synchronous Volcengine Ark `/images/generations` endpoint.
 */

/**
 * Supported public parameters per model (drives what the adapter forwards).
 */
export interface VolcengineParamSupport {
  readonly size?: boolean;
}

/**
 * Accepted output file formats for a model.
 */
export type VolcengineOutputFormat = "png" | "jpeg";

/**
 * A registry entry for a single Volcengine Ark model id.
 */
export interface VolcengineModelEntry {
  readonly capabilities: ModelCapability;
  readonly paramSupport: VolcengineParamSupport;
  readonly outputFormats: readonly VolcengineOutputFormat[];
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

const PARAM_SUPPORT_SIZE: VolcengineParamSupport = { size: true };

/**
 * The model registry. Aliases (`doubao-seedream-5-0-lite-260128`) map to the
 * same entry as their canonical id. All models run the synchronous Ark
 * `/images/generations` path. `supportedSizes` declares the closed tier enum
 * per model; `maxResolution` declares the pixel-size upper bound so callers
 * may also pass `WxH` values within the cap (the Ark API accepts either form).
 */
export const VOLCENGINE_MODEL_REGISTRY: Readonly<
  Record<ModelId, VolcengineModelEntry>
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

const VOLCENGINE_PROVIDER_ID: ModelRegistry["providerId"] = "volcengine";

/**
 * Common projection of the Volcengine Ark registry for modality-neutral
 * aggregation.
 *
 * Derived programmatically from `VOLCENGINE_MODEL_REGISTRY` so it cannot
 * drift. Provider-specific fields (`paramSupport`, `outputFormats`) are
 * intentionally omitted; consumers needing them import
 * `VOLCENGINE_MODEL_REGISTRY` directly.
 */
export const volcengineModelRegistry: ModelRegistry = {
  providerId: VOLCENGINE_PROVIDER_ID,
  models: Object.entries(VOLCENGINE_MODEL_REGISTRY).map(
    ([id, entry]): SupportedModel => ({
      providerId: VOLCENGINE_PROVIDER_ID,
      id,
      modality: entry.capabilities.modality,
      capabilities: entry.capabilities,
    })
  ),
};
