# @ai-media/provider-azure-openai

[![npm version](https://img.shields.io/npm/v/@ai-media/provider-azure-openai.svg)](https://www.npmjs.com/package/@ai-media/provider-azure-openai)
[![npm downloads](https://img.shields.io/npm/dm/@ai-media/provider-azure-openai.svg)](https://www.npmjs.com/package/@ai-media/provider-azure-openai)
[![License](https://img.shields.io/npm/l/@ai-media/provider-azure-openai.svg)](https://github.com/ecafe8/ai-media-sdk/blob/main/packages/provider-azure-openai/LICENSE)

[AI Media SDK](../ai-media-sdk/README.md) 的 Azure OpenAI 图像生成 Provider。基于原生 `fetch` 调用 Azure OpenAI 图像 API（同步），不依赖 OpenAI 官方 SDK。

> **注意**：本项目处于快速迭代期间，API 可能随时变更，生产使用请锁定版本。

## 安装

```bash
npm install @ai-media/sdk @ai-media/provider-azure-openai
```

运行时要求：Node.js >= 20（或 Bun），ESM-only。

## 配置

通过 `createAzureOpenAIProvider(config)` 传入配置对象：

```ts
import { createAzureOpenAIProvider } from "@ai-media/provider-azure-openai";

const provider = createAzureOpenAIProvider({
  /** API key，作为 `Authorization: Bearer` 凭据发送 */
  apiKey: "<your-api-key>",
  /** Azure 资源 endpoint，如 https://<resource>.cognitiveservices.azure.com */
  endpoint: "https://<resource>.cognitiveservices.azure.com",
  /** Azure OpenAI API 版本，如 2024-02-01 */
  apiVersion: "2024-02-01",
});
```

## 快速开始

```ts
import { generateImage } from "@ai-media/sdk";

const result = await generateImage({
  model: provider.image("gpt-image-2"),
  prompt: "A quiet riverside town at sunrise",
  n: 1,
  size: "1024x1024",
});

console.log(result.content); // ImageContent[]
```

## 模型

| deployment    | 生成 | 编辑   | 调用方式 | size                                             | n 上限 |
| ------------- | ---- | ------ | -------- | ------------------------------------------------ | ------ |
| `gpt-image-2` | 支持 | 不支持 | 同步     | `1024x1024` / `1024x1536` / `1536x1024` / `auto` | 1      |

Azure 的 deployment 名称在 Azure Portal 中由用户自定义，无法全局枚举。注册表只内置了已实测确认的 `gpt-image-2`（Serverless Global Standard）；其他 deployment 需要运行时注册：

```ts
import { createAzureModel } from "@ai-media/provider-azure-openai";

// 方式一：包级函数
const model = createAzureModel(provider, "my-custom-deployment", {
  modality: "image",
  generate: true,
  edit: false,
});

// 方式二：实例方法（等价）
const model2 = provider.createModel("my-custom-deployment");

const result = await generateImage({ model, prompt: "..." });
```

未提供能力元数据的自定义 deployment 不声明 size/n 约束，参数将原样透传。未注册 deployment 调用 `provider.image()` 会抛出 `UNKNOWN_MODEL`。

列出注册表中的模型：

```ts
for (const model of provider.listModels()) {
  console.log(model.id, model.capabilities);
}
```

## provider 专属参数

Azure 专属字段放在 `providerOptions.azure` 命名空间下（类型 `AzureImageProviderOptions`）：

```ts
const result = await generateImage({
  model: provider.image("gpt-image-2"),
  prompt: "A quiet riverside town at sunrise",
  size: "1024x1024",
  providerOptions: {
    azure: {
      quality: "high", // 质量提示，如 low / high
      output_format: "png", // 输出格式，如 png / jpeg
      output_compression: 80, // 压缩级别 0-100（格式支持时）
    },
  },
});
```

## 限制

- 仅支持同步图像生成；`editImage` 会抛出 `NOT_IMPLEMENTED`。
- 不支持异步任务（`submitImageTask` 对该 Provider 不可用）。
- `gpt-image-2` 每次调用固定返回 1 张图（`n` 上限为 1）。

## 错误处理

所有失败抛出 `@ai-media/sdk` 的 `SdkError`（`AUTH_ERROR` / `RATE_LIMITED` / `INVALID_REQUEST` / `PROVIDER_ERROR` / `TIMEOUT` / `NETWORK_ERROR` 等），错误信息不包含凭据。详见 `@ai-media/sdk` README。

## License

MIT
