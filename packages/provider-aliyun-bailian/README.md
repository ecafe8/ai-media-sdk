# @ai-media/provider-aliyun-bailian

[![npm version](https://img.shields.io/npm/v/@ai-media/provider-aliyun-bailian.svg)](https://www.npmjs.com/package/@ai-media/provider-aliyun-bailian)
[![npm downloads](https://img.shields.io/npm/dm/@ai-media/provider-aliyun-bailian.svg)](https://www.npmjs.com/package/@ai-media/provider-aliyun-bailian)
[![License](https://img.shields.io/npm/l/@ai-media/provider-aliyun-bailian.svg)](https://github.com/ecafe8/ai-media-sdk/blob/main/packages/provider-aliyun-bailian/LICENSE)

[AI Media SDK](../ai-media-sdk/README.md) 的阿里云百炼（DashScope）Provider，支持图像生成/编辑与视频生成。基于原生 `fetch` 直接调用 DashScope REST API，不依赖平台 SDK。

> **注意**：本项目处于快速迭代期间，API 可能随时变更，生产使用请锁定版本。

## 安装

```bash
npm install @ai-media/sdk @ai-media/provider-aliyun-bailian
```

运行时要求：Node.js >= 20（或 Bun），ESM-only。

## 配置

通过 `createAliyunBailianProvider(config)` 传入配置对象：

```ts
import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";

const provider = createAliyunBailianProvider({
  /** DashScope API key，作为 `Authorization: Bearer` 凭据发送 */
  apiKey: "<your-api-key>",
  /** 区域化的 DashScope API base，内嵌 workspace id 与 region */
  baseUrl: "https://<WorkspaceId>.cn-beijing.maas.aliyuncs.com/api/v1",
});
```

## 图像生成（Qwen：同步）

Qwen 系列走同步接口，支持生成与编辑：

```ts
import { generateImage, editImage } from "@ai-media/sdk";

const result = await generateImage({
  model: provider.image("qwen-image-2.0-pro"),
  prompt: "江南小镇的清晨，水彩画风格",
  n: 1,
  size: "1024*1024", // 任意 WxH / W*H 像素值，不超过 2048x2048
});

const edited = await editImage({
  model: provider.image("qwen-image-2.0-pro"),
  prompt: "把画面改成雪天",
  images: [{ url: "https://example.com/input.png" }], // 1-3 张，URL 或 base64
});
```

## 图像生成（Wan：异步任务）

Wan 系列为异步模型，使用 `submitImageTask` 提交并轮询：

```ts
import { submitImageTask } from "@ai-media/sdk";

const task = await submitImageTask({
  model: provider.image("wan2.7-image-pro"),
  prompt: "江南小镇的清晨，水彩画风格",
  n: 1,
  size: "2K", // 档位形式
});
const result = await task.wait({ pollIntervalMs: 15_000, timeoutMs: 600_000 });
```

## 图像模型一览

| 模型                            | 调用方式 | 生成 | 编辑        | size                                    | n 上限 |
| ------------------------------- | -------- | ---- | ----------- | --------------------------------------- | ------ |
| `qwen-image-3.0-pro`            | 同步     | ✅   | ✅（≤3 张） | 像素值 ≤2048x2048                       | 6      |
| `qwen-image-3.0`                | 同步     | ✅   | ✅（≤3 张） | 像素值 ≤2048x2048                       | 6      |
| `qwen-image-2.0-pro`            | 同步     | ✅   | ✅（≤3 张） | 像素值 ≤2048x2048                       | 6      |
| `qwen-image-2.0-pro-2026-06-22` | 同步     | ✅   | ✅（≤3 张） | 像素值 ≤2048x2048                       | 6      |
| `qwen-image-2.0`                | 同步     | ✅   | ✅（≤3 张） | 像素值 ≤2048x2048                       | 6      |
| `wan2.7-image-pro`              | 异步     | ✅   | ❌          | `1K` / `2K` / `4K`（像素值 ≤4096x4096） | 4      |
| `wan2.7-image`                  | 异步     | ✅   | ❌          | `1K` / `2K`（像素值 ≤2048x2048）        | 4      |
| `wan2.6-t2i`                    | 异步     | ✅   | ❌          | 像素值 ≤1440x1440（仅像素形式）         | 4      |

## 视频生成（HappyHorse）

视频均为异步任务，使用 `submitVideoTask` 提交。四种模式对应不同媒体输入：

```ts
import { submitVideoTask } from "@ai-media/sdk";

// 文生视频（t2v）
const t2v = await submitVideoTask({
  model: provider.video("happyhorse-1.1-t2v"),
  prompt: "清晨的江南水乡，镜头缓缓推进",
  providerOptions: {
    aliyun: {
      resolution: "720P",
      ratio: "16:9",
      duration: 15,
      watermark: false,
    },
  },
});

// 首帧图生视频（i2v）：比例自动跟随首帧，不接受 ratio
const i2v = await submitVideoTask({
  model: provider.video("happyhorse-1.1-i2v"),
  prompt: "画面中的水面泛起涟漪",
  firstFrame: { url: "https://example.com/first.png" },
});

// 参考图生视频（r2v）：1-9 张参考图，prompt 中用 [Image N] 按顺序指代
const r2v = await submitVideoTask({
  model: provider.video("happyhorse-1.1-r2v"),
  prompt: "[Image 1] 中的人物走向 [Image 2] 的场景",
  referenceImages: [{ url: "https://example.com/ref1.png" }],
  providerOptions: {
    aliyun: { resolution: "720P", ratio: "16:9", duration: 15 },
  },
});

// 源视频编辑（video-edit）：ratio/duration 由 audio_setting 替代
const edit = await submitVideoTask({
  model: provider.video("happyhorse-1.0-video-edit"),
  prompt: "把画面转为赛博朋克风格",
  inputVideo: { url: "https://example.com/source.mp4" }, // 公开 http/https URL
  referenceImages: [], // 可选 0-5 张
  providerOptions: { aliyun: { resolution: "720P", audio_setting: "auto" } },
});

const result = await t2v.wait({ pollIntervalMs: 15_000, timeoutMs: 600_000 });
console.log(result.content); // VideoContent[]
```

| 模式       | 模型                        | 必需输入                            | 可选输入                 | 专属参数差异                                                        |
| ---------- | --------------------------- | ----------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| t2v        | `happyhorse-1.1-t2v`        | `prompt`                            | —                        | `resolution` 480P/720P/1080P、`ratio`、`duration`                   |
| i2v        | `happyhorse-1.1-i2v`        | `prompt` + `firstFrame`             | —                        | 无 `ratio`（自动跟随首帧）                                          |
| r2v        | `happyhorse-1.1-r2v`        | `prompt` + `referenceImages`（1-9） | —                        | `ratio` 可显式指定                                                  |
| video-edit | `happyhorse-1.0-video-edit` | `prompt` + `inputVideo`             | `referenceImages`（0-5） | `resolution` 仅 720P/1080P，`audio_setting` 替代 `ratio`/`duration` |

`t2v`/`i2v`/`r2v` 的 `providerOptions.aliyun` 支持 `resolution`、`ratio`（`16:9` `9:16` `1:1` `4:3` `3:4` `4:5` `5:4` `9:21` `21:9`）、`duration`、`watermark`、`seed`；video-edit 支持 `resolution`、`watermark`、`seed`、`audio_setting`（`auto` / `origin`）。

## provider 专属图像参数

图像请求的 Aliyun 专属字段放在 `providerOptions.aliyun` 命名空间下，按模型家族转发：

| 字段                 | 适用范围            | 说明                                                         |
| -------------------- | ------------------- | ------------------------------------------------------------ |
| `negative_prompt`    | Qwen + `wan2.6-t2i` | 负向提示词                                                   |
| `prompt_extend`      | Qwen + `wan2.6-t2i` | 智能改写 prompt（API 默认开启）                              |
| `prompt_extend_mode` | Qwen + `wan2.6-t2i` | `direct`（默认）/ `agent`（仅 T2I）                          |
| `watermark` / `seed` | 全部                | 水印 / 复现种子（0-2147483647）                              |
| `thinking_mode`      | Wan 2.7             | 推理模式（默认 true；需关闭 `enable_sequential` 且无图输入） |
| `color_palette`      | Wan 2.7             | 自定义色彩主题（3-10 个 `{hex, ratio}`，ratio 合计 100%）    |
| `enable_sequential`  | Wan 2.7             | 组图连拍模式                                                 |
| `bbox_list`          | Wan 2.7             | 交互式编辑包围框 `[x1, y1, x2, y2]`                          |

```ts
const result = await generateImage({
  model: provider.image("qwen-image-2.0-pro"),
  prompt: "江南小镇的清晨",
  providerOptions: {
    aliyun: { negative_prompt: "人物", watermark: false, seed: 42 },
  },
});
```

## 本地文件输入

配合 `@ai-media/uploader/aliyun` 可将本地文件上传为 DashScope 临时 `oss://` URL。当请求中出现 `oss://` URL 时，本 Provider 会自动注入 `X-DashScope-OssResourceResolve: enable` 请求头，无需手动处理：

```ts
import { createAliyunUploader } from "@ai-media/uploader/aliyun";

const uploader = createAliyunUploader({ apiKey: "<your-api-key>" });
const uploaded = await uploader.upload({
  model: "qwen-image-2.0-pro", // 必须与下游生成调用的模型一致
  filePath: "./input.png",
});

const edited = await editImage({
  model: provider.image("qwen-image-2.0-pro"),
  prompt: "把画面改成雪天",
  images: [{ url: uploaded.url }],
});
```

## 其他

```ts
for (const model of provider.listModels()) {
  console.log(model.id, model.modality, model.capabilities);
}
```

## 注意事项

- 任务 ID 与结果 URL 为临时资源（约 24 小时过期），请及时下载并持久化结果。
- 临时上传的 `oss://` URL 48 小时过期，仅供开发测试；生产请使用持久存储。
- 错误统一为 `@ai-media/sdk` 的 `SdkError`，错误信息不包含凭据；未知模型 id 抛出 `UNKNOWN_MODEL`。

## License

MIT
