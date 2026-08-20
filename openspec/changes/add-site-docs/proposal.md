# Proposal: add-site-docs（v2 改写：双语文档 + 手写 API 参考，移除 TypeDoc）

> **版本说明**：本 change 于 2026-08-20 全量改写。原方案因 TypeDoc 不支持 TypeScript 7（tsgo）暂停；v2 移除 API 自动生成，改为手写核心 API 参考（自动生成拆为未来独立 change），并适配当前代码库现状（`/:lang` 国际化路由、4 个 Provider：azure-openai / aliyun-bailian / volcengine / minimax）。
>
> **实施记录（2026-08-20）**：中文 15 篇与文档区全部基建已实施完成；英文已交付入门 ×2（introduction、quick-start），其余英文页按"缺失即未翻译"规则暂缺（直接访问渲染占位页），对应 tasks 9.1-9.3 保持未完成。两项实施决策：(1) D6 回退生效——shadcn `Sidebar` 为 fixed 视口应用壳设计，与页面级布局整合成本过高，文档侧边栏改用 ScrollArea + Collapsible + Button 组合（sidebar.tsx/use-mobile.ts 未保留）；(2) 测试以文件系统级解析执行（bun test 不编译 MDX），frontmatter 构建期校验由 vite 管线在模块初始化时抛错实现。site:preview 深链与 base path 已冒烟通过；主题切换/移动端抽屉为代码走查，未做交互验证。

## Why

公开站点 `apps/site` 目前只有落地页和 Playground，开发者必须阅读分散在 6 份 README 与源码注释中的内容才能上手 SDK。站点已支持中英双语（`/:lang` 路由），文档区同样需要双语，否则英文访客进入文档会出现语言体验断裂。站点作为产品门面，需要在站内提供结构化、可导航、与代码同步的双语文档。

## What Changes

- 在 `apps/site` 新增双语文档区：路由 `/:lang/docs/*`，MDX 渲染管线（`@mdx-js/rollup` + remark/rehype 插件），兼容现有 GitHub Pages base path 与 `404.html` SPA 深链回退。
- **frontmatter 自动化**：MDX frontmatter（title/description/draft）经构建期插件解析为模块导出，自动注入 `document.title` 与 `<meta name="description">`；分组与顺序由单一语言无关 manifest 维护，manifest 不重复维护标题。
- **双语文档**：`content/docs/{zh,en}/` 双目录，共享一份 manifest；中文为源语言、文件必须齐全（与 manifest 双向一致）；英文允许文件缺失（缺失即未翻译：排除出英文导航，直接访问渲染占位页），构建期校验中文完整性与英文子集关系。
- 文档内容每语言 15 篇：入门（introduction、quick-start）、指南（image-generation、video-generation、parameters、results、error-handling、file-upload）、Provider 参考（azure-openai、aliyun-bailian、volcengine、minimax，统一七段式模板）、uploader、FAQ、API 参考。
- **手写 API 参考**（每语言各 1 篇 `api-reference`）：覆盖核心公共导出（generateImage/editImage/submitImageTask/submitVideoTask/TaskHandle/GenerationResult/SdkError 等），TypeDoc/API Extractor 自动生成拆为未来独立 change。
- Provider 页模型表与能力徽章为数据驱动：从各 Provider 包的模型注册表导出（如 `AZURE_MODEL_REGISTRY`，各包 entry 结构异构）经文档模型投影层归一化后渲染，与落地页 `SITE_MODELS` 同源。
- 文档布局使用 shadcn 组件（Sidebar/Sheet/ScrollArea/Separator/Alert/Badge/Table/Button），缺失组件经 shadcn CLI 安装到 `packages/ui`。
- 错误码表单一事实源：`SdkError` 在 error-handling 页、`UploaderError` 在 uploader 页。
- 落地页导航联动：header 增加"文档"入口，hero"查看文档"按钮由 GitHub 链接改为指向 `/:lang/docs`。

## Capabilities

### New Capabilities

- `site-docs`: 公开站点站内双语文档能力——MDX 文档管线与 frontmatter 元数据自动化、文档信息架构与内容要求（入门/指南/Provider/uploader/FAQ/手写 API 参考）、数据驱动模型表、shadcn 文档布局与导航、GitHub Pages 深链兼容。

### Modified Capabilities

（无。`sdk-usage-docs` 覆盖仓库内 README/examples 文档，本变更只在站点新增文档呈现层，不改变现有 README 需求。）

## Impact

- **代码**：`apps/site`（新增 `src/content/docs/{zh,en}/`、`src/components/docs/`、`src/pages/docs/`、`src/lib/docs/`，修改 `app.tsx` 路由、`vite.config.ts`、`vite-env.d.ts`、落地页导航、`locales/*.json`）；`packages/ui` 经 shadcn CLI 新增缺失组件（sidebar、sheet 等）。
- **依赖**：`apps/site` 新增 `@mdx-js/rollup`、`remark-frontmatter`、`remark-mdx-frontmatter`、`remark-gfm`、`rehype-slug`、`rehype-pretty-code`、`shiki`、`zod`（frontmatter 校验）；devDependencies 新增 `@types/mdx`。
- **构建**：MDX 插件以 `enforce: "pre"` 挂接（先于 React 插件）；无 API 生成步骤。
- **不影响**：`apps/web`、examples、SDK 运行时行为、现有 README。
