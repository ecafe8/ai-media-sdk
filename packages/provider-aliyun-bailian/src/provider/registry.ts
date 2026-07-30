import type { ModelCapability, ModelId } from "@ai-media/sdk";

/**
 * In-package model capability registry for Aliyun Bailian.
 *
 * Each entry binds a model id to its endpoint family, capabilities, supported
 * public parameters, and edit-image limits. `provider.image(modelId)` looks up
 * the registry to build a bound model instance; the adapter switches on
 * `family` to route Qwen (sync `multimodal-generation`) vs Wan (async, stub).
 */

/**
 * The endpoint family a model targets.
 */
export type AliyunModelFamily = "qwen-multimodal" | "wan-image";

/**
 * Supported public parameters per model (drives what the adapter forwards).
 */
export interface AliyunParamSupport {
  readonly n?: boolean;
  readonly size?: boolean;
}

/**
 * A registry entry for a single model id.
 */
export interface AliyunModelEntry {
  readonly family: AliyunModelFamily;
  readonly capabilities: ModelCapability;
  readonly paramSupport: AliyunParamSupport;
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
};

/**
 * The model registry. Qwen models run the synchronous `multimodal-generation`
 * path now; Wan models are reserved as `NOT_IMPLEMENTED` stubs pending the
 * Phase 3 async `image-generation` task contract.
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
    capabilities: { modality: "image", generate: true, edit: false },
    paramSupport: { size: true },
  },
};
