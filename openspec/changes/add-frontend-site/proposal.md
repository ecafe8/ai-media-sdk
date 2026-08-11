## Why

现有 Playground（`apps/web`）是服务端代理架构：Provider 凭证与生成请求都经 Next.js 服务端中转，部署到 Vercel 后体验者要么依赖部署者的环境变量、要么自带 Key 经服务端转发，且请求体受 Vercel 4.5MB 限制、图片无法直传。实测确认三家 Provider 的生成接口均支持浏览器 CORS（DashScope/Ark 反射任意 Origin 并允许 `authorization` 头；Azure 返回 `*` 并允许 `api-key`），且 `@ai-media/sdk` 与三家 provider 包仅依赖原生 `fetch`、可直接运行在浏览器。因此可以新增一个零服务端的纯前端站点：体验者自带 Key、浏览器直连模型方、图片以 base64 内联发送，部署到免费的 GitHub Pages，作为 SDK 的公开 Landing + 体验入口。

## What Changes

- 新增工作区 `apps/site`：Vite + React 19 纯前端 SPA，包含 Landing 页（hero、特性、由 `PLAYGROUND_MODELS` 注册表生成的模型矩阵、隐私说明）与 Playground 页（从 `apps/web` 复制改造的图像/视频工作台）。
- 浏览器直连 Provider：客户端 executor 直接调用 `generateImage`/`editImage`/`submitImageTask`/`submitVideoTask`（含异步任务浏览器侧轮询），凭证由体验者在设置面板一次填写、持久化到 localStorage，仅发送至经过校验的对应 Provider 端点，不经过任何服务器；自定义端点必须显式确认风险。
- 图片输入支持本地文件：图生图参考图、i2v 首帧为单值"URL + 上传"混合控件；r2v 参考图由逗号分隔 textarea 改为有序卡片列表（上传/粘贴 URL/批量粘贴，顺序即 `[Image N]`）。涉及的图片输入路径以 `{ base64, mimeType }` 经 SDK `ImageContent` 通道发送；Azure 图像编辑当前未实现，video-edit 源视频不属于 base64 图片输入范围。
- 新增 OPFS 媒体缓存：文件原始字节写入 Origin Private File System（`<sha256>.<ext>`），IndexedDB 仅存元数据与缩略图；按内容哈希去重，复用时按需读取并在请求前才转 base64；LRU 容量淘汰；OPFS 不可用时降级为内存级缓存。
- video-edit 源视频维持公网 URL 粘贴（DashScope 视频输入契约仅接受公网 URL，OSS 直传被 CORS 阻断）；上传管线预留 video MIME 口子。
- 新增 GitHub Pages 部署：GitHub Actions 工作流（push main / 手动触发），Vite base path 可配置（默认 `/ai-media-sdk/`），SPA 路由以 404.html 兜底。
- `apps/web` 保持不动，两种形态互补（服务端代理受控环境 / 纯前端 BYO 公开体验）。

## Capabilities

### New Capabilities

- `site-shell`: 纯前端站点的 Landing 页与 Playground 页外壳——SPA 路由（含项目站点 basename）、Landing 内容（特性/模型矩阵/隐私说明）、Playground 头部与模式切换、BYO 环境的文案与状态标识。
- `byo-key-store`: 体验者自带 Provider 凭证的浏览器持久化——三家 Provider 的字段集、localStorage 外部 store、configured 状态推导、密钥不落日志与不跨站泄露的约束。
- `direct-provider-execution`: 浏览器直连 Provider 的请求执行——provider 实例化、图像/视频生成与异步任务轮询、错误分类与用户文案映射、凭证缺失时的引导。
- `media-file-cache`: OPFS 文件字节仓库 + IndexedDB 元数据的本地媒体缓存——内容哈希去重、缩略图、LRU 淘汰、按需读取转 base64、不可用环境降级。
- `playground-media-input`: 图片输入控件——单值 URL/上传混合控件与 r2v 有序卡片列表、大小上限校验、来源标记、缓存命中复用交互。
- `site-deployment`: GitHub Pages 发布——Actions 工作流、base path 配置、SPA 路由 404 兜底、构建产物要求。

### Modified Capabilities

（无。`apps/web` 及现有 `playground-*` 能力保持不变。）

## Impact

- 新增工作区：`apps/site/`（`package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`、`src/`、`tests/`）；依赖 `@ai-media/sdk`、`@ai-media/provider-*`、`@workspace/ui`、`react-router-dom`、`lucide-react`；代码质量检查由仓库根目录 Biome 统一负责。
- 新增 `.github/workflows/deploy-site.yml`；仓库 Settings 需启用 GitHub Pages（GitHub Actions 源）。
- 复用 `examples/uploader-web` 的 Vite 源码别名方案消费 `@workspace/ui` 与 `@ai-media/*` 源码；turbo 任务（build/lint/typecheck/test/dev）经 `apps/*` workspace 自动接入，根 README 补充站点说明。
- 不改动 `packages/*`、`apps/web`、`examples/*` 的现有代码；不引入 Node 运行时代码到浏览器产物（`@ai-media/uploader` 不被该应用引用）。
- 安全面：体验者 Key 仅存其浏览器并直发 Provider；站点为纯静态资源，无任何服务端。
