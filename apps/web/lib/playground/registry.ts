import { ALIYUN_MODEL_REGISTRY } from "@ai-media/provider-aliyun-bailian";
import { AZURE_MODEL_REGISTRY } from "@ai-media/provider-azure-openai";
import { SEEDREAM_MODEL_REGISTRY } from "@ai-media/provider-seedream";

import type { PlaygroundModel, PlaygroundProvider } from "./types";

export const PLAYGROUND_PROVIDERS: readonly {
  readonly id: PlaygroundProvider;
  readonly label: string;
}[] = [
  { id: "azure-openai", label: "Azure OpenAI" },
  { id: "aliyun-bailian", label: "Alibaba Bailian" },
  { id: "doubao-seedream", label: "Doubao Seedream" },
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
  "aliyun-bailian:qwen-image-2.0-pro": {
    label: "Qwen Image 2.0 Pro",
    recommendation: "Balanced generation and editing",
  },
  "aliyun-bailian:qwen-image-2.0-pro-2026-06-22": {
    label: "Qwen Image 2.0 Pro（免费额度）",
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
  "doubao-seedream:doubao-seedream-5-0-pro-260628": {
    label: "Doubao Seedream 5.0 Pro",
    recommendation: "高精度生成与交互编辑；组图/流式/联网搜索暂不支持",
  },
  "doubao-seedream:doubao-seedream-5-0-260128": {
    label: "Doubao Seedream 5.0 Lite (260128)",
    recommendation: "Alias of doubao-seedream-5-0-lite-260128",
  },
  "doubao-seedream:doubao-seedream-5-0-lite-260128": {
    label: "Doubao Seedream 5.0 Lite",
    recommendation: "平衡生成与编辑；组图/流式/联网搜索暂不支持",
  },
  "doubao-seedream:doubao-seedream-4-5-251128": {
    label: "Doubao Seedream 4.5",
    recommendation: "生成与编辑；仅 jpeg 输出",
  },
  "doubao-seedream:doubao-seedream-4-0-250828": {
    label: "Doubao Seedream 4.0",
    recommendation: "生成与编辑；仅 jpeg 输出",
  },
};

function labelFor(provider: PlaygroundProvider, id: string): {
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
 * Derive a `PlaygroundModel` from an Aliyun registry entry.
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
    supportsGenerate: caps.generate,
    supportsEdit: caps.edit,
    supportsVideo: caps.modality === "video",
    supportsAsync: caps.async === true,
    requiresFirstFrame: entry.requiresFirstFrame,
    requiresInputVideo: entry.requiresInputVideo,
    maxReferenceImages: entry.maxReferenceImages,
    maxEditImages: caps.maxEditImages,
    recommendation,
    configured: false,
  };
}

/**
 * Derive a `PlaygroundModel` from a Seedream registry entry.
 */
function fromSeedream(
  id: string,
  entry: (typeof SEEDREAM_MODEL_REGISTRY)[string]
): PlaygroundModel {
  const caps = entry.capabilities;
  const { label, recommendation } = labelFor("doubao-seedream", id);
  return {
    id,
    label,
    provider: "doubao-seedream",
    modality: caps.modality === "video" ? "video" : "image",
    supportsGenerate: caps.generate,
    supportsEdit: caps.edit,
    supportsVideo: false,
    maxEditImages: caps.maxEditImages,
    recommendation,
    configured: false,
  };
}

/**
 * Derive a `PlaygroundModel` from an Azure registry entry.
 */
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
    supportsGenerate: caps.generate,
    supportsEdit: caps.edit,
    supportsVideo: false,
    supportsAsync: caps.async === true,
    maxEditImages: caps.maxEditImages,
    recommendation,
    configured: false,
  };
}

/**
 * The derived model list. Model ids, modalities, and capabilities come from the
 * Provider full in-package registries (single source of truth). UI labels and
 * recommendations come from the sidecar `PLAYGROUND_LABELS`. Placeholder
 * entries that previously drifted (`z-image-turbo`, `wan2.7-t2v-2026-06-12`,
 * `wan2.7-r2v-2026-06-12`) are absent because they are not in any registry.
 */
export const PLAYGROUND_MODELS: readonly PlaygroundModel[] = [
  ...Object.entries(AZURE_MODEL_REGISTRY).map(([id, entry]) =>
    fromAzure(id, entry)
  ),
  ...Object.entries(ALIYUN_MODEL_REGISTRY).map(([id, entry]) =>
    fromAliyun(id, entry)
  ),
  ...Object.entries(SEEDREAM_MODEL_REGISTRY).map(([id, entry]) =>
    fromSeedream(id, entry)
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
