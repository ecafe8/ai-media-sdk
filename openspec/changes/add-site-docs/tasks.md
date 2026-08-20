## 1. MDX 管线搭建

- [ ] 1.1 `apps/site` 新增依赖：`@mdx-js/rollup`、`remark-frontmatter`、`remark-mdx-frontmatter`、`remark-gfm`、`rehype-slug`、`rehype-pretty-code`、`shiki`、`zod`，devDependencies 新增 `@types/mdx`（`bun install`，更新 `bun.lock`）
- [ ] 1.2 `vite.config.ts` 以 `enforce: "pre"` 挂接 mdx 插件（先于 react 插件；`include` 仅 `src/content/docs/**/*.{md,mdx}`；配置 D1 插件链与 shiki 双主题）
- [ ] 1.3 `vite-env.d.ts` 增加 `*.md`/`*.mdx` 模块声明（`{ default: ComponentType; frontmatter?: unknown }`，运行时形状由加载器 zod 解析）
- [ ] 1.4 创建 `src/content/docs/zh/` 与最小占位文档（introduction），`bun run --cwd apps/site dev` 验证渲染、高亮、frontmatter 导出；`build` 验证产物（design D1/D8，spec"文档呈现质量"）

## 2. shadcn 组件补齐

- [ ] 2.1 `bunx shadcn@latest add sidebar collapsible breadcrumb`（安装到 `packages/ui/src/components/shadcn/`；先 `--dry-run` 确认不升级现有组件；显式检查 `sheet` 是否随依赖带入，未带入则单独 `add sheet`）（design D6）
- [ ] 2.2 验证新组件在站点可导入（`@workspace/ui/components/shadcn/<name>`）并通过 typecheck；若 Sidebar 整合成本过高，按 D6 回退判据降级为 ScrollArea+Collapsible+Button 组合并记录决策

## 3. 内容基建

- [ ] 3.1 `src/content/docs/manifest.ts`：单一结构事实源——分组（入门/指南/Providers/Uploader/FAQ/API 参考）+ 全部 15 个 slug，分组与顺序仅在此维护（frontmatter 不存顺序），不含语言文案（design D2，spec"文档信息架构完整性"）
- [ ] 3.2 `src/lib/docs/content-loader/`：`import.meta.glob` eager 收集 zh/en 文档模块，slug 由路径派生，导出按 `(lang, slug)` 查表 API；zod schema 解析模块 frontmatter（title/description 必填、draft 可选布尔），校验失败指明文档路径（design D3，spec"frontmatter 元数据自动化"）
- [ ] 3.3 `src/lib/docs/navigation/`：侧边栏树（分组标题经 i18n `docs.groups.*` 解析）、当前页、上一篇/下一篇、面包屑派生（design D2/D6）
- [ ] 3.4 `src/lib/docs/page-metadata/`：`usePageMetadata({ title, description })`——`document.title` 加站点后缀、创建/更新 `meta[name=description]`（design D4）

## 4. 路由与文档布局

- [ ] 4.1 `app.tsx`：`/:lang` 子路由增加 `docs`（Navigate 到首篇）与 `docs/*`（DocsPage）；顶层增加 `/docs`、`/docs/*` 历史兼容重定向（访客语言）；未知 slug 渲染文档区 NotFound（spec"文档区路由与导航"）
- [ ] 4.2 `pages/docs/` 与 `components/docs/docs-layout/`：DocsPage 以路由参数 `:lang`（校验后）为权威语言来源加载文档集合；shadcn Sidebar 分组导航（当前页高亮、Collapsible 分组、移动端 Sheet）+ 文章区 + TOC（mount 后收集 `article h2/h3`，rehype-slug 锚点，ScrollArea，窄屏隐藏）+ 上一篇/下一篇（Button）+ 面包屑（Breadcrumb）；滚动行为：slug 变化回到文章顶部、hash 导航定位标题；draft 页渲染"翻译进行中"占位；DocsPage 以 frontmatter 调用 `usePageMetadata`；布局遵守 `PageContainer` 宽度规则（design D4/D5/D6，spec"frontmatter 元数据自动化"/"双语文档与结构一致性"）
- [ ] 4.3 `components/docs/mdx-components/`：MDX 元素映射——`table`→shadcn Table 组合、blockquote/提示→Alert、徽章→Badge、链接→`DocLink`（站内链接经 `buildDocPath(lang, slug)` 携带语言段，正文禁止硬编码 `/docs/...`；外链 `target="_blank"` + `rel="noreferrer"`）；`components/docs/code-block/`：语言标识 + 复制按钮 + 横向滚动（design D6/D8，spec"文档区路由与导航"/"文档呈现质量"）
- [ ] 4.4 文档排版样式：`article` prose 手写 Tailwind 样式（标题/段落/表格/列表/链接），深浅色可读；shiki 双主题 CSS 变量随 `.dark` 切换（仅代码块作用域）；落地页与 Playground 各补一行 `usePageMetadata`（title/description 取 i18n 文案）（design D4/D8）

## 5. 数据驱动组件

- [ ] 5.1 `src/lib/docs/model-projection/`：适配层，将 4 个 Provider 的异构注册表 entry（`AZURE_MODEL_REGISTRY`/`ALIYUN_MODEL_REGISTRY`/`VOLCENGINE_MODEL_REGISTRY`/`MINIMAX_MODEL_REGISTRY`，均为 `Record<ModelId, <Provider>ModelEntry>`）映射为统一 `DocModel` 形状（design D7，spec"模型与能力数据单一来源"）
- [ ] 5.2 `components/docs/provider-model-table/`：基于投影结果渲染通用列（id/label/能力徽章/size/maxN/maxEditImages/maxResolution）；Provider 专属字段（如 MiniMax `supportedResolutions`/`maxReferenceImages`、Volcengine `outputFormats`）经 per-provider 渲染器在对应 Provider 页展示；`components/docs/capability-badges/`：与落地页语义对齐（design D7）

## 6. 中文内容：入门与指南

- [ ] 6.1 `zh/introduction.mdx`：架构总览（契约→Provider 工厂→模型实例→生成函数）、同步 vs 异步、包家族一览（含 uploader）、Playground 与文档关系
- [ ] 6.2 `zh/quick-start.mdx`：安装命令、运行时要求（Node>=20/Bun、ESM-only）、最小可运行示例、结果读取；示例与 `examples/*` 及 README 对齐（spec"入门与指南内容要求"）
- [ ] 6.3 `zh/image-generation.mdx`：`generateImage`/`editImage`、预检行为（网络请求前抛 `INVALID_REQUEST`）、参考图上限、字面量模型 id 编译期收窄
- [ ] 6.4 `zh/video-generation.mdx`：`submitImageTask`/`submitVideoTask`、`TaskHandle` 字段表、`wait()` 的 pollIntervalMs/timeoutMs/signal、输入模式（firstFrame/referenceImages/inputVideo）适用条件
- [ ] 6.5 `zh/parameters.mdx`：公共参数 prompt/n/size（像素形式 `WxH` 与档位形式）、`pixelSize`/`tierSize`、`providerOptions.<provider>` 命名空间规则、未知公共字段被预检拒绝
- [ ] 6.6 `zh/results.mdx`：`GenerationResult`/`ImageContent`/`VideoContent`、`toImageUrl`、临时 URL 过期警告与持久化建议
- [ ] 6.7 `zh/error-handling.mdx`：`SdkError` 全错误码表（code/含义/默认可重试）——唯一事实源、捕获模式、`retryable` 与退避建议、错误信息不含凭据说明（spec"错误处理文档单一事实源"）
- [ ] 6.8 `zh/file-upload.mdx`（指南视角）：uploader 定位、Aliyun/Google 上传链路工作流、与 `editImage` 集成示例、生产用自有存储提示；错误码细节链接 uploader 页（design D9）

## 7. 中文内容：Provider 参考（七段式模板）

- [ ] 7.1 `zh/providers/azure-openai.mdx`：七段式；配置字段表（apiKey/endpoint/apiVersion）、模型表（数据驱动）、`providerOptions.azure` 字段表、限制（仅同步、n=1、不支持编辑与异步）+ 自定义 deployment 注册（`createAzureModel`/`provider.createModel`、`UNKNOWN_MODEL`、`listModels`）（spec"Provider 页统一内容模板"）
- [ ] 7.2 `zh/providers/aliyun-bailian.mdx`：七段式；DashScope 配置（apiKey、Workspace baseUrl）、图像+视频模型表（数据驱动）、`providerOptions.aliyun`、`oss://` URL 自动注入 `X-DashScope-OssResourceResolve`、异步任务说明、临时 URL 提示
- [ ] 7.3 `zh/providers/volcengine.mdx`：七段式；ARK 配置、模型表（数据驱动）、`providerOptions.volcengine`（含 `optimize_prompt_options`）、size 两形态说明
- [ ] 7.4 `zh/providers/minimax.mdx`：七段式；配置、模型表（数据驱动）、`providerOptions.minimax`、视频请求必填 resolution/duration/ratio 的约束说明
- [ ] 7.5 四页错误处理段均经 `DocLink` 链接到 error-handling 页（自动携带语言段），不复制错误码表

## 8. 中文内容：uploader、FAQ 与 API 参考

- [ ] 8.1 `zh/uploader.mdx`（包参考视角）：子路径导出表、`createAliyunUploader`（三步流程、model 绑定、oss:// 自动注头、48h 过期、QPS）与 `createGoogleUploader`（可续传、生命周期 get/list/delete、2GB/20GB 限制）完整配置表、`UploadedFile` 形状、`UploaderError` 错误码表（唯一维护点）、与 file-upload 互链（design D9）
- [ ] 8.2 `zh/faq.mdx`：Key 获取与配置（Playground 浏览器本地 Key vs 集成的服务端 Key）、浏览器直连 CORS 限制与解决方向、临时 URL 过期处理、轮询超时与中止、`UNKNOWN_MODEL` 排查（spec"FAQ 覆盖常见失败场景"）
- [ ] 8.3 `zh/api-reference.mdx`：手写核心导出条目（签名/参数表/返回值/抛出错误/示例），覆盖 generateImage、editImage、submitImageTask、submitVideoTask、createTaskHandle、pixelSize、tierSize、toImageUrl、GenerationResult、TaskHandle、ImageContent、VideoContent、SdkError；同文件导出清单常量供 D10 测试引用（spec"手写 API 参考"）

## 9. 英文内容

- [ ] 9.1 `en/` 镜像翻译：入门 ×2 + 指南 ×6（由 6.x 中文源文档人工翻译审校，frontmatter 同步英文 title/description）
- [ ] 9.2 `en/providers/` ×4（由 7.x 翻译；代码示例与数据驱动组件不翻译）
- [ ] 9.3 `en/uploader.mdx`、`en/faq.mdx`、`en/api-reference.mdx`（由 8.x 翻译）
- [ ] 9.4 为每篇中文文档创建对应英文文件（结构完整性强制）；无法及时完成翻译的页面保留文件并置 `draft: true`，直接访问渲染"翻译进行中"占位页；记录 draft 清单（spec"双语文档与结构一致性"）

## 10. 落地页导航联动与 i18n

- [ ] 10.1 `locales/zh.json`/`en.json` 新增 `docs.groups.*` 分组标题、文档区 NotFound、"翻译进行中"占位、上下篇、TOC 等 UI 文案键（类型由 zh 结构约束）
- [ ] 10.2 落地页 header 增加"文档"入口（`/:lang/docs`），hero"查看文档"按钮由 GitHub 链接改为文档区（spec"文档区路由与导航"）

## 11. 测试与验证

- [ ] 11.1 `apps/site/tests/docs-content.test.ts`：manifest ↔ 文件双向一致性（每语言，draft 文件同样计入）、zh/en 文件集合一致性（draft 不豁免结构）、全部 frontmatter zod 校验（title/description 必填）、`@ai-media/sdk` 导出名集合与 api-reference 清单一致且清单符号与正文小节对应、关键页结构断言（Provider 七段标题、quick-start 章节）（design D11，spec"构建期清单一致性检查"/"双语文档与结构一致性"/"手写 API 参考"/"Provider 页统一内容模板"）
- [ ] 11.2 `bun run lint && bun run typecheck && bun run build && bun run test` 全绿
- [ ] 11.3 `bun run site:preview`：验证 `<base>/zh/docs` 与 `<base>/en/docs` 重定向、各分组深链、`/docs` 历史重定向、404 回退、深浅色主题、代码块复制、移动端抽屉导航、模型表数据与落地页一致、title/description 注入、文档内链保持语言段、draft 页占位渲染、切换文档/语言的滚动行为（spec"部署深链兼容"/"文档呈现质量"/"文档区路由与导航"）

## 12. 收尾

- [ ] 12.1 复查 diff 仅含本变更文件，提交并记录 commit hash；在 proposal 版本说明中更新实施结果（如 D6 回退决策、英文 draft 清单）
