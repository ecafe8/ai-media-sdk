import type { ModelCapability, ModelId, ModelRegistry, SupportedModel } from "@ai-media/sdk";

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
 * `firstFrame` input (t2v models set it false/undefined). `requiresInputVideo`
 * marks video-edit models that need a public `inputVideo` URL.
 * `maxReferenceImages` caps the ordered `referenceImages` array for r2v/
 * video-edit models. `supportedResolutions`/`supportedAspectRatios` declare
 * the per-model allowed value lists for the Aliyun-native `resolution`/
 * `ratio` parameters carried under `providerOptions.aliyun`; an empty
 * `supportedAspectRatios` array means the model takes no `ratio` parameter
 * (i2v auto-follows the first frame; video-edit has no ratio field).
 */
export interface AliyunModelEntry {
  readonly family: AliyunModelFamily;
  readonly capabilities: ModelCapability;
  readonly paramSupport: AliyunParamSupport;
  readonly requiresFirstFrame?: boolean;
  readonly requiresInputVideo?: boolean;
  readonly maxReferenceImages?: number;
  readonly supportedResolutions?: readonly string[];
  readonly supportedAspectRatios?: readonly string[];
}

const QWEN_T2I_I2I_CAPABILITY: ModelCapability = {
  modality: "image",
  generate: true,
  edit: true,
  maxEditImages: 3,
  maxResolution: { width: 2048, height: 2048 },
  maxN: 6,
};

const WAN_PRO_GENERATE_CAPABILITY: ModelCapability = {
  modality: "image",
  generate: true,
  edit: false,
  async: true,
  maxResolution: { width: 4096, height: 4096 },
  maxN: 4,
};

const WAN_GENERATE_CAPABILITY: ModelCapability = {
  modality: "image",
  generate: true,
  edit: false,
  async: true,
  maxResolution: { width: 2048, height: 2048 },
  maxN: 4,
};

/**
 * Aspect ratios accepted by HappyHorse t2v/r2v models per the live DashScope
 * contract. i2v omits `ratio` (auto-follows the first frame); video-edit has
 * no `ratio` parameter at all.
 */
const HAPPYHORSE_RATIOS: readonly string[] = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
  "9:21",
  "21:9",
];

const HAPPYHORSE_RESOLUTIONS: readonly string[] = [
  "480P",
  "720P",
  "1080P",
];

const HAPPYHORSE_VIDEO_EDIT_RESOLUTIONS: readonly string[] = [
  "720P",
  "1080P",
];

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
    capabilities: WAN_PRO_GENERATE_CAPABILITY,
    paramSupport: { n: true, size: true },
  },
  "wan2.7-image": {
    family: "wan-image",
    capabilities: WAN_GENERATE_CAPABILITY,
    paramSupport: { n: true, size: true },
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
    supportedResolutions: HAPPYHORSE_RESOLUTIONS,
    supportedAspectRatios: HAPPYHORSE_RATIOS,
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
    supportedResolutions: HAPPYHORSE_RESOLUTIONS,
    supportedAspectRatios: [],
  },
  "happyhorse-1.1-r2v": {
    family: "happyhorse-video",
    capabilities: {
      modality: "video",
      generate: true,
      edit: false,
      async: true,
    },
    paramSupport: {},
    maxReferenceImages: 9,
    supportedResolutions: HAPPYHORSE_RESOLUTIONS,
    supportedAspectRatios: HAPPYHORSE_RATIOS,
  },
  "happyhorse-1.0-video-edit": {
    family: "happyhorse-video",
    capabilities: {
      modality: "video",
      generate: true,
      edit: false,
      async: true,
    },
    paramSupport: {},
    requiresInputVideo: true,
    maxReferenceImages: 5,
    supportedResolutions: HAPPYHORSE_VIDEO_EDIT_RESOLUTIONS,
    supportedAspectRatios: [],
  },
};

const ALIYUN_PROVIDER_ID: ModelRegistry["providerId"] = "aliyun-bailian";

/**
 * Common projection of the Aliyun registry for modality-neutral aggregation.
 *
 * Derived programmatically from `ALIYUN_MODEL_REGISTRY` so it cannot drift.
 * Provider-specific fields (`family`, `paramSupport`, `requiresFirstFrame`,
 * `maxReferenceImages`) are intentionally omitted; consumers needing them
 * import `ALIYUN_MODEL_REGISTRY` directly.
 */
export const aliyunModelRegistry: ModelRegistry = {
  providerId: ALIYUN_PROVIDER_ID,
  models: Object.entries(ALIYUN_MODEL_REGISTRY).map(
    ([id, entry]): SupportedModel => ({
      providerId: ALIYUN_PROVIDER_ID,
      id,
      modality: entry.capabilities.modality,
      capabilities: entry.capabilities,
    })
  ),
};
