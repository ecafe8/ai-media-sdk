import type {
  ModelCapability,
  ModelId,
  ModelRegistry,
  SupportedModel,
} from "@ai-media/sdk";

/**
 * In-package model capability registry for MiniMax (Hailuo).
 *
 * Each entry binds a model id to its endpoint family, capabilities, and the
 * per-model value allowlists consumed by the adapter's validation. Currently
 * MiniMax exposes a single asynchronous video model (`MiniMax-H3`) that serves
 * text-to-video, first/last-frame image-to-video, and reference-to-video from
 * one multimodal `content[]` input. `provider.video(modelId)` looks up the
 * registry to build a bound model instance.
 */

/**
 * The endpoint family a model targets.
 */
export type MiniMaxModelFamily = "h3-video";

/**
 * A registry entry for a single model id.
 *
 * `supportedResolutions`/`supportedAspectRatios` declare the allowed value
 * lists for the MiniMax-native `resolution`/`ratio` parameters carried under
 * `providerOptions.minimax`. `maxReferenceImages` caps the ordered
 * `referenceImages` array for reference-to-video requests.
 */
export interface MiniMaxModelEntry {
  readonly family: MiniMaxModelFamily;
  readonly capabilities: ModelCapability;
  readonly supportedResolutions: readonly string[];
  readonly supportedAspectRatios: readonly string[];
  readonly maxReferenceImages: number;
  readonly maxReferenceVideos: number;
  readonly maxReferenceAudios: number;
}

/**
 * MiniMax-H3 video capability: asynchronous video generation supporting
 * text-to-video, first/last-frame image-to-video, and reference-to-video.
 */
const MINIMAX_H3_VIDEO_CAPABILITY: ModelCapability = {
  modality: "video",
  generate: true,
  edit: false,
  async: true,
};

/**
 * Resolutions accepted by MiniMax-H3 video generation.
 */
const MINIMAX_RESOLUTIONS: readonly string[] = ["768P", "2K"];

/**
 * Aspect ratios accepted by MiniMax-H3 video generation. `adaptive` lets the
 * API auto-recommend a ratio from the input media; text-to-video requires a
 * concrete ratio and rejects `adaptive` (enforced by the adapter).
 */
const MINIMAX_RATIOS: readonly string[] = [
  "adaptive",
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
];

/**
 * The model registry. MiniMax-H3 is the sole entry, routed through the
 * asynchronous V2 video-generation endpoint via submit.
 */
export const MINIMAX_MODEL_REGISTRY: Readonly<
  Record<ModelId, MiniMaxModelEntry>
> = {
  "MiniMax-H3": {
    family: "h3-video",
    capabilities: MINIMAX_H3_VIDEO_CAPABILITY,
    supportedResolutions: MINIMAX_RESOLUTIONS,
    supportedAspectRatios: MINIMAX_RATIOS,
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
  },
};

const MINIMAX_PROVIDER_ID: ModelRegistry["providerId"] = "minimax";

/**
 * Common projection of the MiniMax registry for modality-neutral aggregation.
 *
 * Derived programmatically from `MINIMAX_MODEL_REGISTRY` so it cannot drift.
 * Provider-specific fields (`family`, allowlists, reference caps) are
 * intentionally omitted; consumers needing them import
 * `MINIMAX_MODEL_REGISTRY` directly.
 */
export const minimaxModelRegistry: ModelRegistry = {
  providerId: MINIMAX_PROVIDER_ID,
  models: Object.entries(MINIMAX_MODEL_REGISTRY).map(
    ([id, entry]): SupportedModel => ({
      providerId: MINIMAX_PROVIDER_ID,
      id,
      modality: entry.capabilities.modality,
      capabilities: entry.capabilities,
    })
  ),
};
