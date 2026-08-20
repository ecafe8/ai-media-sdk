# @ai-media/sdk

[![npm version](https://img.shields.io/npm/v/@ai-media/sdk.svg)](https://www.npmjs.com/package/@ai-media/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@ai-media/sdk.svg)](https://www.npmjs.com/package/@ai-media/sdk)
[![License](https://img.shields.io/npm/l/@ai-media/sdk.svg)](https://github.com/ecafe8/ai-media-sdk/blob/main/packages/ai-media-sdk/LICENSE)

Provider 无关的核心契约与任务抽象，面向 AI 图像与视频生成。

本包定义统一的调用模型（Provider 工厂 → 模型实例 → 生成函数）、同步/异步任务生命周期、结果结构与错误分类，**本身不访问任何 Provider API**，需要与具体的 Provider 包搭配使用：

- `@ai-media/provider-azure-openai`
- `@ai-media/provider-aliyun-bailian`
- `@ai-media/provider-volcengine`
- `@ai-media/provider-minimax`

> **注意**：本项目处于快速迭代期间，API 可能随时变更，生产使用请锁定版本。

## 安装

```bash
npm install @ai-media/sdk @ai-media/provider-azure-openai
```

运行时要求：Node.js >= 20（或 Bun），ESM-only。所有配置均以参数对象传入。

## 快速开始

```ts
import { createAzureOpenAIProvider } from "@ai-media/provider-azure-openai";
import { generateImage } from "@ai-media/sdk";

const provider = createAzureOpenAIProvider({
  apiKey: "<your-api-key>",
  endpoint: "https://<resource>.cognitiveservices.azure.com",
  apiVersion: "2024-02-01",
});

const result = await generateImage({
  model: provider.image("gpt-image-2"),
  prompt: "A quiet riverside town at sunrise",
  n: 1,
  size: "1024x1024",
});

for (const image of result.content) {
  console.log(image.url ?? "(base64)");
}
```

`result` 是 `GenerationResult<ImageContent[]>`，除 `content` 外还携带 `provider`、`model`、`requestId`、`createdAt` 等元数据。

## 同步生成与编辑

### generateImage

文生图。公共参数只有 `prompt`、`n`、`size`，其余一律走 `providerOptions`（见下文）。参数会先按模型能力做预检（如 `size` 是否在支持列表/分辨率上限内、`n` 是否超过上限），不合法时在任何网络请求之前抛出 `INVALID_REQUEST`。

```ts
const result = await generateImage({
  model: provider.image("<model-id>"),
  prompt: "江南小镇的清晨，水彩画风格",
  n: 1,
  size: "1024x1024",
  providerOptions: {
    // provider 专属字段，键名为 provider 命名空间
  },
});
```

### editImage

基于 1 至多张参考图（URL 或 base64）做图像编辑，上限由模型能力的 `maxEditImages` 决定（未声明时为 3）。要求模型具备 `edit` 能力。

```ts
const result = await editImage({
  model: provider.image("<model-id>"),
  prompt: "把画面改成雪天",
  images: [{ url: "https://example.com/input.png" }],
});
```

## 异步任务

异步模型（能力声明含 `async`）使用 `submitImageTask` / `submitVideoTask` 提交，返回统一的 `TaskHandle`：

```ts
import { submitImageTask, submitVideoTask } from "@ai-media/sdk";

// 异步图像任务
const imageTask = await submitImageTask({
  model: provider.image("<async-image-model>"),
  prompt: "江南小镇的清晨，水彩画风格",
  n: 1,
  size: "1K",
});
const imageResult = await imageTask.wait();

// 视频任务
const videoTask = await submitVideoTask({
  model: provider.video("<video-model>"),
  prompt: "镜头缓缓推进",
  providerOptions: {
    // provider 专属视频参数
  },
});
const videoResult = await videoTask.wait({
  pollIntervalMs: 15_000, // 默认 15s
  timeoutMs: 600_000, // 默认 600s
  signal: abortController.signal, // 可选，轮询间隙响应中止
});
```

`TaskHandle` 字段：

| 字段/方法          | 说明                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `taskId`           | Provider 侧任务 ID                                                |
| `status`           | `pending` / `running` / `succeeded` / `failed` / `cancelled`      |
| `result` / `error` | 到达终态后分别携带最终结果或错误                                  |
| `wait(options?)`   | 轮询至终态：成功返回 `GenerationResult`，失败/取消抛出 `SdkError` |

视频输入按模式携带媒体字段：`firstFrame`（首帧图生视频）、`referenceImages`（有序参考图）、`inputVideo`（源视频公开 URL）。具体允许哪些输入由模型与 Provider 决定。

## 公共参数与 providerOptions

公共契约只包含三个参数：

- `prompt`：必填，非空。
- `n`：输出数量，正整数，受模型 `maxN` 约束。
- `size`：两种形态——像素形式 `WxH`（如 `"1024x1024"`，也接受 `X`/`*` 分隔）与档位形式（如 `"1K"`、`"2K"`），以各模型声明为准。

其他一切 provider 专属字段必须放在 `providerOptions.<provider>` 命名空间下，由各 Provider 包定义类型（如 `providerOptions.azure`、`providerOptions.aliyun`）。传入未知公共字段会被预检拒绝。

辅助函数：

- `pixelSize(width, height)` — 构造像素形式 `size`。
- `tierSize(tier)` — 构造档位形式 `size`。
- `toImageUrl(image)` — 将 `ImageContent` 归一化为可渲染 URL（base64 自动转 data URL）。

选择字面量模型 id 时（如 `provider.image("gpt-image-2")`），请求参数会在编译期收窄为该模型接受的 `size`/`n`/`providerOptions` 形状；动态 id 走宽松重载。

## 结果结构

```ts
interface GenerationResult<TContent> {
  content: TContent; // 图像为 ImageContent[]，视频为 VideoContent[]
  provider: string;
  model: string;
  requestId?: string;
  createdAt?: string;
  raw?: unknown;
}

interface ImageContent {
  url?: string;
  base64?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

interface VideoContent {
  url?: string; // 下载链接，默认 MP4
  base64?: string;
  mimeType?: string;
  duration?: number; // 秒
  width?: number;
  height?: number;
}
```

> Provider 返回的结果 URL 通常是**临时的**，请及时下载并自行持久化。

## 错误处理

所有失败统一抛出 `SdkError`，携带稳定的 `code` 与 `retryable` 标记：

| code              | 含义                                    | 默认可重试 |
| ----------------- | --------------------------------------- | ---------- |
| `NOT_IMPLEMENTED` | 能力尚未实现                            | 否         |
| `AUTH_ERROR`      | 认证失败（HTTP 401/403）                | 否         |
| `RATE_LIMITED`    | 触发限流（HTTP 429）                    | 是         |
| `INVALID_REQUEST` | 请求非法（预检失败或 HTTP 400/413/422） | 否         |
| `UNKNOWN_MODEL`   | 模型 id 不在 Provider 注册表            | 否         |
| `PROVIDER_ERROR`  | Provider 服务端错误（HTTP 5xx）         | 否         |
| `TIMEOUT`         | 请求超时                                | 是         |
| `NETWORK_ERROR`   | 网络错误                                | 是         |
| `UNKNOWN`         | 未分类错误                              | 否         |

```ts
import { SdkError } from "@ai-media/sdk";

try {
  await generateImage({ model, prompt });
} catch (error) {
  if (error instanceof SdkError && error.retryable) {
    // 按退避策略重试
  }
}
```

错误信息不包含凭据与 Provider 原始响应。

## 相关包

- `@ai-media/provider-azure-openai` — Azure OpenAI 图像生成
- `@ai-media/provider-aliyun-bailian` — 阿里云百炼图像 + 视频
- `@ai-media/provider-volcengine` — 火山方舟 Doubao-Seedream 图像生成
- `@ai-media/uploader` — Provider 输入文件的临时上传辅助

## License

MIT
