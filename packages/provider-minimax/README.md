# @ai-media/provider-minimax

[![npm version](https://img.shields.io/npm/v/@ai-media/provider-minimax.svg)](https://www.npmjs.com/package/@ai-media/provider-minimax)
[![npm downloads](https://img.shields.io/npm/dm/@ai-media/provider-minimax.svg)](https://www.npmjs.com/package/@ai-media/provider-minimax)
[![License](https://img.shields.io/npm/l/@ai-media/provider-minimax.svg)](https://github.com/ecafe8/ai-media-sdk/blob/main/packages/provider-minimax/LICENSE)

[AI Media SDK](../ai-media-sdk/README.md) 的 MiniMax（海螺）Provider，当前支持 MiniMax-H3 视频生成。基于原生 `fetch` 直接调用 MiniMax V2 REST API，不依赖平台 SDK。

> **注意**：本项目处于快速迭代期间，API 可能随时变更，生产使用请锁定版本。

## 安装

```bash
npm install @ai-media/sdk @ai-media/provider-minimax
```

运行时要求：Node.js >= 20（或 Bun），ESM-only。

## 配置

通过 `createMiniMaxProvider(config)` 传入配置对象：

```ts
import { createMiniMaxProvider } from "@ai-media/provider-minimax";

const provider = createMiniMaxProvider({
  /** MiniMax API key，作为 `Authorization: Bearer` 凭据发送 */
  apiKey: "<your-api-key>",
  /** 可选；默认 https://api.minimax.io */
  baseUrl: "https://api.minimax.io",
});
```

## 视频生成（MiniMax-H3：异步任务）

MiniMax-H3 为异步模型：`submitVideoTask` 提交任务后返回 `TaskHandle`，轮询 `GET /v2/query/video_generation/{task_id}` 直至终态。单个模型 id 覆盖全部场景，场景由输入媒体决定：

- **文生视频（t2v）**：仅 `prompt`，`ratio` 必填且不能为 `adaptive`；
- **图生视频（i2v）**：`prompt` + `firstFrame`（可选 `lastFrame` 组成首尾帧），宽高比固定 `adaptive`；
- **参考生视频（r2v）**：`prompt` + `referenceImages`（≤9）/ `referenceVideos`（≤3）/ `referenceAudios`（≤3）任意组合，`ratio` 缺省 `adaptive`。

i2v 的首尾帧与 r2v 的参考媒体互斥，不能混用。

```ts
import { submitVideoTask } from "@ai-media/sdk";

// 文生视频（t2v）
const t2v = await submitVideoTask({
  model: provider.video("MiniMax-H3"),
  prompt: "海边打篮球的少年，夕阳逆光",
  providerOptions: {
    minimax: { resolution: "2K", duration: 5, ratio: "16:9" },
  },
});
const result = await t2v.wait({ pollIntervalMs: 15_000, timeoutMs: 600_000 });
console.log(result.content[0]?.url); // 临时 URL，请尽快下载保存

// 图生视频（i2v 首帧）
const i2v = await submitVideoTask({
  model: provider.video("MiniMax-H3"),
  prompt: "让画面动起来，背景增加蒸汽",
  firstFrame: { url: "https://example.com/first.png" },
  providerOptions: { minimax: { resolution: "2K", duration: 5 } },
});

// 首尾帧（i2v first & last frame）
const frames = await submitVideoTask({
  model: provider.video("MiniMax-H3"),
  prompt: "在两帧之间平滑过渡",
  firstFrame: { url: "https://example.com/first.png" },
  lastFrame: { url: "https://example.com/last.png" },
  providerOptions: { minimax: { resolution: "768P", duration: 6 } },
});

// 参考生视频（r2v：参考图 + 参考视频 + 参考音频）
const r2v = await submitVideoTask({
  model: provider.video("MiniMax-H3"),
  prompt: "角色说话：随风而行，活在当下。音色跟随参考音频 1。",
  referenceImages: [{ url: "https://example.com/ref.png" }],
  referenceVideos: [{ url: "https://example.com/ref.mp4", duration: 4 }],
  referenceAudios: [{ url: "https://example.com/ref.mp3", duration: 3 }],
  providerOptions: {
    minimax: { resolution: "2K", duration: 5, ratio: "9:16" },
  },
});
```

图片输入支持公网 URL 或 base64（自动转为 `data:` URI）；参考视频/音频仅支持公网 URL，单个时长 2-15 秒、合计不超过 15 秒（提供 `duration` 元数据时在客户端校验）。

## providerOptions.minimax

| 字段          | 必填 | 说明                                                                  |
| ------------- | ---- | --------------------------------------------------------------------- |
| `resolution`  | ✅   | `768P` / `2K`                                                          |
| `duration`    | ✅   | 输出时长（秒），`4`-`15` 整数                                          |
| `ratio`       | ❌   | `adaptive`/`21:9`/`16:9`/`4:3`/`1:1`/`3:4`/`9:16`；t2v 必填且非 adaptive |
| `callbackUrl` | ❌   | 任务状态回调地址（透传，挑战验证需自行实现）                            |

## 模型一览

| 模型          | 调用方式 | 生成 | 编辑 | 场景                       |
| ------------- | -------- | ---- | ---- | -------------------------- |
| `MiniMax-H3`  | 异步     | ✅   | ❌   | t2v / i2v 首尾帧 / r2v     |

## 错误处理

非 2xx 响应解析 MiniMax 的 OpenAI 风格错误体并分类：401/403 → `AUTH_ERROR`，429 → `RATE_LIMITED`（可重试），400/422 → `INVALID_REQUEST`，402（余额不足）与 5xx → `PROVIDER_ERROR`；网络/超时失败映射为 `NETWORK_ERROR`/`TIMEOUT`。所有对外错误信息均会脱敏 API key。

任务状态映射：`queued → pending`、`running → running`、`succeeded`、`failed`、`cancelled`；成功后从 `task.content.url` 取视频 URL（带 `duration` 元数据），`raw` 携带 `task.usage`。

## 限制

- 不支持任务取消/删除端点（SDK 暂无 cancel 契约）。
- 不支持 H3-Context-IR 与视频再生（regeneration）端点。
- Playground（apps/web、apps/site）集成将在后续变更中提供。
