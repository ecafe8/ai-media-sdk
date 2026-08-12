## 1. MDX 管线搭建

- [ ] 1.1 `apps/site` 新增依赖：`@mdx-js/rollup`、`remark-gfm`、`rehype-slug`、`rehype-highlight`（`bun install`，更新 `bun.lock`）
- [ ] 1.2 `vite.config.ts` 挂载 mdx 插件（`include` 仅 `src/content/docs/**/*.{md,mdx}`，配置 remark/rehype 插件）
- [ ] 1.3 `vite-env.d.ts` 增加 `*.md`/`*.mdx` 模块声明
- [ ] 1.4 创建 `src/content/docs/` 与最小占位文档（introduction），`bun run --cwd apps/site dev` 验证渲染、代码高亮、深链刷新；`build` 验证产物（design D1/D7，spec"文档呈现质量"）

## 2. 清单、路由与布局

- [ ] 2.1 `src/content/docs/manifest.ts`：定义分组（入门/指南/Providers/Uploader/API 参考/FAQ）与全部 14 篇手写页的 slug、标题、顺序（design D2）
- [ ] 2.2 文档模块收集：`import.meta.glob` eager 收集，slug 归一化（去扩展名），导出按 slug 查表 API
- [ ] 2.3 `app.tsx` 增加 `/docs`（重定向首篇）与 `/docs/*` 嵌套路由；未知 slug 渲染文档区 NotFound（spec"文档区路由与导航"）
- [ ] 2.4 `pages/docs/` 与 `components/docs/docs-layout/`：侧边栏（manifest 驱动、当前页高亮、分组标题）+ 文章区 + TOC（mount 后收集 `article h2/h3`，`rehype-slug` 锚点，窄屏隐藏）+ 上一篇/下一篇（manifest 扁平顺序派生）；布局包在 `PageContainer` 内，遵守站点宽度规则（design D2/D4）
- [ ] 2.5 文章排版样式：`article` 语义标签 + 手写 Tailwind prose 样式（标题/段落/表格/代码块/列表/链接），深浅色主题均可读；代码块引入 highlight.js light/dark 主题 CSS（仅 `.hljs` 作用域）（design D2/D7，spec"文档呈现质量"）

## 3. 数据驱动组件

- [ ] 3.1 `components/docs/provider-model-table/`：props 接收 provider 注册表常量，渲染模型表（id/label/能力徽章/size/maxN/maxEditImages/maxResolution）；`components/docs/capability-badges/`：与落地页语义对齐的能力徽章（design D3，spec"模型与能力数据单一来源"）
- [ ] 3.2 文档区聚合模型表组件（可选被 introduction/FAQ 引用），数据源同 3.1
- [ ] 3.3 `components/docs/callout/`：基于 shadcn `alert` 组合（不新建共享 UI 包组件）

## 4. 内容：入门

- [ ] 4.1 `introduction.mdx`：架构总览（契约→Provider 工厂→模型实例→生成函数）、同步 vs 异步、包家族一览、站点 Playground 与文档关系（spec"文档信息架构完整性"）
- [ ] 4.2 `quick-start.mdx`：安装命令、运行时要求（Node>=20/Bun、ESM-only）、最小可运行示例、结果读取；示例与 `examples/*` 及 README 对齐（spec"入门与指南内容要求"）

## 5. 内容：指南

- [ ] 5.1 `image-generation.mdx`：`generateImage`/`editImage`、预检行为（网络请求前抛 `INVALID_REQUEST`）、参考图上限、字面量模型 id 编译期收窄（spec"入门与指南内容要求"）
- [ ] 5.2 `video-generation.mdx`：`submitImageTask`/`submitVideoTask`、`TaskHandle` 字段表、`wait()` 的 pollIntervalMs/timeoutMs/signal、输入模式（firstFrame/referenceImages/inputVideo）适用条件
- [ ] 5.3 `parameters.mdx`：公共参数 prompt/n/size（像素形式 `WxH` 与档位形式）、`pixelSize`/`tierSize`、`providerOptions.<provider>` 命名空间规则、未知公共字段被预检拒绝
- [ ] 5.4 `results.mdx`：`GenerationResult`/`ImageContent`/`VideoContent`、`toImageUrl`、临时 URL 过期警告与持久化建议（可引用站点自动保存功能作 Playground 提示）
- [ ] 5.5 `error-handling.mdx`：`SdkError` 全错误码表（code/含义/默认可重试）——唯一事实源、捕获模式、`retryable` 与退避建议、错误信息不含凭据说明（spec"错误处理文档单一事实源"）
- [ ] 5.6 `file-upload.mdx`：uploader 定位（开发/测试）、子路径导出表、`createAliyunUploader`（三步流程、model 绑定、oss:// 自动注头、48h 过期、QPS）、`createGoogleUploader`（可续传、生命周期 get/list/delete、2GB/20GB 限制）、`UploadedFile`/`UploaderError` 错误码、生产用自有存储提示（spec"入门与指南内容要求"）

## 6. 内容：Provider 参考（七段式模板）

- [ ] 6.1 `providers/azure-openai.mdx`：概览/安装/配置字段表（apiKey/endpoint/apiVersion）/快速开始/模型表（`ProviderModelTable`，数据驱动）/`providerOptions.azure` 字段表（quality/output_format/output_compression）/限制（仅同步、n=1、不支持编辑与异步）+ 自定义 deployment 注册（`createAzureModel`/`provider.createModel`、`UNKNOWN_MODEL`、`listModels`）（spec"Provider 页统一内容模板"）
- [ ] 6.2 `providers/aliyun-bailian.mdx`：同七段式；覆盖 DashScope 配置（apiKey、Workspace baseUrl）、图像 + 视频模型表（数据驱动）、`providerOptions.aliyun`、`oss://` URL 自动注入 `X-DashScope-OssResourceResolve`、异步任务说明、临时 URL 提示
- [ ] 6.3 `providers/seedream.mdx`：同七段式；覆盖 ARK 配置、模型表（数据驱动）、`providerOptions.ark`、size 两形态（supportedSizes + maxResolution）说明
- [ ] 6.4 三页错误处理段均链接 `/docs/error-handling`，不复制错误码表

## 7. 内容：uploader 与 FAQ

- [ ] 7.1 `uploader.mdx`（侧边栏 Uploader 分组）：整合 file-upload 之外的参考细节或与 file-upload 合理分工（file-upload 为指南视角，uploader 页为包参考视角：子路径导出、两个工厂的完整配置表、`UploadedFile` 形状、错误码表）
- [ ] 7.2 `faq.mdx`：Key 获取与配置（Playground 浏览器本地 Key vs 集成的服务端 Key）、浏览器直连 CORS 限制与解决方向、临时 URL 过期处理、轮询超时与中止、`UNKNOWN_MODEL` 排查（spec"FAQ 覆盖常见失败场景"）

## 8. TypeDoc API 参考

- [ ] 8.1 根 devDependencies 新增 `typedoc`、`typedoc-plugin-markdown`；根脚本 `docs:generate`，typedoc 配置（入口：`@ai-media/sdk`、3 个 provider、uploader 的 `src/index.ts`；输出 `apps/site/src/content/docs/api/`；`outputFileStrategy: members`）；`api/` 目录加入 `.gitignore`（design D5，spec"API 参考从源码生成"）
- [ ] 8.2 remark 链接重写小插件：生成文档间相对 `.md` 链接重写为 `/docs/api/...` 站内链接；若复杂度超预算，切换回退方案（TypeDoc HTML → `dist/api-reference/`，侧边栏外链），并在本任务记录决策
- [ ] 8.3 `turbo.json` 新增 `docs:generate` 任务，site `build` dependsOn 它；核对 GitHub Pages 部署工作流无需额外步骤
- [ ] 8.4 manifest 登记 API 参考入口（每包一条），生成产物可渲染、链接可跳转、深浅色可读

## 9. 落地页导航联动

- [ ] 9.1 落地页 header 增加"文档"入口（`/docs`），hero"查看文档"按钮由 GitHub 链接改为 `/docs`（spec"文档区路由与导航"）

## 10. 测试与验证

- [ ] 10.1 `apps/site/tests/docs-manifest.test.ts`：manifest ↔ 文档文件双向一致性、分组非空、模块默认导出存在（spec"构建期清单一致性检查"）
- [ ] 10.2 `bun run lint && bun run typecheck && bun run build && bun run test` 全绿
- [ ] 10.3 `bun run site:preview`：验证 `/ai-media-sdk/docs` 重定向、各分组深链、404 回退、深浅色主题、模型表数据与落地页一致（spec"部署深链兼容"）

## 11. 收尾

- [ ] 11.1 复查 diff 仅含本变更文件，`main` 上提交并记录 commit hash
