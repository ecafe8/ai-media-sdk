# @ai-media/uploader

[![npm version](https://img.shields.io/npm/v/@ai-media/uploader.svg)](https://www.npmjs.com/package/@ai-media/uploader)
[![npm downloads](https://img.shields.io/npm/dm/@ai-media/uploader.svg)](https://www.npmjs.com/package/@ai-media/uploader)
[![License](https://img.shields.io/npm/l/@ai-media/uploader.svg)](https://github.com/ecafe8/ai-media-sdk/blob/main/packages/uploader/LICENSE)

AI Provider 输入文件的临时上传辅助。将本地文件或字节流上传为 Provider 可接受的临时 URL，供图像/视频生成调用引用。

> **定位**：开发/测试便利工具。各平台临时 URL 均有有效期与配额限制，生产环境请使用自有持久存储。
>
> **注意**：本项目处于快速迭代期间，API 可能随时变更，生产使用请锁定版本。

## 安装

```bash
npm install @ai-media/uploader
```

运行时要求：Node.js >= 20（或 Bun），ESM-only。上传实现依赖 Node 内置模块读取本地文件，适用于服务端环境。

## 子路径导出

| 导入路径                    | 内容                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `@ai-media/uploader`        | 通用类型与错误（同 `./core`）                                              |
| `@ai-media/uploader/core`   | `UploadedFile`、`UploaderOptions`、`UploaderError`、`UPLOADER_ERROR_CODES` |
| `@ai-media/uploader/aliyun` | `createAliyunUploader` — DashScope 临时文件上传                            |
| `@ai-media/uploader/google` | `createGoogleUploader` — Gemini Files API 上传与生命周期                   |

## Aliyun（DashScope 临时上传）

三步流程（获取上传凭证 → OSS 直传 → 返回 `oss://` URL），凭据通过 `apiKey` 传入：

```ts
import { createAliyunUploader } from "@ai-media/uploader/aliyun";

const uploader = createAliyunUploader({
  apiKey: "<your-dashscope-api-key>",
  // baseUrl 可选，默认 https://dashscope.aliyuncs.com
  // timeoutMs 可选，默认 30_000
});

const uploaded = await uploader.upload({
  model: "qwen-image-2.0-pro", // 必填：DashScope 将文件绑定到模型，
  // 必须与下游生成调用的模型一致
  filePath: "./input.png", // 本地文件路径
  // 或内存字节：fileBytes: new Uint8Array(...), fileName: "input.png"
});

console.log(uploaded.url); // oss://...
console.log(uploaded.expiresAt); // 48 小时后过期
```

- 返回的 `requiresHeaders` 声明了下游调用需要的 `X-DashScope-OssResourceResolve: enable` 请求头；使用 `@ai-media/provider-aliyun-bailian` 时，适配器检测到 `oss://` URL 会**自动注入**该请求头，无需手动处理。
- 凭证接口限流：每账号 + 模型 100 QPS；临时 URL 48 小时过期。

与 SDK 配合（上传后作为编辑输入）：

```ts
import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import { editImage } from "@ai-media/sdk";

const provider = createAliyunBailianProvider({
  apiKey: "<your-dashscope-api-key>",
  baseUrl: "https://<WorkspaceId>.cn-beijing.maas.aliyuncs.com/api/v1",
});

const result = await editImage({
  model: provider.image("qwen-image-2.0-pro"),
  prompt: "把画面改成雪天",
  images: [{ url: uploaded.url }],
});
```

## Google（Gemini Files API）

可续传协议上传，返回标准 `https://` URL，并提供文件生命周期管理：

```ts
import { createGoogleUploader } from "@ai-media/uploader/google";

const uploader = createGoogleUploader({
  apiKey: "<your-gemini-api-key>",
  // baseUrl 可选，默认 https://generativelanguage.googleapis.com
});

const uploaded = await uploader.upload({
  filePath: "./input.png",
  // 或内存字节：fileBytes + fileName + mimeType（fileBytes 时 mimeType 必填）
  displayName: "input.png", // 可选
});

console.log(uploaded.url); // 传给模型的 https URL
console.log(uploaded.name); // 文件资源 id，如 files/abc，用于 get/delete
console.log(uploaded.state); // PROCESSING / ACTIVE / FAILED
console.log(uploaded.expiresAt); // 48 小时后过期

const meta = await uploader.get(uploaded.name);
for await (const file of uploader.list()) {
  console.log(file.name, file.state);
}
await uploader.delete(uploaded.name);
```

限制：单文件最大 2GB，单项目存储上限 20GB，文件 48 小时自动过期。

## 通用结果与错误

所有上传结果都实现通用 `UploadedFile` 形状：

```ts
interface UploadedFile {
  url: string; // 传给模型的临时 URL
  mimeType?: string;
  sizeBytes?: number;
  expiresAt?: Date; // 平台声明的过期时间
  requiresHeaders?: Record<string, string>; // 下游调用需携带的请求头
}
```

失败统一抛出 `UploaderError`，携带稳定 `code` 与上游 `statusCode`（如适用）：

`INVALID_REQUEST` / `POLICY_ERROR` / `UPLOAD_ERROR` / `RATE_LIMITED` / `NOT_FOUND` / `INVALID_RESPONSE` / `UNKNOWN`

```ts
import { UploaderError } from "@ai-media/uploader";

try {
  await uploader.upload({
    model: "qwen-image-2.0-pro",
    filePath: "./input.png",
  });
} catch (error) {
  if (error instanceof UploaderError) {
    console.error(error.code, error.message);
  }
}
```

## License

MIT
