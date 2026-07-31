import type { PlaygroundModel, PlaygroundProvider } from "./types";

export const PLAYGROUND_PROVIDERS: readonly {
  readonly id: PlaygroundProvider;
  readonly label: string;
}[] = [
  { id: "azure-openai", label: "Azure OpenAI" },
  { id: "aliyun-bailian", label: "Alibaba Bailian" },
  { id: "doubao-seedream", label: "Doubao Seedream" },
];

export const PLAYGROUND_MODELS: readonly PlaygroundModel[] = [
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    provider: "azure-openai",
    supportsGenerate: true,
    supportsEdit: false,
    recommendation: "Azure synchronous image generation",
    configured: false,
  },
  {
    id: "qwen-image-2.0-pro-2026-06-22",
    label: "Qwen Image 2.0 Pro（免费额度）",
    provider: "aliyun-bailian",
    supportsGenerate: true,
    supportsEdit: true,
    maxEditImages: 3,
    recommendation: "Qwen Image 2.0 Pro dated model; free quota may apply",
    configured: false,
  },
  {
    id: "wan2.7-image-pro",
    label: "Wan 2.7 Image Pro",
    provider: "aliyun-bailian",
    supportsGenerate: true,
    supportsEdit: false,
    recommendation: "High quality generation",
    configured: false,
  },
  {
    id: "wan2.7-image",
    label: "Wan 2.7 Image",
    provider: "aliyun-bailian",
    supportsGenerate: true,
    supportsEdit: false,
    recommendation: "Balanced generation",
    configured: false,
  },
  {
    id: "z-image-turbo",
    label: "Z Image Turbo",
    provider: "aliyun-bailian",
    supportsGenerate: true,
    supportsEdit: false,
    recommendation: "Fast, lower-cost generation; editing is not supported",
    configured: false,
  },
  {
    id: "qwen-image-3.0-pro",
    label: "Qwen Image 3.0 Pro",
    provider: "aliyun-bailian",
    supportsGenerate: true,
    supportsEdit: true,
    maxEditImages: 3,
    recommendation: "High-quality generation and editing",
    configured: false,
  },
  {
    id: "qwen-image-2.0-pro",
    label: "Qwen Image 2.0 Pro",
    provider: "aliyun-bailian",
    supportsGenerate: true,
    supportsEdit: true,
    maxEditImages: 3,
    recommendation: "Balanced generation and editing",
    configured: false,
  },
  {
    id: "wan2.7-t2v-2026-06-12",
    label: "Wan 2.7 T2V（视频）",
    provider: "aliyun-bailian",
    supportsGenerate: false,
    supportsEdit: false,
    recommendation: "视频模型；当前 Playground 仅支持图片生成",
    configured: false,
  },
  {
    id: "happyhorse-1.1-r2v",
    label: "HappyHorse 1.1 R2V（视频）",
    provider: "aliyun-bailian",
    supportsGenerate: false,
    supportsEdit: false,
    recommendation: "视频模型；当前 Playground 仅支持图片生成",
    configured: false,
  },
  {
    id: "wan2.7-r2v-2026-06-12",
    label: "Wan 2.7 R2V（视频）",
    provider: "aliyun-bailian",
    supportsGenerate: false,
    supportsEdit: false,
    recommendation: "视频模型；当前 Playground 仅支持图片生成",
    configured: false,
  },
  {
    id: "happyhorse-1.1-t2v",
    label: "HappyHorse 1.1 T2V（视频）",
    provider: "aliyun-bailian",
    supportsGenerate: false,
    supportsEdit: false,
    recommendation: "视频模型；当前 Playground 仅支持图片生成",
    configured: false,
  },
  {
    id: "happyhorse-1.1-i2v",
    label: "HappyHorse 1.1 I2V（视频）",
    provider: "aliyun-bailian",
    supportsGenerate: false,
    supportsEdit: false,
    recommendation: "视频模型；当前 Playground 仅支持图片生成",
    configured: false,
  },
  {
    id: "doubao-seedream-5-0-pro-260628",
    label: "Doubao Seedream 5.0 Pro",
    provider: "doubao-seedream",
    supportsGenerate: true,
    supportsEdit: true,
    maxEditImages: 10,
    recommendation: "高精度生成与交互编辑；组图/流式/联网搜索暂不支持",
    configured: false,
  },
  {
    id: "doubao-seedream-5-0-lite-260128",
    label: "Doubao Seedream 5.0 Lite",
    provider: "doubao-seedream",
    supportsGenerate: true,
    supportsEdit: true,
    maxEditImages: 14,
    recommendation: "平衡生成与编辑；组图/流式/联网搜索暂不支持",
    configured: false,
  },
  {
    id: "doubao-seedream-4-5-251128",
    label: "Doubao Seedream 4.5",
    provider: "doubao-seedream",
    supportsGenerate: true,
    supportsEdit: true,
    maxEditImages: 14,
    recommendation: "生成与编辑；仅 jpeg 输出",
    configured: false,
  },
  {
    id: "doubao-seedream-4-0-250828",
    label: "Doubao Seedream 4.0",
    provider: "doubao-seedream",
    supportsGenerate: true,
    supportsEdit: true,
    maxEditImages: 14,
    recommendation: "生成与编辑；仅 jpeg 输出",
    configured: false,
  },
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
