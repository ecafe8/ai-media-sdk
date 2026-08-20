# @ai-media/provider-volcengine

[![npm version](https://img.shields.io/npm/v/@ai-media/provider-volcengine.svg)](https://www.npmjs.com/package/@ai-media/provider-volcengine)
[![npm downloads](https://img.shields.io/npm/dm/@ai-media/provider-volcengine.svg)](https://www.npmjs.com/package/@ai-media/provider-volcengine)
[![License](https://img.shields.io/npm/l/@ai-media/provider-volcengine.svg)](https://github.com/ecafe8/ai-media-sdk/blob/main/packages/provider-volcengine/LICENSE)

[AI Media SDK](../ai-media-sdk/README.md) 的火山引擎方舟（Volcengine Ark）图像生成 Provider。基于原生 `fetch` 调用方舟 OpenAI 兼容图像 API（同步），不依赖平台 SDK。当前覆盖 Doubao-Seedream 图像模型。

> **注意**：本项目处于快速迭代期间，API 可能随时变更，生产使用请锁定版本。

## 安装

```bash
npm install @ai-media/sdk @ai-media/provider-volcengine
```

运行时要求：Node.js >= 20（或 Bun），ESM-only。

## 配置

通过 `createVolcengineProvider(config)` 传入配置对象：

```ts
import { createVolcengineProvider } from "@ai-media/provider-volcengine";

const provider = createVolcengineProvider({
  /** 方舟 API key，作为 `Authorization: Bearer` 凭据发送 */
  apiKey: "<your-api-key>",
  /** 可选，区域化方舟 API base；默认 https://ark.cn-beijing.volces.com/api/v3 */
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
});
```

## 快速开始

```ts
import { generateImage } from "@ai-media/sdk";

const result = await generateImage({
  model: provider.image("doubao-seedream-5-0-pro-260628"),
  prompt: "江南小镇的清晨，水彩画风格",
  size: "2K",
  providerOptions: {
    volcengine: {
      watermark: false,
      output_format: "png",
      response_format: "url",
    },
  },
});

console.log(result.content); // ImageContent[]
```

## 图像编辑

所有 Seedream 模型均支持 I2I 编辑（`editImage`），参考图以 URL 传入：

```ts
import { editImage } from "@ai-media/sdk";

const result = await editImage({
  model: provider.image("doubao-seedream-5-0-pro-260628"),
  prompt: "把画面改成雪天",
  images: [{ url: "https://example.com/input.png" }],
});
```

## 模型一览

所有模型均为同步调用，每次返回 1 张图（`n` 上限为 1）。`size` 支持档位形式，也支持不超过 `maxResolution` 的 `WxH` 像素值。

| 模型                              | 生成 | 编辑 | size               | 分辨率上限 | 参考图上限 | 输出格式   |
| --------------------------------- | ---- | ---- | ------------------ | ---------- | ---------- | ---------- |
| `doubao-seedream-5-0-pro-260628`  | ✅   | ✅   | `1K` / `2K`        | 2048x2048  | 10 张      | png / jpeg |
| `doubao-seedream-5-0-260128`      | ✅   | ✅   | `2K` / `3K` / `4K` | 4096x4096  | 14 张      | png / jpeg |
| `doubao-seedream-5-0-lite-260128` | ✅   | ✅   | `2K` / `3K` / `4K` | 4096x4096  | 14 张      | png / jpeg |
| `doubao-seedream-4-5-251128`      | ✅   | ✅   | `2K` / `4K`        | 4096x4096  | 14 张      | jpeg       |
| `doubao-seedream-4-0-250828`      | ✅   | ✅   | `1K` / `2K` / `4K` | 4096x4096  | 14 张      | jpeg       |

```ts
for (const model of provider.listModels()) {
  console.log(model.id, model.capabilities);
}
```

## provider 专属参数

方舟专属字段放在 `providerOptions.volcengine` 命名空间下（类型 `VolcengineImageProviderOptions`）：

| 字段                      | 说明                                              |
| ------------------------- | ------------------------------------------------- |
| `watermark`               | 是否添加 “AI生成” 水印（默认 false）              |
| `output_format`           | 输出格式 `png` / `jpeg`（仅 5.0 系列支持自定义）  |
| `response_format`         | 结果返回形式 `url`（默认）/ `b64_json`            |
| `optimize_prompt_options` | prompt 优化模式：`{ mode: "standard" \| "fast" }` |

```ts
const result = await generateImage({
  model: provider.image("doubao-seedream-5-0-pro-260628"),
  prompt: "江南小镇的清晨",
  size: "2K",
  providerOptions: {
    volcengine: {
      watermark: false,
      output_format: "png",
      response_format: "url",
      optimize_prompt_options: { mode: "standard" },
    },
  },
});
```

## 错误处理

所有失败抛出 `@ai-media/sdk` 的 `SdkError`（`AUTH_ERROR` / `RATE_LIMITED` / `INVALID_REQUEST` / `PROVIDER_ERROR` / `TIMEOUT` / `NETWORK_ERROR` 等），错误信息不包含凭据；未知模型 id 抛出 `UNKNOWN_MODEL`。详见 `@ai-media/sdk` README。

## License

MIT
