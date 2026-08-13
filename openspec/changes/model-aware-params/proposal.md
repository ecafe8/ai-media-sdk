## Why

各 Provider 模型对图像尺寸参数的表达方式存在结构性分歧：Azure `gpt-image-2` 接受 `1024x1024`/`auto` 等闭集像素值，Aliyun Qwen 接受任意 `宽*高`（上限 2048×2048），Aliyun Wan 同时接受 `2K/4K` 档位与 `宽*高`，Doubao-Seedream 同时接受 `1K/2K/3K/4K` 档位与 `宽x高`。当前 `ImageGenerationInput.size` 是一个无类型、无校验的 `string`，`generateImage` 把任何值原样透传给适配器，违反总 PRD §8.1「模型不支持的参数必须显式报错，不得静默删除」。Playground 也因此把 `size`/`n`/视频 `resolution`/`duration` 硬编码成同一组下拉选项，与所选模型实际能力脱节；同时 `PlaygroundMode = "generate"|"edit"|"video"` 把「操作」与「模态」混在一个枚举里，使图像 size 与视频 resolution+ratio 字段在表单中互斥纠缠。本 change 在 SDK 核心层与 Playground 同时引入「模型能力驱动的参数」模型，让用户「选了模型即知道该传什么」。

## What Changes

- 扩展 `ModelCapability`，新增可选字段 `supportedSizes?: readonly string[]`、`maxResolution?: { width; height }`、`maxN?: number`。
- `generateImage` 在既有 `SUPPORTED_PUBLIC_PARAMS` 白名单基础上新增预检：`size` 必须命中 `supportedSizes`（闭集优先）或满足像素正则 `^\d+[x*]\d+$` 且不超 `maxResolution`；`n` 不得超 `maxN`；越界抛 `INVALID_REQUEST`。向后兼容：未声明约束的模型继续原样透传。
- 为 `ModelInstance<TContent, TParams = ImageGenerationInput>` 新增第三泛型（phantom，运行时无变化，默认值保持现有调用兼容）。每个 Provider 工厂的 `image(modelId)` 对已知模型 id 提供字面量重载，返回携带家族级 `TParams` 的实例；`generateImage` 改为泛型 `generateImage<TParams extends ImageGenerationInput>`，请求形状由 `TParams` 约束，IDE 自动提示「该模型允许的 `size` 字面量、`n` 字面量、`providerOptions.<namespace>` 字段」。
- 各 Provider 注册表按 live 契约填充 `supportedSizes`/`maxResolution`/`maxN`：Azure `gpt-image-2` 闭集 4 项、Aliyun Qwen 系列 2048×2048 上限、Aliyun Wan 4096×4096 或 2048×2048 上限、Seedream 各档位闭集+像素上限。Aliyun 视频在 `AliyunModelEntry` 新增 `supportedResolutions`/`supportedAspectRatios`，替代 `provider/index.ts` 硬编码常量。
- 重构 Playground：顶部新增「图像 / 视频 / 音频(disabled)」模态 Tab，切换 Tab 完全重置表单状态。`PlaygroundMode` 拆为 `PlaygroundModality` + 图像 `ImageOperation`（generate/edit）两级；视频不设 operation 枚举，多场景模型（一个 model id 服务多场景）渲染 `VideoScenario`（t2v/i2v/r2v）场景选择器，标志驱动模型按注册表标志（`requiresFirstFrame`/`requiresInputVideo`）推导输入。`components/playground/` 拆为 `image-workbench/`、`video-workbench/`、`result-feed/`、`lib/<image|video>-form-schema.ts`，遵循 `AGENTS.md` 模块命名规则。
- Playground 表单字段模型驱动：`size` 选项来自 `currentModel.supportedSizes` 或 `maxResolution` 派生的像素预设，**默认取第一项**；`n` 上限取 `currentModel.maxN`；视频 `resolution`/`ratio`/`duration` 来自各 Provider 注册表声明（Aliyun/MiniMax）；video-edit 自动隐藏 480P/ratio/duration 并显示 `audio_setting`。新增「高级选项」折叠区，按模型 `family` 渲染对应 Provider 原生 `providerOptions` 控件（Azure `quality`/`output_format`/`output_compression`、Aliyun Qwen 与 Wan 2.6 `negative_prompt`/`prompt_extend`/`watermark`/`seed`、Aliyun Wan 2.7 `watermark`/`thinking_mode`/`color_palette`/`enable_sequential`、Seedream `watermark`/`output_format`/`response_format`/`optimize_prompt_mode`）。
- 投影自注册表的 `PlaygroundModel` 新增 `supportedSizes`/`maxResolution`/`maxN`/`supportedResolutions`/`supportedAspectRatios`/`family` 字段，由 `lib/playground/registry.ts` 的 `fromAliyun`/`fromSeedream`/`fromAzure` 填充。

## Capabilities

### New Capabilities

- `image-param-validation`: 核心图像入口 `generateImage`/`submitImageTask` 在网络调用前依据 `ModelCapability.supportedSizes`/`maxResolution`/`maxN` 校验公共 `size`/`n` 参数；越界抛 `INVALID_REQUEST`；未声明约束的模型保持原样透传以维持向后兼容。
- `model-family-typing`: 每个 Provider 包的 `image(modelId)`/`video(modelId)` 工厂对已知模型 id 字面量提供按家族的重载，返回携带家族级 `TParams` 的模型实例；`generateImage`/`editImage`/`submitImageTask`/`submitVideoTask` 改为泛型，请求形状由模型实例的 `TParams` 约束，使 IDE 在选定模型后即提示该模型允许的 `size` 字面量、`n` 字面量与 `providerOptions.<namespace>` 字段。

### Modified Capabilities

- `model-registry-aggregation`: `ModelCapability` 新增可选 `supportedSizes`/`maxResolution`/`maxN` 字段，`SupportedModel.capabilities` 投影自动携带；`AliyunModelEntry` 新增 `supportedResolutions`/`supportedAspectRatios`（Provider 特有，不进入公共投影，仅通过 `ALIYUN_MODEL_REGISTRY` 暴露）。
- `playground-form`: 顶部模态 Tab（图像/视频/音频-disabled）切换并完全重置表单；表单字段从所选模型的 `supportedSizes`/`maxResolution`/`maxN`/`supportedResolutions`/`supportedAspectRatios`/`family` 派生；每个参数下拉默认取第一项；新增「高级选项」折叠区按家族渲染 Provider 原生 `providerOptions` 控件；`PlaygroundMode` 拆为 `PlaygroundModality` + 图像 `ImageOperation` 两级，视频以 `VideoScenario` 场景选择器（多场景模型）或注册表标志（标志驱动模型）表达。

## Impact

- **SDK 核心**：`packages/ai-media-sdk/src/contracts/capabilities.ts`、`contracts/model-instance.ts`、`image/request.ts`、`image/generate.ts`、`image/submit.ts`、`video/request.ts`、`video/submit.ts` 增加泛型与校验；`src/index.ts` 导出新 helper（`pixelSize`/`tierSize`）与 `ImageGenerationInput` 默认类型导出。
- **Provider 包**：各 Provider 的 `src/provider/registry.ts` 填充新字段（Azure/Aliyun/Seedream 由本 change 填充；MiniMax 由后续 `add-minimax-provider` change 自带同构字段）；`src/provider/index.ts` 工厂方法签名增加按家族重载；`src/provider/options.ts` 类型对齐 `TParams` 约束。运行时行为不变（除 Aliyun 视频分辨率校验改由注册表驱动）。
- **Playground**：`apps/web/components/playground/index.tsx` 拆分为多模块；`apps/web/lib/playground/types.ts` 扩展 `PlaygroundModel`；`apps/web/lib/playground/registry.ts` 投影新字段；`apps/web/lib/playground/server.ts` 适配新 `PlaygroundModality`+operation 入参；`apps/web/app/api/playground/generate/route.ts` 与 `.test.ts` 同步。后续 `add-frontend-site`/`add-minimax-playground` change 在 `apps/site` BYO-key Playground 复用了同一模型驱动表单结构，并按 `site-i18n` 能力本地化全部界面文案。
- **文档**：`docs/prd/sub-image-generation/tech.md` §11 把「公共参数首期包含哪些尺寸」标记为已决；`docs/prd/sub-provider-adapters/tech.md` §4 各 Provider 能力矩阵补 `supportedSizes`/`maxResolution`/`maxN`/`supportedAspectRatios` 列。
- **测试**：新增 `packages/ai-media-sdk/tests/image-size-validation.test.ts` 覆盖 `validateSize`/`validateN` 各分支（含 `generateImage` 与 `submitImageTask` 两条入口）；各 Provider `tests/family-typing.test-d.ts` 断言家族重载的编译期收窄；扩展 `apps/web/app/api/playground/generate/route.test.ts` 覆盖 size 越界、n 超量、tier 误传 pixel-only 模型。
- **向后兼容**：未声明新字段的模型与未使用类型化重载的调用点（含 Playground server.ts 的 `provider.image(request.model: string)` 兜底重载）行为不变。
