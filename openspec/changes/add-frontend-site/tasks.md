## 1. 工作区脚手架

- [ ] 1.1 创建 `apps/site/package.json`（私有工作区，deps：`@ai-media/sdk`、三家 `@ai-media/provider-*`、`@workspace/ui`、`react`、`react-dom`、`react-router-dom`、`lucide-react`；devDeps 对齐 `examples/uploader-web`：`vite`、`@vitejs/plugin-react`、`@tailwindcss/postcss`、`@workspace/typescript-config`；scripts：`dev`/`build`/`preview`/`typecheck`/`test`，代码质量检查由根目录 Biome 统一负责）。
- [ ] 1.2 创建 `apps/site/vite.config.ts`：复用 `examples/uploader-web` 的源码别名方案（`@workspace/ui/*`、`@ai-media/*` 指向包源码）；`base` 从唯一环境变量注入（默认 `/ai-media-sdk/`，本地 dev 用 `/`）；`build.outDir: "dist"`。
- [ ] 1.3 创建 `tsconfig.json`（继承 `@workspace/typescript-config` 的浏览器/DOM 配置）、`postcss.config.mjs`、`index.html`、`src/main.tsx`（挂载 Router + 主题/样式入口）；Biome 使用仓库根配置，不创建 workspace 级 ESLint 配置。
- [ ] 1.4 根目录执行 `bun install`，确认 turbo 能发现 `site` 工作区且 `bun run --cwd apps/site dev` 可启动空白页。

## 2. 数据层：Key Store 与 Provider 客户端

- [ ] 2.1 实现 `src/lib/key-store.ts`：三家 Provider 凭证字段集常量；`useSyncExternalStore` 外部 store（localStorage 持久化、跨 tab `storage` 事件、服务端快照为空对象）；读取净化（丢弃非法 provider/字段）；`setCredentials`/`clearCredentials`；`isCredentialsComplete(provider, credentials)` 完整性判断（与 `apps/web` 解析规则一致）；默认 host allowlist、HTTPS/端口/路径校验、自定义端点显式风险确认状态。
- [ ] 2.2 实现 `src/lib/provider-client.ts`：按存储凭证实例化 provider（`createAzureOpenAIProvider`/`createAliyunBailianProvider`/`createSeedreamProvider`，transport 超时对齐 Playground 常量）；导出 `getConfiguredProviders()`（由 key store 推导）；实例化前和请求前都校验最终端点。
- [ ] 2.3 单测：key-store 净化逻辑、完整性判断、凭证按 provider 隔离（不串用）、恶意 endpoint/非法协议/非默认 host 确认流程。

## 3. 数据层：客户端执行器

- [ ] 3.1 实现 `src/lib/executor.ts`：客户端版 `executePlaygroundRequest`——校验 provider 已配置（未配置本地拦截返回凭证缺失引导，不发网络请求）；图像同步生成/编辑、异步任务（`submitImageTask`/`submitVideoTask` + `task.wait`）；视频仅允许 `aliyun-bailian`；错误码映射为用户文案（认证/限流/超时/网络/无效请求/未知）。
- [ ] 3.2 从三家 provider 包的 registry 生成站点自己的最小 model projection 到 `src/lib/playground/`，不得复制完整 `apps/web/lib/playground/registry.ts`；`configured` 由 key store 推导，保留模型能力元数据和 UI 标签；首期排除 `wan3.0-video`，与 `apps/web` 的 `ALIYUN_PLAYGROUND_EXCLUDED` 保持一致，待异构 `media[]` UI 另行实现。
- [ ] 3.3 单测：执行器的本地拦截逻辑（未配置 provider 不产生 fetch）、视频 provider 限制、错误映射表。

## 4. 媒体缓存（OPFS + IndexedDB）

- [ ] 4.1 实现 `src/lib/media-cache.ts`：OPFS 目录管理，文件以 `<sha256>.<ext>` 写入；`crypto.subtle` 内容哈希；IndexedDB 元数据 store（`{hash, opfsName, schemaVersion, name, mime, size, thumb, addedAt, lastUsedAt}`）；`store(file)`（哈希去重，命中不重写）、`list()`（按 lastUsedAt 倒序）、`get(hash)`→`File`、`remove(hash)`、`clear()`；启动时校验元数据对应 OPFS 文件是否存在并清理孤儿条目。
- [ ] 4.2 实现缩略图生成（canvas 压缩至 ~96px，data URL 存元数据）与按需 base64 读取（`fileToBase64(file)`，仅在构造请求时调用）。
- [ ] 4.3 实现容量管理：条目数/总字节双上限（100 条 / 500MB），LRU 淘汰（同时删 OPFS 字节与元数据）。
- [ ] 4.4 fail-soft：OPFS/IndexedDB 不可用、配额不足或 `navigator.storage.persist()` 被拒绝时降级为内存 Map 会话缓存，所有公开方法不抛未处理异常，并向 UI 暴露“缓存可能被浏览器回收”的状态。
- [ ] 4.5 单测：LRU 淘汰纯逻辑、哈希去重判定、fail-soft 路径（bun 环境无 OPFS 时走内存降级）。

## 5. 媒体输入组件

- [ ] 5.1 实现 `src/components/image-source-field/`（单值）：URL 输入 + 文件选择/拖拽；选中文件显示缩略预览、大小、来源徽标（上传/来自缓存）与移除；选择流程 = MIME/大小校验（5MB）→ 哈希 → 查缓存 → 未命中写缓存；值以明确的 `ImageInput = { url } | { base64, mimeType }` 形态向上暴露。
- [ ] 5.2 实现 `src/components/image-list-field/`（r2v 有序卡片列表）：卡片缩略图/来源/删除；多文件上传（逐张走缓存去重）；单条 URL 添加与批量粘贴入口（非法 URL 拒绝并提示）；`maxReferenceImages` 上限拦截；顺序即 `[Image N]`。
- [ ] 5.3 单测/组件测试：MIME/大小上限拦截、批量粘贴解析、上限计数、卡片顺序保持、单图与总 base64 估算载荷限制。

## 6. Playground 页面（复制改造 apps/web）

- [ ] 6.1 复制改造 `components/playground/` 工作台组件（image-workbench、video-workbench、result-feed、field、form-schema）：去除 `"use client"` 与 `/api` fetch，提交改调 `executor.ts`；明确将单值/list `ImageInput` 映射到 edit images、video firstFrame、video referenceImages；URL 校验同时接受 http(s) 与已选文件形态。
- [ ] 6.2 实现 `src/components/settings-dialog/`：三家 Provider 凭证表单（字段集同 2.1）、隐私提示（Key 仅存浏览器、直发 Provider）、清除按钮；由 Playground 头部"API 设置"入口打开。
- [ ] 6.3 组装 Playground 页：头部标识与环境状态（无 Key 时引导设置）、模态 tab（图像/视频/音频置灰）、`configured` 由 key store + 模型注册表推导、页脚隐私文案；图片输入字段接入第 5 节控件；video-edit 源视频保持 URL-only 并附说明。

## 7. 结果保存

- [ ] 7.1 实现 `src/lib/result-storage.ts`：检测 `showDirectoryPicker` 能力；Chrome/Edge 支持目录选择；目录句柄存 IndexedDB；提供权限查询、重新授权、取消授权与句柄失效清理。
- [ ] 7.2 实现结果文件保存：生成前在右侧 `ResultPanel` 顶部显示临时 URL 提示与“选择本地保存目录/暂不选择，继续生成”；目录授权后生成结果自动保存，不要求每次点击；图片/视频按时间和类型命名，冲突自动追加序号。
- [ ] 7.3 实现保存失败处理：Provider 结果 URL `fetch`/CORS 失败、目录权限失效、写入失败时保留临时预览，显示失败原因并提供重新选择目录入口；不阻止生成结果展示。
- [ ] 7.4 实现不兼容浏览器告警：不支持 `showDirectoryPicker` 时提示使用最新版 Chrome 或 Edge，隐藏目录选择流程但允许继续生成；不做 Firefox/Safari 目录兼容后端。
- [ ] 7.5 将保存设置固定在右侧生成结果面板顶部，左侧只保留 Provider、模型、提示词、尺寸、数量、高级参数与媒体输入；补充单测：能力检测、句柄状态、文件名冲突、权限失效与自动保存状态。

## 8. Landing 页与路由

- [ ] 8.1 实现 `src/pages/landing/`：hero、核心特性、模型矩阵（由 `PLAYGROUND_MODELS` 按 Provider 分组渲染能力标记）、隐私说明、进入 Playground 的 CTA、仓库链接。
- [ ] 8.2 配置 `react-router-dom`（`/` 与 `/playground`），Router basename 从 Vite `BASE_URL` 派生；验证根路径、项目子路径、前进/后退、页面内导航与刷新深链。

## 9. 测试与质量

- [ ] 9.1 补齐 `apps/site/tests/` 其余用例，`bun test` 全绿。
- [ ] 9.2 根目录 `bun run lint`（Biome）、`bun run typecheck`（apps/site 范围）通过；使用根目录 `bun run format` 格式化全部新文件。

## 10. 部署

- [ ] 10.1 构建脚本：`vite build` 后将 `dist/index.html` 复制为 `dist/404.html`（SPA 深链兜底），并检查两个文件存在、资源使用同一 base path。
- [ ] 10.2 创建 `.github/workflows/deploy-site.yml`：push main 与 `workflow_dispatch` 触发；声明 `contents: read`、`pages: write`、`id-token: write`；bun install → `bunx turbo build --filter=site` → 检查 artifact 含 `index.html`/`404.html` → `actions/upload-pages-artifact`（路径 `apps/site/dist`）→ `actions/deploy-pages`；base path 经唯一环境变量注入并配置并发取消旧发布。
- [ ] 10.3 根 README 增加站点章节：访问地址、BYO Key 说明、GH Pages 启用步骤（Settings → Pages → GitHub Actions 源）、base path 修改方法。

## 11. 端到端验证

- [ ] 11.1 根目录全量 `bun run lint && bun run typecheck && bun run build && bun run test` 通过（provider 包既有 test-d 失败与本变更无关，需确认不新增失败）。
- [ ] 11.2 `vite preview` + 浏览器冒烟：真实 Key 走通 Bailian 生图、Seedream 生图、视频异步任务轮询；验证恶意/自定义 endpoint 确认；本地图片上传 → 生成 → 重选同文件命中缓存（显示“来自缓存”）→ 刷新页面缓存仍在；验证项目子路径 `/ai-media-sdk/playground` 深链、刷新、chunk/样式/图片全部成功。
- [ ] 11.3 Chrome/Edge 冒烟：生成前在右侧结果面板选择目录，生成图片/视频后确认自动写入、重名处理、刷新后句柄复用、权限失效重新授权；验证不兼容浏览器只显示告警。
- [ ] 11.4 按仓库约定提交 commit 并报告哈希；GH Pages 首发由用户在仓库 Settings 启用后触发。
