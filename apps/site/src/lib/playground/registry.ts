import { ALIYUN_MODEL_REGISTRY } from "@ai-media/provider-aliyun-bailian";
import { AZURE_MODEL_REGISTRY } from "@ai-media/provider-azure-openai";
import { MINIMAX_MODEL_REGISTRY } from "@ai-media/provider-minimax";
import { VOLCENGINE_MODEL_REGISTRY } from "@ai-media/provider-volcengine";

import type { SiteProvider } from "../key-store";
import type { SiteModel, SiteModelFamily } from "./types";

/**
 * Minimal site model projection derived directly from the provider package
 * registries (single source of truth for ids/capabilities). Human labels
 * and recommendations come from a small sidecar map and are
 * language-neutral (English); per-language display text is resolved by the
 * UI from the `models` dictionary section (`lib/model-text`). Wan 3.0 is
 * excluded: its heterogeneous `media[]` inputs are not representable by
 * the current forms (mirrors the `apps/web` exclusion).
 */

const EXCLUDED_MODEL_IDS: ReadonlySet<string> = new Set(["wan3.0-video"]);

const MODEL_LABELS: Readonly<
  Record<string, { readonly label: string; readonly recommendation: string }>
> = {
  "azure-openai:gpt-image-2": {
    label: "GPT Image 2",
    recommendation: "Azure synchronous image generation",
  },
  "aliyun-bailian:qwen-image-3.0-pro": {
    label: "Qwen Image 3.0 Pro",
    recommendation: "High-quality generation and editing",
  },
  "aliyun-bailian:qwen-image-3.0": {
    label: "Qwen Image 3.0",
    recommendation:
      "Standard generation and editing; balanced quality and speed",
  },
  "aliyun-bailian:qwen-image-2.0-pro": {
    label: "Qwen Image 2.0 Pro",
    recommendation: "Balanced generation and editing",
  },
  "aliyun-bailian:qwen-image-2.0-pro-2026-06-22": {
    label: "Qwen Image 2.0 Pro (Free Tier)",
    recommendation: "Qwen Image 2.0 Pro dated model; free quota may apply",
  },
  "aliyun-bailian:qwen-image-2.0": {
    label: "Qwen Image 2.0",
    recommendation: "Qwen Image 2.0 base model",
  },
  "aliyun-bailian:wan2.7-image-pro": {
    label: "Wan 2.7 Image Pro",
    recommendation: "High quality generation",
  },
  "aliyun-bailian:wan2.7-image": {
    label: "Wan 2.7 Image",
    recommendation: "Balanced generation",
  },
  "aliyun-bailian:wan2.6-t2i": {
    label: "Wan 2.6 T2I",
    recommendation: "Async text-to-image; pixel size 1280*1280–1440*1440",
  },
  "aliyun-bailian:happyhorse-1.1-t2v": {
    label: "HappyHorse 1.1 T2V",
    recommendation: "Async text-to-video; 1080P, 3-15 seconds, 24fps MP4",
  },
  "aliyun-bailian:happyhorse-1.1-i2v": {
    label: "HappyHorse 1.1 I2V",
    recommendation:
      "Async first-frame image-to-video; requires a first frame, ratio follows the first frame",
  },
  "aliyun-bailian:happyhorse-1.1-r2v": {
    label: "HappyHorse 1.1 R2V",
    recommendation:
      "1-9 reference images + prompt [Image N] references; reference short side ≥ 400px",
  },
  "aliyun-bailian:happyhorse-1.0-video-edit": {
    label: "HappyHorse 1.0 Video Edit",
    recommendation:
      "1 source video (public URL only) + 0-5 reference images; no ratio/duration, supports audio_setting",
  },
  "volcengine:doubao-seedream-5-0-pro-260628": {
    label: "Doubao Seedream 5.0 Pro",
    recommendation:
      "High-precision generation and interactive editing; multi-image/streaming/web search not supported yet",
  },
  "volcengine:doubao-seedream-5-0-260128": {
    label: "Doubao Seedream 5.0 Lite (260128)",
    recommendation: "Alias of doubao-seedream-5-0-lite-260128",
  },
  "volcengine:doubao-seedream-5-0-lite-260128": {
    label: "Doubao Seedream 5.0 Lite",
    recommendation:
      "Balanced generation and editing; multi-image/streaming/web search not supported yet",
  },
  "volcengine:doubao-seedream-4-5-251128": {
    label: "Doubao Seedream 4.5",
    recommendation: "Generation and editing; jpeg output only",
  },
  "volcengine:doubao-seedream-4-0-250828": {
    label: "Doubao Seedream 4.0",
    recommendation: "Generation and editing; jpeg output only",
  },
  "minimax:MiniMax-H3": {
    label: "MiniMax H3",
    recommendation:
      "t2v / first-&-last-frame i2v / r2v in one model; 2K output, 4-15 seconds; r2v supports image/video/audio references",
  },
};

function labelsFor(
  provider: SiteProvider,
  id: string
): { readonly label: string; readonly recommendation: string } {
  return MODEL_LABELS[`${provider}:${id}`] ?? { label: id, recommendation: "" };
}

function aliyunFamilySlug(
  family: "qwen-multimodal" | "wan-image" | "happyhorse-video" | "wan3-video",
  id: string
): SiteModelFamily | undefined {
  if (family === "wan3-video") return undefined;
  if (family === "wan-image") {
    return id === "wan2.6-t2i" ? "wan-image-2.6" : "wan-image-2.7";
  }
  return family;
}

function volcengineFamilySlug(id: string): SiteModelFamily {
  if (id === "doubao-seedream-5-0-pro-260628") return "doubao-seedream-5-pro";
  if (
    id === "doubao-seedream-5-0-260128" ||
    id === "doubao-seedream-5-0-lite-260128"
  ) {
    return "doubao-seedream-5-lite";
  }
  if (id === "doubao-seedream-4-5-251128") return "doubao-seedream-4-5";
  return "doubao-seedream-4-0";
}

function fromAliyun(
  id: string,
  entry: (typeof ALIYUN_MODEL_REGISTRY)[string]
): SiteModel | undefined {
  const family = aliyunFamilySlug(entry.family, id);
  if (!family) return undefined;
  const caps = entry.capabilities;
  const { label, recommendation } = labelsFor("aliyun-bailian", id);
  return {
    id,
    label,
    provider: "aliyun-bailian",
    modality: caps.modality === "video" ? "video" : "image",
    family,
    supportsGenerate: caps.generate,
    supportsEdit: caps.edit,
    supportsVideo: caps.modality === "video",
    supportsAsync: caps.async === true,
    requiresFirstFrame: entry.requiresFirstFrame,
    requiresInputVideo: entry.requiresInputVideo,
    maxReferenceImages: entry.maxReferenceImages,
    maxEditImages: caps.maxEditImages,
    supportedSizes: caps.supportedSizes,
    maxResolution: caps.maxResolution,
    maxN: caps.maxN,
    supportedResolutions: entry.supportedResolutions,
    supportedAspectRatios: entry.supportedAspectRatios,
    recommendation,
  };
}

function fromVolcengine(
  id: string,
  entry: (typeof VOLCENGINE_MODEL_REGISTRY)[string]
): SiteModel {
  const caps = entry.capabilities;
  const { label, recommendation } = labelsFor("volcengine", id);
  return {
    id,
    label,
    provider: "volcengine",
    modality: caps.modality === "video" ? "video" : "image",
    family: volcengineFamilySlug(id),
    supportsGenerate: caps.generate,
    supportsEdit: caps.edit,
    supportsVideo: false,
    supportsAsync: caps.async === true,
    maxEditImages: caps.maxEditImages,
    supportedSizes: caps.supportedSizes,
    maxResolution: caps.maxResolution,
    maxN: caps.maxN,
    recommendation,
  };
}

function fromAzure(
  id: string,
  entry: (typeof AZURE_MODEL_REGISTRY)[string]
): SiteModel {
  const caps = entry.capabilities;
  const { label, recommendation } = labelsFor("azure-openai", id);
  return {
    id,
    label,
    provider: "azure-openai",
    modality: caps.modality === "video" ? "video" : "image",
    family: "azure-gpt-image",
    supportsGenerate: caps.generate,
    supportsEdit: caps.edit,
    supportsVideo: false,
    supportsAsync: caps.async === true,
    maxEditImages: caps.maxEditImages,
    supportedSizes: caps.supportedSizes,
    maxResolution: caps.maxResolution,
    maxN: caps.maxN,
    recommendation,
  };
}

/**
 * Derive a `SiteModel` from the MiniMax registry entry. MiniMax-H3 is a
 * single model id serving t2v/i2v/r2v, so the projection carries the
 * `videoScenarios` marker that makes the video workbench render a scenario
 * selector, plus the resolution/ratio allowlists and reference media caps.
 */
function fromMinimax(
  id: string,
  entry: (typeof MINIMAX_MODEL_REGISTRY)[string]
): SiteModel {
  const caps = entry.capabilities;
  const { label, recommendation } = labelsFor("minimax", id);
  return {
    id,
    label,
    provider: "minimax",
    modality: caps.modality === "video" ? "video" : "image",
    family: "minimax-h3-video",
    supportsGenerate: caps.generate,
    supportsEdit: caps.edit,
    supportsVideo: caps.modality === "video",
    supportsAsync: caps.async === true,
    maxReferenceImages: entry.maxReferenceImages,
    maxReferenceVideos: entry.maxReferenceVideos,
    maxReferenceAudios: entry.maxReferenceAudios,
    videoScenarios: ["t2v", "i2v", "r2v"],
    supportedResolutions: entry.supportedResolutions,
    supportedAspectRatios: entry.supportedAspectRatios,
    recommendation,
  };
}

export const SITE_MODELS: readonly SiteModel[] = [
  ...Object.entries(AZURE_MODEL_REGISTRY)
    .filter(([id]) => !EXCLUDED_MODEL_IDS.has(id))
    .map(([id, entry]) => fromAzure(id, entry)),
  ...Object.entries(ALIYUN_MODEL_REGISTRY)
    .filter(([id]) => !EXCLUDED_MODEL_IDS.has(id))
    .flatMap(([id, entry]) => {
      const model = fromAliyun(id, entry);
      return model ? [model] : [];
    }),
  ...Object.entries(VOLCENGINE_MODEL_REGISTRY)
    .filter(([id]) => !EXCLUDED_MODEL_IDS.has(id))
    .map(([id, entry]) => fromVolcengine(id, entry)),
  ...Object.entries(MINIMAX_MODEL_REGISTRY)
    .filter(([id]) => !EXCLUDED_MODEL_IDS.has(id))
    .map(([id, entry]) => fromMinimax(id, entry)),
];

export function getSiteModel(
  provider: SiteProvider,
  modelId: string
): SiteModel | undefined {
  return SITE_MODELS.find(
    (candidate) => candidate.provider === provider && candidate.id === modelId
  );
}
