# Proposal: add-site-docs

## Why

公开站点 `apps/site` 目前只有落地页和 Playground，落地页"查看文档"按钮只能跳转到 GitHub 仓库，开发者必须阅读分散在 5 份 README（约 780 行）与源码注释中的内容才能上手 SDK。站点作为产品门面，需要在站内提供结构化、可导航、与代码同步的文档，降低试用与集成门槛。

## What Changes

- 在 `apps/site` 新增 `/docs` 文档区：MDX 渲染管线、侧边栏 + TOC 文档布局、嵌套路由（兼容现有 GitHub Pages base path 与 `404.html` SPA 深链回退）。
- 文档内容采用 Diátaxis 分层，共 13 篇手写文档：入门（introduction、quick-start）、指南（image-generation、video-generation、parameters、results、error-handling、file-upload）、Provider 参考（azure-openai、aliyun-bailian、seedream，统一七段式模板）、uploader、FAQ。
- Provider 页模型表与能力徽章为数据驱动：MDX 组件直接 import 各 Provider 包的模型注册表（`SupportedModel[]`），与落地页 `SITE_MODELS` 同源，代码变更文档自动跟随。
- 新增 TypeDoc API 参考：`typedoc` + `typedoc-plugin-markdown` 从 `@ai-media/sdk`、3 个 provider 包、`@ai-media/uploader` 的 TSDoc 生成 Markdown，纳入 site 构建前置步骤，产物不提交。
- 错误码表（`SdkError` code 表）只在 error-handling 页维护一份，其余页面链接引用。
- 落地页导航联动：header 增加"文档"入口，hero"查看文档"按钮由 GitHub 链接改为指向 `/docs`。

## Capabilities

### New Capabilities

- `site-docs`: 公开站点站内文档能力——MDX 文档管线、文档信息架构与内容要求（入门/指南/Provider/uploader/FAQ/API 参考）、数据驱动模型表、文档布局与导航、GitHub Pages 深链兼容。

### Modified Capabilities

（无。`sdk-usage-docs` 覆盖仓库内 README/examples 文档，本变更只在站点新增文档呈现层，不改变现有 README 需求。）

## Impact

- **代码**：`apps/site`（新增 `src/content/docs/`、`src/components/docs/`、`src/pages/docs/`，修改 `app.tsx` 路由、`vite.config.ts`、`vite-env.d.ts`、落地页导航）；根目录新增统一 typedoc 配置与 `docs:generate` 脚本；`turbo.json` 新增 `docs:generate` 任务。
- **依赖**：`apps/site` 新增 `@mdx-js/rollup`、`remark-gfm`、`rehype-slug`、`rehype-highlight`、`highlight.js`（主题 CSS）；根 devDependencies 新增 `typedoc`、`typedoc-plugin-markdown`（及必要时为 typedoc 单独锁定的 typescript 5.x）。
- **构建**：site build 前置 TypeDoc 生成步骤；CI/部署流程（GitHub Pages）需先执行生成。
- **不影响**：`apps/web`、examples、SDK 运行时行为、现有 README。
