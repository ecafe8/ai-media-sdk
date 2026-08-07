## Context

现有 `apps/web` Playground 为服务端代理架构（Next.js API 路由中转 Provider 请求），已支持 Vercel 部署与 BYO Key 回退。本变更新增一个互补形态：零服务端纯前端站点。动机与范围见 proposal.md。

设计前提（均已实测/代码核实）：

- **CORS**：DashScope（`dashscope.aliyuncs.com`）与 Ark（`ark.cn-beijing.volces.com`）预检反射任意 Origin 并允许 `authorization`/`content-type` 头；Azure OpenAI 返回 `access-control-allow-origin: *` 并允许 `api-key`。三家生成接口均可浏览器直连。
- **浏览器兼容**：`@ai-media/sdk` 与三家 provider 包仅用原生 `fetch`，无 Node 依赖；唯一含 `node:*` 导入的是 `@ai-media/uploader`（本应用不引用）。
- **base64 输入支持**：`ImageContent.base64` 为核心契约；Aliyun adapter 的 `mapImageContent`（覆盖图像编辑、i2v 首帧、r2v 参考图）与 Seedream adapter 的编辑映射均支持 base64 → data URL；Azure `editImage` 为 NOT_IMPLEMENTED，无图片输入场景。
- **视频输入约束**：SDK 契约 `inputVideo: { url }` 仅接受公网 http/https URL（`params.ts` 明示），DashScope 视频输入不接受 base64；DashScope 临时 OSS 上传 host 不发 CORS 头，浏览器无法直传。
- **仓库先例**：`examples/uploader-web` 提供 Vite + React + `@workspace/ui`/`@ai-media/*` 源码别名的可复用配方。

## Goals / Non-Goals

**Goals:**

- 体验者零门槛试用 SDK：打开站点、填自己的 Key、即刻生成；Key 只存其浏览器、只发往对应 Provider。
- 本地图片一次选择、长期复用：内容哈希去重，跨会话免重选，发送前才编码。
- 纯静态产物，GitHub Pages 免费托管，push main 自动发布。

**Non-Goals:**

- 不做服务端/代理能力（那是 `apps/web` 的职责）；不改动 `apps/web` 与 `packages/*`。
- 不接入 `@ai-media/uploader`（Node 依赖 + OSS CORS 阻断，浏览器场景不可用）。
- 不支持 video-edit 源视频本地上传（契约仅公网 URL）；不新增 Gemini/Google provider。
- 不做账号体系、结果持久化、结果画廊等社区功能。

## Decisions

### D1: 纯前端直连架构，不保留任何服务端中转

**理由**：CORS 实测全通；免服务器成本与部署复杂度；Key 不经任何第三方服务器，隐私叙事最干净；请求体不受 Vercel 4.5MB 限制（约束转为 Provider 侧请求大小，见 R2）。

**备选**：
- *Next.js `output: 'export'` 静态导出*：否决——Next 静态导出限制多（无 API 路由是前提但 bundle 更重），且仓库已有 Vite 先例，GH Pages 场景 Vite 更简单。
- *保留轻量代理（Cloudflare Worker 等）*：否决——违背"不走服务器中转"的目标，且引入运维面。

### D2: 新工作区 `apps/site`，Vite + React 19，复制改造 `apps/web` 组件

**理由**：`apps/*` 自动接入 bun workspaces 与 turbo 任务；复制改造最快落地，两版形态允许适度分化（服务端代理 vs 直连）。组件本身是纯 React（`"use client"` 指令在 Vite 中为无害字符串），改造点集中在数据层：去掉 `/api/playground/generate` fetch，替换为客户端 executor 直调 SDK。

**备选**：
- *抽 `packages/playground-ui` 共享包*：否决（本期）——两版数据流差异（代理 vs 直连、每请求凭证 vs 全局 key store）需要抽象注入点，重构面大；待两版稳定后再评估。
- *直接改造 apps/web 双模式*：否决——构建/部署形态冲突（Next 服务端 vs 纯静态），耦合后两边都难维护。

### D3: BYO Key 存 localStorage，设置面板一次填写，按 Provider 隔离使用

**理由**：Key 为体验者自有，存其本地浏览器可接受且体验好（跨会话免重填）；外部 store 模式（`useSyncExternalStore` + localStorage）已在 `apps/web` 验证。提交生成请求时仅注入目标 Provider 的凭证构造 provider 实例，天然隔离。

**备选**：
- *sessionStorage/内存态*：否决——刷新即失，体验差。
- *IndexedDB 存 Key*：无必要，字符串量级 localStorage 足够。

**安全边界**：Key 不进 URL/日志/错误信息；UI 明示存储与传输方式；设置面板提供清除。

### D4: 图片一律 base64 内联（`ImageContent { base64, mimeType }`），不走临时文件上传

**理由**：浏览器直传 DashScope 临时 OSS 被 CORS 阻断（OSS host 不发 CORS 头），`@ai-media/uploader` 在浏览器不可用；base64 内联被所有涉及图片输入的 adapter 支持；且无 48h 过期、无 DashScope model 绑定、无账号绑定——缓存语义因此大幅简化（对比 `apps/web` 曾评估的 oss:// 方案需要 `hash+model+账号` 三元 key 与过期管理）。

**备选**：
- *oss:// 临时上传（服务端中转）*：仅适用于有服务端的 `apps/web` 形态，与本站架构冲突。
- *第三方图床*：否决——引入外部依赖与隐私问题。

### D5: 媒体缓存 = OPFS 原始字节 + IndexedDB 元数据，请求时才转 base64

**理由**：
- OPFS 免权限、跨会话持久、磁盘级配额，文件以 `<sha256>.<ext>` 命名存储原始字节——静态存储零膨胀（不存 base64），大文件友好；"存路径、按需读"正是 OPFS 的语义。
- IndexedDB 只存 `{hash, name, mime, size, thumb, addedAt, lastUsedAt}` 元数据（每条几 KB），驱动缩略图列表与 LRU。
- base64 编码成本只发生在构造请求时（那是必须付出的传输载荷成本）。

**备选**：
- *IndexedDB 直接存 Blob*：可行但大文件语义与性能不如 OPFS，且用户明确要求"本地文件"形态。
- *只存 FileSystemFileHandle（真实本地路径）*：否决——仅 Chrome 支持持久化且每会话需重新授权，不跨浏览器。
- *localStorage 存 base64*：否决——5MB 配额、33% 膨胀，完全不可行。

**降级**：OPFS 不可用（旧浏览器/隐私模式）→ 内存级会话缓存，流程不中断（fail-soft）。

**容量**：条目数与总字节双上限（初始 100 条 / 500MB），按 `lastUsedAt` LRU 淘汰。

### D6: 图片输入控件形态——单值混合控件 + r2v 有序卡片列表

**理由**：单值字段（图生图参考图、i2v 首帧）= URL 输入 + 上传按钮 + 已选预览卡。r2v 原为逗号分隔 textarea——base64 为 MB 级字符串无法在可见文本框编辑，必须改为有序卡片列表（顺序即 `[Image N]`），保留批量粘贴 URL 入口兼容旧习惯。video-edit 源视频维持 URL-only（契约约束）。

### D7: 单图 5MB 上限，客户端在发送前校验

**理由**：用户选定值。纯前端无服务端请求体限制，约束来自 Provider 侧请求大小与浏览器内存；5MB base64 后约 6.7MB，对 DashScope 图像输入在可接受范围。上限为可配置常量，后续可按实测调整。

### D8: GitHub Pages 部署——Actions 工作流 + 可配 base path + 404.html 兜底

**理由**：GH Pages 纯静态托管匹配产物形态；`actions/deploy-pages` 为官方推荐路径；Vite `base` 由环境变量注入（默认 `/ai-media-sdk/`，取自仓库名），本地 dev 保持根路径；SPA 深链靠构建时复制 `index.html` → `404.html` 兜底（GH Pages 标准做法）。

**备选**：*HashRouter 免兜底*：否决——URL 不美观，Landing 页需要正常路径。

## Risks / Trade-offs

- **R1 Provider CORS 策略可能变化** → 冒烟测试覆盖三家直连；若未来某家关闭 CORS，该 Provider 在本站降级为不可用（Landing 矩阵可标注），`apps/web` 代理形态兜底。
- **R2 Provider 请求体大小限制**（DashScope 对单次请求 payload 有上限，5MB base64≈6.7MB 接近边界）→ 客户端 5MB 硬校验 + 失败时错误文案提示减小图片；上限常量可调。
- **R3 Key 存 localStorage 的 XSS 风险** → 站点为纯静态、无第三方脚本注入面；不引入任何分析/广告脚本；UI 明示风险与清除入口。
- **R4 OPFS 兼容性**（Safari 15.2- 等旧环境）→ fail-soft 内存降级；功能可用、缓存不持久。
- **R5 GH Pages base path 漂移**（仓库改名/换 org）→ base 由环境变量注入，workflow 单点维护；README 记录修改方法。
- **R6 组件复制导致两版分化** → 接受为短期成本；`apps/web` 冻结大改，待两版稳定后评估抽共享包（D2 备选）。
- **R7 视频异步任务浏览器轮询耗时较长**（分钟级）→ 复用 SDK `task.wait` 的轮询间隔与超时语义，UI 明确 processing 状态，用户可停留等待或放弃；与 `apps/web` 行为一致。

## Migration Plan

纯新增，无迁移。上线步骤：
1. 合入 `apps/site` 与 workflow；
2. 仓库 Settings → Pages → Source 选择 GitHub Actions；
3. 手动触发 workflow 验证首发，之后 push main 自动发布；
4. README 增加站点链接与部署说明。

回滚：停用 workflow / Pages 开关即可，无数据面影响。

## Open Questions

- DashScope 请求 payload 上限的精确值（影响 R2 的上限调优）——可在实施冒烟阶段用大图实测确认，不改变 spec。
- Landing 页是否需要 i18n（当前仅中文）——后续独立变更，不影响本期结构。
