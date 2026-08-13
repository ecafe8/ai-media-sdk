# AI Media SDK

多 Provider 多模态生成 SDK（图像 + 视频）。统一的 Provider 工厂、模型实例与任务抽象，屏蔽各平台在认证、同步/异步流程、输入输出格式和错误语义上的差异。基于 Bun + Turborepo monorepo 开发。

> **项目状态**
>
> 本项目当前是 vibe-coding 项目，且处于快速迭代期间，**API 可能随时发生变更**，暂不保证向后兼容。生产环境使用请务必锁定版本，并在升级前仔细核对变更。

## 包一览

以下 5 个包发布到 npm（`@ai-media` scope）：

| 包名                                | 说明                                               |
| ----------------------------------- | -------------------------------------------------- |
| `@ai-media/sdk`                     | Provider 无关的核心契约与图像/视频任务抽象         |
| `@ai-media/provider-azure-openai`   | Azure OpenAI 图像生成 Provider（同步 API）         |
| `@ai-media/provider-aliyun-bailian` | 阿里云百炼（DashScope）图像 + 视频 Provider        |
| `@ai-media/provider-volcengine`     | 火山引擎方舟（Doubao-Seedream）图像生成 Provider   |
| `@ai-media/provider-minimax`        | MiniMax（海螺）视频生成 Provider（异步 V2 API）    |
| `@ai-media/uploader`                | Provider 输入文件的临时上传辅助（Aliyun / Google） |

各包的使用说明见对应包目录下的 `README.md`。

## 快速开始

SDK 的调用模型是三层结构：**Provider 工厂 → 模型实例 → 生成函数**。所有配置（API Key、endpoint 等）都以参数对象传入，SDK 不读取任何运行时配置。

```bash
npm install @ai-media/sdk @ai-media/provider-azure-openai
```

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

console.log(result.content); // ImageContent[]，含 url 或 base64
```

异步模型（如阿里云 Wan 图像、HappyHorse 视频）使用 `submitImageTask` / `submitVideoTask` 提交任务，返回统一的 `TaskHandle`，通过 `handle.wait()` 轮询到终态。

## 可运行示例

示例应用位于 `examples/`。将对应目录下的 `.env.example` 复制为 `.env` 并填入服务端凭据后运行：

```bash
bun install

# Azure OpenAI 图像生成（同步）
cp examples/azure-image/.env.example examples/azure-image/.env
bun run --cwd examples/azure-image start

# 阿里云百炼图像生成（Qwen 同步 + Wan 异步）
cp examples/aliyun-bailian-image/.env.example examples/aliyun-bailian-image/.env
bun run --cwd examples/aliyun-bailian-image start

# 阿里云百炼视频生成（HappyHorse 四种模式）
cp examples/aliyun-video/.env.example examples/aliyun-video/.env
bun run --cwd examples/aliyun-video start

# 火山方舟 Doubao-Seedream 图像生成（同步）
cp examples/volcengine-image/.env.example examples/volcengine-image/.env
bun run --cwd examples/volcengine-image start

# 上传本地文件后作为编辑输入（Aliyun 临时上传）
cp examples/uploader-aliyun/.env.example examples/uploader-aliyun/.env
bun run --cwd examples/uploader-aliyun start

# 上传器 Web 示例（Vite + 本地 server）
bun run --cwd examples/uploader-web dev
```

图像示例默认提交一次请求、输出一张图，可通过命令行参数传入 prompt。缺少凭据时会在发起任何网络请求前失败，错误输出不包含凭据或 Provider 原始响应。

示例默认模型：阿里云图像示例默认 `qwen-image-2.0-pro-2026-06-22`（支持生成与编辑），可用 `ALIYUN_BAILIAN_IMAGE_MODEL` 覆盖；Wan 系列推荐 `wan2.7-image-pro`（高质量）与 `wan2.7-image`（均衡），走异步任务路径；火山方舟示例默认 `doubao-seedream-5-0-pro-260628`，可用 `VOLCENGINE_IMAGE_MODEL` 覆盖。

### 视频示例

阿里云视频示例通过 `ALIYUN_BAILIAN_VIDEO_MODEL` 支持四种 HappyHorse 模式：

- `happyhorse-1.1-t2v` — 文生视频（仅 prompt）。
- `happyhorse-1.1-i2v` — 首帧图生视频（一张图片 URL）。
- `happyhorse-1.1-r2v` — 参考图生视频（1-9 张参考图 URL；prompt 中用 `[Image N]` 按顺序指代各图）。
- `happyhorse-1.0-video-edit` — 源视频编辑（一个公开 `http:`/`https:` 视频 URL + 0-5 张可选参考图 URL；支持 `audio_setting` 取 `auto`/`origin`；不接受 `ratio` 或 `duration`）。

r2v 与 video-edit 的输入通过环境变量提供：

- `ALIYUN_BAILIAN_REFERENCE_IMAGE_URLS` — 逗号分隔的参考图 URL。
- `ALIYUN_BAILIAN_FIRST_FRAME_URL` — i2v 首帧图 URL（未设置时回退到第一张参考图）。
- `ALIYUN_BAILIAN_INPUT_VIDEO_URL` — 公开的源视频 URL（不支持 base64 或本地文件）。

任务 ID 与结果 URL 在 24 小时后过期，下载与持久化由调用方负责。

## 受控 Web Playground

运行 `bun run dev` 并打开 `http://localhost:3000`。Playground 是受控的开发工具，不是面向公众的多租户服务：浏览器端只向 Next.js 服务端路由发送 prompt 与模型参数，Provider API Key 从服务端环境变量读取，绝不进入浏览器。

UI 支持已配置 Provider 的文生图，以及能力注册表支持编辑的模型的 URL 参考图输入；已配置的阿里云模型还提供视频模式（t2v/i2v/r2v/video-edit）。结果为临时远程预览，prompt、图片、任务与结果均不作为历史存储。

## 公开体验站点（apps/site）

`apps/site` 是纯前端的 Landing + Playground 站点（Vite + React），部署在 GitHub Pages，无任何服务端：

- 体验者在浏览器填写自己的 Provider API Key（仅存 localStorage，直连 Provider，不经任何中间服务器）。
- 图片输入支持本地文件：按内容哈希缓存于浏览器（OPFS），复用时免重复选择，发送请求时才编码。
- 生成结果可自动保存到体验者选择的本地目录（基于 File System Access API，建议最新版 Chrome/Edge）。

```bash
bun run --cwd apps/site dev      # 本地开发（http://localhost:5174）
bun run --cwd apps/site build    # 构建到 apps/site/dist（含 404.html SPA 兜底）
bun run --cwd apps/site preview  # 预览构建产物
```

GitHub Pages 部署由 `.github/workflows/deploy-site.yml` 完成（push 到 main 或手动触发）。首次使用需在仓库 Settings → Pages 将 Source 设为 GitHub Actions。资源 base path 由 `VITE_SITE_BASE` 环境变量注入（workflow 默认取 `/<仓库名>/`），Router basename 与之一致；本地 dev 使用根路径。

## 开发

环境要求：Bun `1.3.14`、Node.js `>=20`。

```bash
bun install          # 安装依赖（根 bun.lock 为唯一事实来源）
bun run dev          # 启动 apps/web Playground（http://localhost:3000）
bun run lint         # 全仓库 lint（Biome）
bun run typecheck    # 全仓库类型检查
bun run build        # 全仓库构建
bun run test         # 全仓库测试
bun run format       # Biome 格式化
bun run docs         # 基于 docs/ 生成文档
```

单个工作区任务可用 `bunx turbo <task> --filter=<workspace>` 或 `bun run --cwd <workspace> <task>` 执行。

npm 发布流程见 `scripts/RELEASE.md`。

## 目录结构

```
apps/web                # Next.js 受控 Playground（凭据仅在服务端）
apps/site               # 纯前端公开体验站点（BYO Key，GitHub Pages）
packages/ai-media-sdk   # 核心契约与任务抽象（@ai-media/sdk）
packages/provider-*     # Provider 适配器（原生 fetch，不依赖平台 SDK）
packages/uploader       # 上传实现（@ai-media/uploader）
packages/ui             # 共享 UI（仅仓库内部使用，不发布）
examples/*              # 可运行的 Provider / 上传器示例
docs/prd                # 产品需求文档
scripts                 # 发布脚本与发布流程文档
```
