import type { ModelCapability, ModelId } from "@ai-media/sdk";

/**
 * In-package model capability registry for Aliyun Bailian.
 *
 * Each entry binds a model id to its endpoint family, capabilities, supported
 * public parameters, and edit-image limits. `provider.image(modelId)` looks up
 * the registry to build a bound model instance; the adapter switches on
 * `family` to route Qwen (sync `multimodal-generation`) vs Wan (async
 * `image-generation`).
 */

/**
 * The endpoint family a model targets.
 */
export type AliyunModelFamily =
  "qwen-multimodal" | "wan-image" | "happyhorse-video";

/**
 * Supported public parameters per model (drives what the adapter forwards).
 */
export interface AliyunParamSupport {
  readonly n?: boolean;
  readonly size?: boolean;
}

/**
 * A registry entry for a single model id.
 *
 * `requiresFirstFrame` marks first-frame i2v video models that need a
 * `firstFrame` input (t2v models set it false/undefined).
 */
export interface AliyunModelEntry {
  readonly family: AliyunModelFamily;
  readonly capabilities: ModelCapability;
  readonly paramSupport: AliyunParamSupport;
  readonly requiresFirstFrame?: boolean;
}

const QWEN_T2I_I2I_CAPABILITY: ModelCapability = {
  modality: "image",
  generate: true,
  edit: true,
  maxEditImages: 3,
};

const WAN_GENERATE_CAPABILITY: ModelCapability = {
  modality: "image",
  generate: true,
  edit: false,
  async: true,
};

/**
 * The model registry. Qwen models run the synchronous `multimodal-generation`
 * path now; Wan models use the async `image-generation` path through submit.
 * Their synchronous generate/edit paths remain `NOT_IMPLEMENTED`.
 */
export const ALIYUN_MODEL_REGISTRY: Readonly<
  Record<ModelId, AliyunModelEntry>
> = {
  "qwen-image-3.0-pro": {
    family: "qwen-multimodal",
    capabilities: QWEN_T2I_I2I_CAPABILITY,
    paramSupport: { n: true, size: true },
  },
  "qwen-image-2.0-pro": {
    family: "qwen-multimodal",
    capabilities: QWEN_T2I_I2I_CAPABILITY,
    paramSupport: { n: true, size: true },
  },
  "qwen-image-2.0-pro-2026-06-22": {
    family: "qwen-multimodal",
    capabilities: QWEN_T2I_I2I_CAPABILITY,
    paramSupport: { n: true, size: true },
  },
  "qwen-image-2.0": {
    family: "qwen-multimodal",
    capabilities: QWEN_T2I_I2I_CAPABILITY,
    paramSupport: { n: true, size: true },
  },
  "wan2.7-image-pro": {
    family: "wan-image",
    capabilities: WAN_GENERATE_CAPABILITY,
    paramSupport: { n: true, size: true },
  },
  "wan2.7-image": {
    family: "wan-image",
    capabilities: WAN_GENERATE_CAPABILITY,
    paramSupport: { n: true, size: true },
  },
  "z-image-turbo": {
    family: "wan-image",
    capabilities: {
      modality: "image",
      generate: true,
      edit: false,
    },
    paramSupport: { size: true },
  },
  "happyhorse-1.1-t2v": {
    family: "happyhorse-video",
    capabilities: {
      modality: "video",
      generate: true,
      edit: false,
      async: true,
    },
    paramSupport: {},
    requiresFirstFrame: false,
  },
  "happyhorse-1.1-i2v": {
    family: "happyhorse-video",
    capabilities: {
      modality: "video",
      generate: true,
      edit: false,
      async: true,
    },
    paramSupport: {},
    requiresFirstFrame: true,
  },
};
