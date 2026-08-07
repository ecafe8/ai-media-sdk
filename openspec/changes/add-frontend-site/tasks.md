## 1. 工作区脚手架

- [ ] 1.1 创建 `apps/site/package.json`（私有工作区，deps：`@ai-media/sdk`、三家 `@ai-media/provider-*`、`@workspace/ui`、`react`、`react-dom`、`react-router`、`lucide-react`；devDeps 对齐 `examples/uploader-web`：`vite`、`@vitejs/plugin-react`、`@tailwindcss/postcss`、`@workspace/eslint-config`、`@workspace/typescript-config`；scripts：`dev`/`build`/`preview`/`lint`/`format`/`typecheck`/`test`）。
- [ ] 1.2 创建 `apps/site/vite.config.ts`：复用 `examples/uploader-web` 的源码别名方案（`@workspace/ui/*`、`@ai-media/*` 指向包源码）；`base` 从环境变量注入（默认 `/ai-media-sdk/`，本地 dev 用 `/`）；`build.outDir: "dist"`。
- [ ] 1.3 创建 `tsconfig.json`（继承 `@workspace/typescript-config` 适配浏览器/DOM）、`eslint.config.js`（对齐 `apps/web`）、`postcss.config.mjs`、`index.html`、`src/main.tsx`（挂载 Router + 主题/样式入口）。
- [ ] 1.4 根目录执行 `bun install`，确认 turbo 能发现 `site` 工作区且 `bun run --cwd apps/site dev` 可启动空白页。

## 2. 数据层：Key Store 与 Provider 客户端

- [ ] 2.1 实现 `src/lib/key-store.ts`：三家 Provider 凭证字段集常量；`useSyncExternalStore` 外部 store（localStorage 持久化、跨 tab `storage` 事件、服务端快照为空对象）；读取净化（丢弃非法 provider/字段）；`setCredentials`/`clearCredentials`；`isCredentialsComplete(provider, credentials)` 完整性判断（与 `apps/web` 解析规则一致）。
- [ ] 2.2 实现 `src/lib/provider-client.ts`：按存储凭证实例化 provider（`createAzureOpenAIProvider`/`createAliyunBailianProvider`/`createSeedreamProvider`，transport 超时对齐 Playground 常量）；导出 `getConfiguredProviders()`（由 key store 推导）。
- [ ] 2.3 单测：key-store 净化逻辑、完整性判断、凭证按 provider 隔离（不串用）。

## 3. 数据层：客户端执行器

- [ ] 3.1 实现 `src/lib/executor.ts`：客户端版 `executePlaygroundRequest`——校验 provider 已配置（未配置本地拦截返回凭证缺失引导，不发网络请求）；图像同步生成/编辑、异步任务（`submitImageTask`/`submitVideoTask` + `task.wait`）；视频仅允许 `aliyun-bailian`；错误码映射为用户文案（认证/限流/超时/网络/无效请求/未知）。
- [ ] 3.2 复制 `apps/web/lib/playground/{types.ts,registry.ts}` 到 `src/lib/playground/`，去除服务端专属字段（`configured` 改由 key store 推导，保留模型能力元数据）。
- [ ] 3.3 单测：执行器的本地拦截逻辑（未配置 provider 不产生 fetch）、视频 provider 限制、错误映射表。

## 4. 媒体缓存（OPFS + IndexedDB）

- [ ] 4.1 实现 `src/lib/media-cache.ts`：OPFS 目录管理，文件以 `<sha256>.<ext>` 写入；`crypto.subtle` 内容哈希；IndexedDB 元数据 store（`{hash, name, mime, size, thumb, addedAt, lastUsedAt}`）；`store(file)`（哈希去重，命中不重写）、`list()`（按 lastUsedAt 倒序）、`get(hash)`→`File`、`remove(hash)`、`clear()`。
- [ ] 4.2 实现缩略图生成（canvas 压缩至 ~96px，data URL 存元数据）与按需 base64 读取（`fileToBase64(file)`，仅在构造请求时调用）。
- [ ] 4.3 实现容量管理：条目数/总字节双上限（100 条 / 500MB），LRU 淘汰（同时删 OPFS 字节与元数据）。
- [ ] 4.4 fail-soft：OPFS/IndexedDB 不可用时降级为内存 Map 会话缓存，所有公开方法不抛未处理异常。
- [ ] 4.5 单测：LRU 淘汰纯逻辑、哈希去重判定、fail-soft 路径（bun 环境无 OPFS 时走内存降级）。

## 5. 媒体输入组件

- [ ] 5.1 实现 `src/components/image-source-field/`（单值）：URL 输入 + 文件选择/拖拽；选中文件显示缩略预览、大小、来源徽标（上传/来自缓存）与移除；选择流程 = 大小校验（5MB）→ 哈希 → 查缓存 → 未命中写缓存；值以 `{ url }` 或 `{ base64, mimeType }` 两种形态向上暴露。
- [ ] 5.2 实现 `src/components/image-list-field/`（r2v 有序卡片列表）：卡片缩略图/来源/删除；多文件上传（逐张走缓存去重）；单条 URL 添加与批量粘贴入口（非法 URL 拒绝并提示）；`maxReferenceImages` 上限拦截；顺序即 `[Image N]`。
- [ ] 5.3 单测/组件测试：大小上限拦截、批量粘贴解析、上限计数、卡片顺序保持。

## 6. Playground 页面（复制改造 apps/web）

- [ ] 6.1 复制改造 `components/playground/` 工作台组件（image-workbench、video-workbench、result-feed、field、form-schema）：去除 `"use client"` 与 `/api` fetch，提交改调 `executor.ts`；URL 校验同时接受 http(s) 与已选文件形态。
- [ ] 6.2 实现 `src/components/settings-dialog/`：三家 Provider 凭证表单（字段集同 2.1）、隐私提示（Key 仅存浏览器、直发 Provider）、清除按钮；由 Playground 头部"API 设置"入口打开。
- [ ] 6.3 组装 Playground 页：头部标识与环境状态（无 Key 时引导设置）、模态 tab（图像/视频/音频置灰）、`configured` 由 key store + 模型注册表推导、页脚隐私文案；图片输入字段接入第 5 节控件；video-edit 源视频保持 URL-only 并附说明。

## 7. Landing 页与路由

- [ ] 7.1 实现 `src/pages/landing/`：hero、核心特性、模型矩阵（由 `PLAYGROUND_MODELS` 按 Provider 分组渲染能力标记）、隐私说明、进入 Playground 的 CTA、仓库链接。
- [ ] 7.2 配置 react-router（`/` 与 `/playground`），验证前进/后退与页面内导航。

## 8. 测试与质量

- [ ] 8.1 补齐 `apps/site/tests/` 其余用例，`bun test` 全绿。
- [ ] 8.2 `bun run lint`、`bun run typecheck`（apps/site 范围）通过；`prettier` 格式化全部新文件。

## 9. 部署

- [ ] 9.1 构建脚本：`vite build` 后将 `dist/index.html` 复制为 `dist/404.html`（SPA 深链兜底）。
- [ ] 9.2 创建 `.github/workflows/deploy-site.yml`：push main 与 `workflow_dispatch` 触发；bun install → `bunx turbo build --filter=site` → `actions/upload-pages-artifact`（路径 `apps/site/dist`）→ `actions/deploy-pages`；base path 经环境变量注入。
- [ ] 9.3 根 README 增加站点章节：访问地址、BYO Key 说明、GH Pages 启用步骤（Settings → Pages → GitHub Actions 源）、base path 修改方法。

## 10. 端到端验证

- [ ] 10.1 根目录全量 `bun run lint && bun run typecheck && bun run build && bun run test` 通过（provider 包既有 test-d 失败与本变更无关，需确认不新增失败）。
- [ ] 10.2 `vite preview` + 浏览器冒烟：真实 Key 走通 Bailian 生图、Seedream 生图、视频异步任务轮询；本地图片上传 → 生成 → 重选同文件命中缓存（显示"来自缓存"）→ 刷新页面缓存仍在。
- [ ] 10.3 按仓库约定提交 commit 并报告哈希；GH Pages 首发由用户在仓库 Settings 启用后触发。
