## Purpose

公开站点（`apps/site`）提供站内结构化文档区，让开发者无需离开站点即可阅读 SDK 入门、使用指南、Provider 参考与 API 参考；文档中的模型与能力数据直接来源于各 Provider 包的模型注册表，保证文档与代码不漂移。

## ADDED Requirements

### Requirement: 文档区路由与导航

站点 SHALL 提供 `/docs` 文档区。访问 `/docs` 时 SHALL 重定向到文档区第一篇内容；`/docs/<slug>` SHALL 渲染对应文档页，未知 slug SHALL 渲染 404 内容或回退到文档首页，不得渲染空白页。每个文档页 SHALL 提供侧边栏（列出全部文档并按固定分组与顺序排列）、当前页标题锚点目录（TOC）以及上一篇/下一篇导航。

#### Scenario: 用户从落地页进入文档区

- **WHEN** 用户在落地页点击 header 的"文档"入口或 hero 的"查看文档"按钮
- **THEN** 浏览器导航到 `/docs` 并呈现第一篇文档内容，侧边栏高亮当前页

#### Scenario: 用户访问未知文档 slug

- **WHEN** 用户访问 `/docs/non-existent-page`
- **THEN** 站点呈现 404 内容或重定向到文档首页，不渲染空白页

#### Scenario: 用户在文档间翻页

- **WHEN** 用户在一篇文档底部点击"下一篇"
- **THEN** 导航到侧边栏顺序中的下一篇文档

#### Scenario: 用户通过 TOC 定位章节

- **WHEN** 用户打开一篇含多级标题的文档并点击右侧 TOC 中的某个条目
- **THEN** 页面滚动到对应标题锚点位置，该锚点与正文标题一致

### Requirement: 部署深链兼容

文档区所有深链 SHALL 在 GitHub Pages 部署形态下可用：资源引用 SHALL 与站点统一 base path 一致，客户端路由 SHALL 经由现有 SPA 404 回退文档接管，直接访问 `/ai-media-sdk/docs/<slug>` 与本地开发访问 `/docs/<slug>` 行为一致。

#### Scenario: 直接访问部署环境深链

- **WHEN** 用户在浏览器直接打开 `<github-pages-origin>/ai-media-sdk/docs/<任一有效 slug>`
- **THEN** 页面正常加载样式与脚本，并渲染该文档内容

### Requirement: 文档信息架构完整性

文档区 SHALL 包含以下页面（slug 与顺序以文档清单为准）：入门（introduction、quick-start）；指南（image-generation、video-generation、parameters、results、error-handling、file-upload）；Provider 参考（azure-openai、aliyun-bailian、seedream）；uploader；FAQ；API 参考。文档清单与文档文件 SHALL 保持一致：清单中每个条目必须对应一个可渲染的文档，每个文档必须出现在清单中；构建期 SHALL 有自动化检查保证该一致性。API 参考条目为生成内容：清单 SHALL 显式标记生成类条目；生成产物缺失时（未运行生成步骤的开发/测试场景），对应条目 SHALL 渲染引导运行生成命令的占位页，SHALL NOT 渲染空白页或报错，一致性检查对生成类条目 SHALL 以运行生成步骤后的状态为准。

#### Scenario: 构建期清单一致性检查

- **WHEN** 执行站点测试或构建
- **THEN** 检查发现清单条目与文档文件一一对应；若存在清单有而文件缺失（或反向）的情况，检查失败并指明缺失项

#### Scenario: 开发者按信息架构查找内容

- **WHEN** 开发者打开文档侧边栏
- **THEN** 能看到"入门 / 指南 / Providers / Uploader / API 参考 / FAQ"分组及组内全部页面

### Requirement: 入门与指南内容要求

quick-start 页 SHALL 包含安装命令、运行时要求（Node.js >= 20 或 Bun、ESM-only）与一个可直接运行的最小示例（构造 Provider → `generateImage` → 读取 `result.content`）。image-generation 页 SHALL 覆盖 `generateImage` 与 `editImage` 的用法、参数预检行为（非法参数在任何网络请求前抛出 `INVALID_REQUEST`）与参考图数量上限。video-generation 页 SHALL 覆盖 `submitImageTask` / `submitVideoTask`、`TaskHandle` 字段与 `wait()` 的轮询/超时/中止选项，以及各视频输入模式（`firstFrame` / `referenceImages` / `inputVideo`）的适用条件。parameters 页 SHALL 说明公共参数（`prompt` / `n` / `size` 的像素形式与档位形式）与 `providerOptions.<provider>` 命名空间规则。results 页 SHALL 说明 `GenerationResult` / `ImageContent` / `VideoContent` 结构、`toImageUrl` 用法，并明确警告 Provider 返回的结果 URL 是临时的、需及时持久化。file-upload 页（指南视角）SHALL 说明 uploader 的开发/测试定位、Aliyun 与 Google 两条上传链路的工作流与同 `editImage` 的集成示例，并明确生产环境应使用自有持久存储；uploader 包参考细节（子路径导出、完整配置表、`UploadedFile` 形状、`UploaderError` 错误码表）SHALL 由 uploader 页作为唯一维护点，file-upload 与 uploader 两页 SHALL 互相链接且不重复维护错误码表。

#### Scenario: 新用户按 quick-start 跑通首次生成

- **WHEN** 开发者按 quick-start 页的安装命令与最小示例代码操作
- **THEN** 无需阅读源码即可得到一次成功的图像生成调用（凭据自备）

#### Scenario: 开发者了解结果 URL 风险

- **WHEN** 开发者阅读 results 页
- **THEN** 能明确得知结果 URL 会过期，并获得持久化建议

### Requirement: Provider 页统一内容模板

三个 Provider 参考页 SHALL 采用统一的七段结构：概览（定位与支持的能力）、安装、配置（工厂函数与配置字段表：字段/类型/必填/说明）、快速开始（最小可运行示例）、模型列表（模型表）、providerOptions（命名空间、字段表与示例）、限制与差异。azure-openai 页 SHALL 额外覆盖自定义 deployment 的运行时注册（未注册 deployment 抛出 `UNKNOWN_MODEL`）；aliyun-bailian 页 SHALL 额外覆盖 `oss://` 输入 URL 的自动请求头注入与 Workspace baseUrl 配置。Provider 页 SHALL NOT 重复维护错误码表，须链接到 error-handling 页。

#### Scenario: 开发者配置一个新 Provider

- **WHEN** 开发者打开任一 Provider 页
- **THEN** 能按"配置 → 快速开始 → 模型列表 → providerOptions"顺序获得该 Provider 全部可用字段与约束，无需阅读适配器源码

### Requirement: 模型与能力数据单一来源

文档中的模型列表、能力徽章（生成/编辑/异步）、size 约束、n 上限、maxEditImages、maxResolution 等元数据 SHALL 由各 Provider 包导出的模型注册表在构建/渲染期派生，SHALL NOT 以手写副本形式维护在文档正文中。

#### Scenario: 注册表新增模型后文档自动跟随

- **WHEN** 某 Provider 包的模型注册表新增一个模型并重新构建站点
- **THEN** 对应 Provider 文档页与文档区任何聚合模型表自动出现该模型及其能力元数据，无需编辑文档正文

### Requirement: 错误处理文档单一事实源

error-handling 页 SHALL 是 `SdkError` 全部错误码（含含义与默认可重试性）的唯一维护点；FAQ 与 Provider 页提及错误时 SHALL 链接该页而非复制表格。error-handling 页 SHALL 覆盖 `SdkError` 的捕获模式与 `retryable` 标记的使用建议，并说明错误信息不包含凭据与 Provider 原始响应。

#### Scenario: 开发者排查生成失败

- **WHEN** 开发者遇到 `SdkError` 并打开 error-handling 页
- **THEN** 能查到该 code 的含义、是否可重试，以及建议的处理方式

### Requirement: API 参考从源码生成

站点 SHALL 提供从 SDK、各 Provider 包与 uploader 包源码 TSDoc 自动生成的 API 参考，覆盖各包公开导出的类型与函数；API 参考 SHALL 在站点构建过程中自动生成，生成产物 SHALL NOT 提交到仓库。源码公开导出的 TSDoc 注释 SHALL 足以支撑生成内容（签名、参数、返回值、抛出错误、说明）。

#### Scenario: 源码导出变更后 API 参考跟随

- **WHEN** SDK 公开导出新增或修改并重新构建站点
- **THEN** API 参考反映最新的导出签名与 TSDoc 描述，仓库中不存在提交过的生成产物

### Requirement: FAQ 覆盖常见失败场景

FAQ 页 SHALL 至少覆盖以下主题：API Key 的获取与配置位置（含本站 Playground 的浏览器本地 Key 与集成开发中的服务端 Key 之别）、浏览器直连 Provider 的 CORS 限制说明、结果临时 URL 过期处理、异步任务轮询超时与中止、`UNKNOWN_MODEL` 排查。

#### Scenario: 开发者遇到 CORS 报错

- **WHEN** 开发者在浏览器集成中遇到 Provider CORS 错误并查阅 FAQ
- **THEN** 能理解原因（浏览器直连第三方 API 的跨域限制）并获得可行的解决方向

### Requirement: 文档呈现质量

文档页 SHALL 与站点现有视觉体系一致：使用站点统一的内容容器宽度规则、深浅色主题与共享 UI 组件；代码块 SHALL 有语法高亮且随主题切换；表格 SHALL 使用站点共享表格样式。每个文档页 SHALL 将该页标题写入浏览器标题（`document.title`）。文档语言 SHALL 为简体中文（代码、标识符、包名除外）。

#### Scenario: 深色模式下阅读文档

- **WHEN** 用户切换到深色主题并浏览任一文档页
- **THEN** 正文、代码块、表格、侧边栏均可正常阅读，无颜色失效或不可读文本

#### Scenario: 浏览器标题跟随文档页

- **WHEN** 用户打开任一文档页
- **THEN** 浏览器标题包含该页标题，与侧边栏显示的标题一致
