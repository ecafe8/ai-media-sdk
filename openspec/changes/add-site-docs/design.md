## Context

`apps/site` 是 Vite 7 + React Router 7 的纯前端 SPA，部署在 GitHub Pages 项目站点（base `/ai-media-sdk/`），已有 `VITE_SITE_BASE` 单一变量驱动资源 base 与 Router basename、`404.html` SPA 深链回退、`PageContainer` 统一宽度规则。Vite 配置已为 `@ai-media/*` 各包建立指向源码的 alias（文档组件可直接 import 各包注册表）。仓库现有 5 份 README（约 940 行）是内容改写基础；源码 TSDoc 注释完整度高，可支撑 API 参考生成。约束：不引入服务端、不改 SDK 运行时行为、遵守 monorepo UI 规则（shadcn 优先、不随意新增共享自定义组件）。

## Goals / Non-Goals

**Goals:**

- 文档区与站点同构建、同主题、同 base path，深链在 GitHub Pages 可用。
- 模型/能力元数据零手写副本：由 Provider 注册表派生。
- API 参考由 TSDoc 生成、纳入构建、产物不入库。
- 清单一致性（侧边栏 ↔ 文档文件）有构建期自动检查。

**Non-Goals:**

- 不做站内搜索（后续可加 pagefind，路由与内容组织为其预留 slug/frontmatter）。
- 不做文档版本切换（SDK 快速迭代期，文档只跟 main）。
- 不做 i18n（仅简体中文）。
- 不改动 `apps/web`、examples 与现有 README 内容。

## Decisions

### D1: 文档渲染采用应用内 MDX（`@mdx-js/rollup`）

在现有 Vite 应用内新增 `/docs` 路由，MDX 文件经 `@mdx-js/rollup`（配 `remark-gfm`、`rehype-slug`、`rehype-highlight`）编译为 React 组件。

- **备选**：VitePress 独立构建——功能全但双构建、主题割裂、Pages 子路径部署复杂，且无法 import 注册表做数据驱动；`react-markdown` 运行时渲染——丢失 MDX 组件能力且运行时成本更高。均否决。
- MDX 插件 `include` 仅匹配 `src/content/docs/**/*.{md,mdx}`，避免影响其他文件。`vite-env.d.ts` 补充 `*.mdx`/`*.md` 模块声明。

### D2: 内容与清单结构

```
apps/site/src/content/docs/
  manifest.ts          # 分组 + 顺序 + slug→标题，侧边栏/翻页/一致性检查的唯一事实源
  introduction.mdx  quick-start.mdx
  image-generation.mdx  video-generation.mdx  parameters.mdx
  results.mdx  error-handling.mdx  file-upload.mdx
  providers/azure-openai.mdx  providers/aliyun-bailian.mdx  providers/seedream.mdx
  uploader.mdx  faq.mdx
  api/                 # TypeDoc 生成目录（.gitignore）
```

- 文档模块经 `import.meta.glob("../../content/docs/**/*.{md,mdx}", { eager: true })` 收集，slug = 相对路径去扩展名（`providers/azure-openai` 等）。
- `/docs` 索引路由重定向到清单第一篇；`/docs/*` 捕获路由按 slug 查表渲染，未命中渲染文档区 NotFound（含返回首页/文档首页链接）。
- 文档正文统一包在 `article` 语义标签内，供 TOC 与文档排版样式（`docs-article` 类，prose 风格手写 Tailwind 样式，不引入 `@tailwindcss/typography`——站点未用且样式可控性更好）定位。

### D3: 数据驱动组件

`components/docs/` 下新增应用内业务组件（不进 `packages/ui`）：

- `ProviderModelTable`：props 为 provider 注册表常量，渲染模型表（id/label/能力徽章/size 约束/maxN/maxEditImages/maxResolution），列与落地页 `ModelMatrix` 语义对齐但信息更全。
- `CapabilityBadges`：复用落地页 `capabilityBadges` 的语义（生成/编辑/视频/异步）。
- `Callout`：基于 shadcn `alert` 组合，不新建共享组件（遵守 UI 规则）。
- 各 provider 包已通过 vite alias 指向源码，文档组件直接 import `*ModelRegistry` 常量，无需构造 Provider 实例。

### D4: TOC 与翻页

- TOC：客户端方案——`rehype-slug` 生成锚点，文档页 mount 后从 `article` 内收集 `h2/h3` 渲染右侧目录；点击 `scrollIntoView`。避免构建期 AST 提取的管线复杂度。窄屏隐藏 TOC（侧边栏优先）。
- 上一篇/下一篇：由 manifest 扁平化顺序派生，渲染在文档底部。

### D5: API 参考生成（TypeDoc）

- 根 devDependencies 新增 `typedoc` + `typedoc-plugin-markdown`；根脚本 `docs:generate` 执行生成，入口为 5 个包的 `src/index.ts`，输出 `apps/site/src/content/docs/api/**.md`（`outputFileStrategy: "members"` 减少文件数），该目录加入 `.gitignore`。
- 集成方式：生成的 `.md` 与手写 MDX 走同一条 Vite 管线（D1 的 include 已覆盖 `.md`），在 manifest 中为每个包登记 API 参考入口；生成文件间的相对 `.md` 链接由一个 remark 插件（站点内小工具）重写为站内 `/docs/...` 路由链接。
- **回退方案**：若链接重写在实践中成本过高（生成结构不稳定），降级为 TypeDoc HTML 输出到 `dist/api-reference/`、侧边栏以外链方式进入。两种形态均满足 spec 的"从源码生成、纳入构建、产物不入库"要求；实施时优先主方案，遇到阻塞切换回退方案并在 tasks 中记录。
- 构建集成：`turbo.json` 新增 `docs:generate` 任务，`apps/site` 的 `build` 任务 `dependsOn` 它；本地 `bun run --cwd apps/site build` 通过 turbo 根脚本运行时自动生成。GitHub Pages 部署工作流已执行根级 install/build，无需新增步骤（实施时核对 workflow 文件）。

### D6: 错误码与内容的单一事实源策略

- `SdkError` 错误码表只在 `error-handling.mdx` 维护；FAQ/Provider 页以链接引用。
- 手写内容从 README 改写扩展而非复制粘贴：README 保持 npm 包视角的精简，站点文档面向集成开发者扩展（更多上下文、FAQ、交叉链接）。两者出现分歧时以源码行为为准。

### D7: 代码高亮

`rehype-highlight`（lowlight，构建期、零运行时、无网络依赖）。引入 highlight.js 的 light/dark 两份主题 CSS，通过 `.dark` 作用域切换；代码块容器样式随主题。不选 shiki：构建期体积与配置复杂度对当前规模不划算。

### D8: 测试策略

- 新增 `apps/site/tests/docs-manifest.test.ts`（bun test）：断言 glob 收集到的文档集合与 manifest slug 集合双向一致、清单分组非空、每篇文档模块有默认导出。
- 既有 `postbuild.ts` 资源 base 校验继续覆盖构建产物；`site:preview` 人工核对深链。
- 不引入 React 渲染层测试框架（站点现状无此基建，避免扩大范围）。

## Risks / Trade-offs

- [TypeDoc markdown 与路由链接映射复杂度超预期] → D5 回退方案（静态 HTML），切换判据：链接重写实现超过一个任务的合理复杂度即切换。
- [MDX/remark/rehype 与 React 19、Vite 7 版本兼容] → 管线搭建放在第一个任务，先以最小文档页跑通 dev/build 再写内容，尽早暴露问题。
- [highlight.js 主题与 Tailwind v4 深色模式冲突] → 主题 CSS 仅作用于 `.hljs` 作用域，不写全局颜色变量。
- [README 与站点文档双份维护漂移] → 内容以源码行为为最终准绳；Provider 页数据驱动部分零手写；后续可考虑 README 反向链接站点文档（不在本变更）。
- [14 篇内容写作量大、易跑偏] → tasks 按"每篇一页任务"拆分，每篇验收标准引用 spec 对应 Requirement，避免自由发挥。

## Migration Plan

1. 纯增量变更，无迁移；合并后 GitHub Pages 自动部署即生效。
2. 回滚策略：文档区独立于现有页面，如出现问题可直接 revert 合并提交，落地页导航恢复原 GitHub 链接。

## Open Questions

- TypeDoc 生成入口是否需要包含各包内部模块页（`contracts/` 等子模块）还是仅顶层导出：实施 D5 时按生成产物可读性定，不影响 spec。
