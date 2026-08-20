## Context

`apps/site` 是 Vite 7 + React Router 7 的纯前端 SPA，部署在 GitHub Pages 项目站点（base 由 `VITE_SITE_BASE` 单一变量驱动），已引入 `/:lang` 双语路由（zh/en，`LangLayout` 负责语言校验、`document.documentElement.lang` 与默认页面标题）、`404.html` SPA 深链回退、`PageContainer` 统一宽度规则。Provider 家族现为 4 个：azure-openai、aliyun-bailian、volcengine（原 seedream）、minimax，各自导出 `*_MODEL_REGISTRY` 常量；站点 `SITE_MODELS` 已从这些注册表派生。共享 UI 在 `packages/ui`（shadcn base-luma 风格，已有 alert/badge/button/card/scroll-area/separator/table/tooltip 等，**缺 sidebar/sheet/collapsible/breadcrumb**）。约束：仓库 TypeScript 为 7（tsgo），TypeDoc 等依赖 TS JS API 的生成工具不可用——API 参考手写，自动生成拆为未来独立 change。

## Goals / Non-Goals

**Goals:**

- 双语文档区与站点同构建、同主题、同 base path，深链在 GitHub Pages 可用。
- frontmatter 是标题/描述的唯一来源：构建期解析、schema 校验、自动注入 `document.title` 与 `meta[name=description]`，manifest 不重复维护标题。
- 模型/能力元数据零手写副本：由 Provider 注册表常量派生。
- 文档布局与内容元素优先使用 shadcn 组件。
- 手写 API 参考覆盖核心公共导出，并用导出名集合测试缓解漂移。

**Non-Goals:**

- 不做 API 文档自动生成（TypeDoc/API Extractor 不支持 TS7；未来独立 change，届时只替换 api-reference 内容来源，不动布局）。
- 不做站内搜索（后续可加 pagefind，frontmatter 已为其预留元数据）。
- 不做文档版本切换（SDK 快速迭代期，文档只跟 main）。
- 不做英文机翻占位：缺失英文文档以 draft 标记，补齐前不上线。
- 不改动 `apps/web`、examples 与现有 README。

## Decisions

### D1: MDX 渲染管线

`@mdx-js/rollup` 以 `enforce: "pre"` 挂接（先于 `@vitejs/plugin-react`，MDX 官方 Vite 集成要求），插件链：`remark-frontmatter` + `remark-mdx-frontmatter`（frontmatter → 模块导出）+ `remark-gfm`（表格/删除线）+ `rehype-slug`（标题锚点）+ `rehype-pretty-code`（shiki 高亮，见 D8）。`include` 仅匹配 `src/content/docs/**/*.{md,mdx}`。devDependencies 新增 `@types/mdx`；`vite-env.d.ts` 声明 `*.mdx` 模块为 `{ default: ComponentType; frontmatter?: unknown }`——frontmatter 的运行时形状不信任编译期声明，由内容加载器用 zod 解析为 `DocFrontmatter`（见 D3）。

- **备选**：运行时 `gray-matter` 解析——违背构建期编译原则且增加运行时成本，否决。

### D2: 双语内容结构（共享 manifest + 分语言目录）

```
apps/site/src/content/docs/
├── manifest.ts        # 单一结构事实源：分组 id + slug 列表 + order；不含任何语言文案
├── zh/
│   ├── introduction.mdx  quick-start.mdx
│   ├── image-generation.mdx  video-generation.mdx  parameters.mdx
│   ├── results.mdx  error-handling.mdx  file-upload.mdx
│   ├── providers/{azure-openai,aliyun-bailian,volcengine,minimax}.mdx
│   ├── uploader.mdx  faq.mdx  api-reference.mdx
└── en/                # 与 zh 完全镜像的 slug 集合
```

- manifest 只有一份（语言无关的分组 + slug + 顺序），分组标题经 i18n（`locales/*.json` 的 `docs.groups.*`）解析——双语结构一致性由构造保证，测试只需校验文件层面。
- **备选**：每语言独立 manifest——需额外测试对齐两份结构，且无实际收益（文档结构不应按语言分化），否决。
- slug 由文件路径派生（相对语言目录去扩展名），frontmatter 不声明 slug，杜绝路径/slug 不一致。
- **双语完整性规则（zh 强制、en 渐进）**：zh 为源语言，文件必须齐全——manifest ↔ zh 文件双向一致，缺失即测试失败。en 允许文件缺失，缺失即未翻译：英文导航（侧边栏/翻页）只列出已翻译页面，直接访问未翻译 slug 渲染"翻译进行中"占位页（文案走 i18n）。测试断言 en ⊆ zh 且无游离英文文件。frontmatter 的 `draft` 只用于"文件已存在但开发中"的页面（任意语言，排除导航 + 占位页），不承担英文翻译状态职责。不采用"manifest 记录 draftLanguages"或"英文文件强制存在 + draft 标记"方案：前者让结构事实源与文件状态两处维护，后者要求翻译启动即创建文件，增加无内容文件的维护噪音。

### D3: frontmatter schema 与校验

frontmatter 字段：`title`（必填，字符串）、`description`（必填，字符串）、`draft`（可选，布尔）。**分组与顺序不在 frontmatter 维护**——由 manifest 单一持有（D2），避免两处排序来源漂移。示例：

```yaml
---
title: 快速开始
description: 使用 AI Media SDK 完成首次图像生成
---
```

`remark-mdx-frontmatter` 将其编译为 `export const frontmatter`；内容加载器（`lib/docs/content-loader/`）以 `import.meta.glob` eager 收集各语言文档模块，加载时用 zod schema 解析模块的 `frontmatter`（`unknown` → `DocFrontmatter`）。校验失败指明文档路径与缺失字段；测试中显式执行全量校验。

### D4: 元数据注入与标题协调

`lib/docs/page-metadata/` 提供 `usePageMetadata({ title, description })`：设置 `document.title = "<title> · AI Media SDK"`，创建或更新 `meta[name=description]`。文档页以 frontmatter 调用。

与现有 `LangLayout` 的协调：`LangLayout` 的标题 effect 仅在语言变化时执行（deps 不含路由），文档页 effect 在路由渲染后执行，二者不冲突；为避免"离开文档区后标题残留"，落地页与 Playground 各补一行等价 `usePageMetadata` 调用（title 取 i18n 键，description 取 i18n 文案）——这是本变更对现有页面的唯一行为改动，保持标题在全部页面正确。

### D5: 路由

```
/:lang/docs            → Navigate 到该语言 manifest 第一篇
/:lang/docs/*          → DocsPage：按 slug 查表渲染，未命中文档区 NotFound
/docs、/docs/*         → 历史兼容重定向到访客语言对应路径（同 LegacyPlaygroundRedirect 模式）
```

`DocsPage` 以路由参数 `:lang`（经 `LangLayout` 同款校验）为权威语言来源加载 zh/en 文档集合，不使用 `useSiteLang()`——后者读 i18n 实例状态，而 `LangLayout` 的 `i18n.changeLanguage()` 是 effect，URL 与 i18n 状态之间存在不同步窗口；`useSiteLang()` 仅保留给无路由上下文的场景。语言切换即切换文档内容（slug 双语一致，切换保持当前 slug）。

### D6: 布局与 shadcn 组件

经 shadcn CLI 从 `packages/ui`（或任一配置了 components.json 的工作区）安装缺失组件：`sidebar`、`collapsible`、`breadcrumb`（`sheet` 随 sidebar 依赖带入）。文档布局为应用内组件（`apps/site/src/components/docs/`，不进 `packages/ui`）：

- `docs-layout/`：shadcn `Sidebar`（SidebarProvider 作用域限定在文档区）承载分组导航（`SidebarGroup`/`SidebarMenu` + `Collapsible`），移动端用其内建 Sheet 行为；文章区 `article` 语义标签 + 手写 prose 排版样式（不引入 `@tailwindcss/typography`）；右侧 TOC（`ScrollArea`）窄屏隐藏；底部上一篇/下一篇（`Button`）；面包屑（`Breadcrumb`）。滚动行为：slug 变化滚动到文章顶部，hash 导航定位标题（`DocsPage` 以 `useEffect` 依赖 `slug`/`hash` 实现）。
- MDX 元素映射（`mdx-components/`）：`table`→shadcn `Table` 组合、提示块→`Alert`、徽章→`Badge`、代码块→自定义 `code-block/`（见 D8）、链接→`DocLink`：站内链接经 `buildDocPath(lang, slug)` 生成（携带当前语言段，禁止正文硬编码 `/docs/...`），外链 `target="_blank"` + `rel="noreferrer"` 并加图标。
- 文档区 NotFound 用 shadcn `Empty`（若 CLI 无此组件则用 `Card` + `Button` 组合，不新建自定义共享组件）；draft 页"翻译进行中"占位同样复用 `Card`/`Alert` 组合。
- **回退判据**：若 shadcn `Sidebar` 与 SPA 页面级布局整合成本过高（其设计面向应用壳），降级为 `ScrollArea` + `Collapsible` + `Button` 组合的自绘侧边栏（仍是 shadcn 组件组合），并在 tasks 中记录决策。

### D7: 数据驱动组件（模型投影层）

各 Provider 注册表导出与 entry 结构**异构**：`AZURE_MODEL_REGISTRY`/`ALIYUN_MODEL_REGISTRY`/`VOLCENGINE_MODEL_REGISTRY`/`MINIMAX_MODEL_REGISTRY` 为 `Record<ModelId, <Provider>ModelEntry>`（各包另有 camelCase 的 `ModelRegistry` 投影导出），entry 字段各不相同（如 MiniMax 有 `supportedResolutions`/`maxReferenceImages` 而无 `supportedSizes`；Volcengine 有 `outputFormats`）。因此：

- `lib/docs/model-projection/`：适配层，将各 Provider entry 映射为统一 `DocModel` 形状（id/label/能力/size 约束/maxN/maxEditImages/maxResolution 等通用字段，通用字段缺失则为空）；人类可读 label 复用落地页 `MODEL_LABELS` 语义来源。
- `components/docs/provider-model-table/`：基于投影结果渲染通用列；Provider 专属字段经各 Provider 的专属渲染器（同组件目录下的 per-provider 扩展）在对应 Provider 页展示。
- `components/docs/capability-badges/`：能力徽章（生成/编辑/视频/异步），语义与落地页 `capabilityBadges` 对齐。
- `callout/` 不单独新建——MDX 映射直接用 `Alert`。

### D8: 代码高亮与代码块

`rehype-pretty-code` + shiki，双主题 `{ light: "github-light", dark: "github-dark" }`，经 CSS 变量随 `.dark` 切换（变量作用域限定，不污染全局）；语言集限制为 ts/tsx/bash/json。`code-block/` 组件：语言标识 + 复制按钮（`navigator.clipboard`）+ 横向滚动。

- **备选**：`rehype-highlight`——主题质量与双主题支持弱于 shiki，站点构建规模可承受 shiki 构建期成本，否决。

### D9: 单一事实源策略

- `SdkError` 错误码表只在 `error-handling.mdx` 维护；`UploaderError` 错误码表只在 `uploader.mdx` 维护；其余页面链接引用。
- file-upload（指南视角：工作流 + 与 `editImage` 集成示例）与 uploader（包参考视角：子路径导出/配置表/`UploadedFile`/错误码/配额）互链。
- 手写内容从 README 改写扩展；分歧以源码行为为准。英文文档由中文源文档人工翻译审校，不机翻占位；未完成的英文页不创建文件（缺失即未翻译，见 D2），英文导航自动排除，直接访问渲染占位页。

### D10: 手写 API 参考与漂移缓解

api-reference 页按模块分节（image/video/async/result/error/helpers），每个导出条目含签名、参数表、返回值、抛出错误、示例。漂移缓解：测试用例 import `@ai-media/sdk` 并对断言其公开导出名集合与 api-reference 页维护的清单常量一致——SDK 增删导出时测试失败，强制更新文档。完整自动生成留待未来 change。

### D11: 测试策略

新增 `apps/site/tests/docs-content.test.ts`（bun test）：

1. manifest ↔ zh 文件双向一致性（中文为源语言，强制齐全）；
2. en ⊆ zh 且无游离英文文件；已存在的英文文件同样通过 frontmatter 校验；
3. 全部已存在文档的 frontmatter 经 zod 校验（title/description 必填、draft 可选布尔）；
4. `@ai-media/sdk` 导出名集合与 api-reference 清单常量一致，且清单符号与正文小节标题对应（D10）；
5. 关键页结构断言：Provider 页含七段标题、quick-start 含安装/示例标题（防内容模板跑偏）。

既有 `postbuild.ts` 资源 base 校验继续覆盖构建产物；`site:preview` 人工核对深链。不引入 React 渲染层测试框架。

## Risks / Trade-offs

- [MDX 插件链与 React 19 / Vite 7 兼容问题] → 管线搭建放第一个任务，以最小文档页跑通 dev/build 再写内容。
- [shadcn Sidebar 面向应用壳设计，与页面级文档布局整合成本超预期] → D6 回退判据：降级为 ScrollArea+Collapsible+Button 组合。
- [双语内容工作量大、英文滞后] → 中文先行（zh 完整性强制），英文允许文件缺失（缺失即未翻译：导航排除 + 占位页），保证不出现死链、空白页或无内容文件。
- [`LangLayout` 与文档页标题竞争] → D4 明确 effect 职责划分，并为落地页/Playground 补统一 metadata 调用。
- [shiki 主题 CSS 与 Tailwind v4 冲突] → 主题仅以 CSS 变量注入代码块作用域。
- [手写 API 参考与源码漂移] → D10 导出名集合测试 + 未来自动生成 change。

## Migration Plan

1. 纯增量变更；合并后 GitHub Pages 自动部署即生效。
2. 回滚：文档区独立于现有页面，revert 合并提交即可；落地页导航恢复原 GitHub 链接。

## Open Questions

- shadcn CLI 安装 `sidebar` 时是否需要同时升级现有组件版本：实施 D6 时以 `--dry-run` 确认影响面，不扩大变更范围。
