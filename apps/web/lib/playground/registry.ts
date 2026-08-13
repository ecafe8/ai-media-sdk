import { ALIYUN_MODEL_REGISTRY } from "@ai-media/provider-aliyun-bailian";
import { AZURE_MODEL_REGISTRY } from "@ai-media/provider-azure-openai";
import { MINIMAX_MODEL_REGISTRY } from "@ai-media/provider-minimax";
import { VOLCENGINE_MODEL_REGISTRY } from "@ai-media/provider-volcengine";

import type {
  PlaygroundModel,
  PlaygroundModelFamily,
  PlaygroundProvider,
} from "./types";

export const PLAYGROUND_PROVIDERS: readonly {
  readonly id: PlaygroundProvider;
  readonly label: string;
}[] = [
  { id: "azure-openai", label: "Azure OpenAI" },
  { id: "aliyun-bailian", label: "Alibaba Bailian" },
  { id: "volcengine", label: "Volcengine Ark" },
  { id: "minimax", label: "MiniMax" },
];

/**
 * Sidecar for UI-only display text. Capability/modality fields come from the
 * Provider registries (single source of truth); this map only carries human
 * labels and recommendations so they do not drift from the SDK data.
 */
const PLAYGROUND_LABELS: Readonly<
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
    label: "Qwen Image 2.0 Pro（2026-06-22）",
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
    label: "HappyHorse 1.1 T2V（文生视频）",
    recommendation: "文生视频异步任务；1080P，3-15 秒，24fps MP4",
  },
  "aliyun-bailian:happyhorse-1.1-i2v": {
    label: "HappyHorse 1.1 I2V（首帧图生视频）",
    recommendation: "首帧图生视频异步任务；需首帧图片，宽高比跟随首帧",
  },
  "aliyun-bailian:happyhorse-1.1-r2v": {
    label: "HappyHorse 1.1 R2V（参考生视频）",
    recommendation: "1-9 张参考图 + prompt [Image N] 指代；参考图短边≥400px",
  },
  "aliyun-bailian:happyhorse-1.0-video-edit": {
    label: "HappyHorse 1.0 Video Edit（视频编辑）",
    recommendation:
      "1 个源视频（仅公网 URL）+ 0-5 参考图；无 ratio/duration，支持 audio_setting",
  },
  "aliyun-bailian:wan3.0-video": {
    label: "Wan 3.0 Video（万相 3.0 视频）",
    recommendation:
      "全能参考视频生成；支持文生/图生/首尾帧/参考生视频；Playground 暂不支持",
  },
  "volcengine:doubao-seedream-5-0-pro-260628": {
    label: "Doubao Seedream 5.0 Pro",
    recommendation: "高精度生成与交互编辑；组图/流式/联网搜索暂不支持",
  },
  "volcengine:doubao-seedream-5-0-260128": {
    label: "Doubao Seedream 5.0 Lite (260128)",
    recommendation: "Alias of doubao-seedream-5-0-lite-260128",
  },
  "volcengine:doubao-seedream-5-0-lite-260128": {
    label: "Doubao Seedream 5.0 Lite",
    recommendation: "平衡生成与编辑；组图/流式/联网搜索暂不支持",
  },
  "volcengine:doubao-seedream-4-5-251128": {
    label: "Doubao Seedream 4.5",
    recommendation: "生成与编辑；仅 jpeg 输出",
  },
  "volcengine:doubao-seedream-4-0-250828": {
    label: "Doubao Seedream 4.0",
    recommendation: "生成与编辑；仅 jpeg 输出",
  },
  "minimax:MiniMax-H3": {
    label: "MiniMax H3（海螺视频）",
    recommendation:
      "文生/首尾帧图生/参考生视频三场景；2K 输出，4-15 秒；参考生支持图/视频/音频参考",
  },
};

function labelFor(
  provider: PlaygroundProvider,
  id: string
): {
  readonly label: string;
  readonly recommendation: string;
} {
  return (
    PLAYGROUND_LABELS[`${provider}:${id}`] ?? {
      label: id,
      recommendation: "",
    }
  );
}

/**
 * Derive the Playground family slug for an Aliyun model from its registry
 * `family` field and model id. wan2.6-t2i and wan2.7-image have different
 * advanced-option field sets (wan2.6 supports negative_prompt/prompt_extend;
 * wan2.7 supports thinking_mode/color_palette/enable_sequential), so they
 * need distinct Playground family slugs even though they share the
 * `wan-image` Aliyun family (used for adapter routing).
 */
function aliyunFamilySlug(
  family: "qwen-multimodal" | "wan-image" | "happyhorse-video" | "wan3-video",
  id: string
): PlaygroundModelFamily {
  if (family === "wan-image") {
    return id === "wan2.6-t2i" ? "wan-image-2.6" : "wan-image-2.7";
  }
  return family;
}

/**
 * Derive a `PlaygroundModel` from an Aliyun registry entry. Projects the
 * core `ModelCapability` size/maxN metadata plus the Aliyun-specific
 * `supportedResolutions`/`supportedAspectRatios` (only consumed by the
 * Playground form, not by the core `SupportedModel` projection).
 */
function fromAliyun(
  id: string,
  entry: (typeof ALIYUN_MODEL_REGISTRY)[string]
): PlaygroundModel {
  const caps = entry.capabilities;
  const { label, recommendation } = labelFor("aliyun-bailian", id);
  return {
    id,
    label,
    provider: "aliyun-bailian",
    modality: caps.modality === "video" ? "video" : "image",
    family: aliyunFamilySlug(entry.family, id),
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
    configured: false,
  };
}

/**
 * Derive a `PlaygroundModel` from a Volcengine Ark registry entry. The family
 * slug is derived from the model id so the form can distinguish 5.0 Pro / 5.0
 * Lite / 4.5 / 4.0 for Advanced Options (4.x omits `output_format`).
 */
function volcengineFamilySlug(id: string): PlaygroundModelFamily {
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

function fromVolcengine(
  id: string,
  entry: (typeof VOLCENGINE_MODEL_REGISTRY)[string]
): PlaygroundModel {
  const caps = entry.capabilities;
  const { label, recommendation } = labelFor("volcengine", id);
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
    configured: false,
  };
}

function fromAzure(
  id: string,
  entry: (typeof AZURE_MODEL_REGISTRY)[string]
): PlaygroundModel {
  const caps = entry.capabilities;
  const { label, recommendation } = labelFor("azure-openai", id);
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
    configured: false,
  };
}

/**
 * Derive a `PlaygroundModel` from the MiniMax registry entry. MiniMax-H3 is a
 * single model id serving t2v/i2v/r2v, so the projection carries the
 * `videoScenarios` marker that makes the video workbench render a scenario
 * selector, plus the resolution/ratio allowlists and reference media caps.
 */
function fromMinimax(
  id: string,
  entry: (typeof MINIMAX_MODEL_REGISTRY)[string]
): PlaygroundModel {
  const caps = entry.capabilities;
  const { label, recommendation } = labelFor("minimax", id);
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
    configured: false,
  };
}

/**
 * Aliyun model ids excluded from the Playground projection until their media
 * input UI is implemented in a follow-up change. Wan 3.0 supports
 * heterogeneous `media[]` entries that the current form cannot represent.
 */
const ALIYUN_PLAYGROUND_EXCLUDED = new Set<string>(["wan3.0-video"]);

/**
 * The derived model list. Model ids, modalities, and capabilities come from the
 * Provider full in-package registries (single source of truth). UI labels and
 * recommendations come from the sidecar `PLAYGROUND_LABELS`. Models excluded
 * by `ALIYUN_PLAYGROUND_EXCLUDED` are filtered out because the current form
 * cannot represent their media inputs.
 */
export const PLAYGROUND_MODELS: readonly PlaygroundModel[] = [
  ...Object.entries(AZURE_MODEL_REGISTRY).map(([id, entry]) =>
    fromAzure(id, entry)
  ),
  ...Object.entries(ALIYUN_MODEL_REGISTRY)
    .filter(([id]) => !ALIYUN_PLAYGROUND_EXCLUDED.has(id))
    .map(([id, entry]) => fromAliyun(id, entry)),
  ...Object.entries(VOLCENGINE_MODEL_REGISTRY).map(([id, entry]) =>
    fromVolcengine(id, entry)
  ),
  ...Object.entries(MINIMAX_MODEL_REGISTRY).map(([id, entry]) =>
    fromMinimax(id, entry)
  ),
];

export function getPlaygroundModel(
  provider: PlaygroundProvider,
  modelId: string,
  configuredModels: ReadonlySet<string> = new Set()
): PlaygroundModel | undefined {
  const model = PLAYGROUND_MODELS.find(
    (candidate) => candidate.provider === provider && candidate.id === modelId
  );
  return model
    ? { ...model, configured: configuredModels.has(modelId) }
    : undefined;
}

export function getClientPlaygroundModels(
  configuredProviders: ReadonlySet<PlaygroundProvider>
): readonly PlaygroundModel[] {
  return PLAYGROUND_MODELS.map((model) => ({
    ...model,
    configured: configuredProviders.has(model.provider),
  }));
}
