## Purpose

公开站点（`apps/site`）提供站内结构化双语文档区（`/:lang/docs/*`），让中英文开发者无需离开站点即可阅读 SDK 入门、使用指南、Provider 参考与 API 参考；文档元数据（标题/描述）由 MDX frontmatter 在构建期解析并自动注入页面，模型与能力数据直接来源于各 Provider 包的模型注册表，保证文档与代码不漂移。

## ADDED Requirements

### Requirement: 文档区路由与导航

站点 SHALL 在现有 `/:lang` 语言路由下提供 `/docs` 文档区：访问 `/:lang/docs` 时 SHALL 重定向到该语言文档清单第一篇；`/:lang/docs/<slug>` SHALL 渲染对应语言的文档页，未知 slug SHALL 渲染文档区 NotFound（含返回文档首页链接），不得渲染空白页。每个文档页 SHALL 提供侧边栏（列出该语言全部文档并按固定分组与顺序排列）、当前页标题锚点目录（TOC）以及上一篇/下一篇导航。历史路径 `/docs`（无语言段）SHALL 重定向到访客语言的文档区。

#### Scenario: 用户从落地页进入文档区

- **WHEN** 用户在落地页点击 header 的"文档"入口或 hero 的"查看文档"按钮
- **THEN** 浏览器导航到当前语言的 `/:lang/docs` 并呈现第一篇文档内容，侧边栏高亮当前页

#### Scenario: 用户访问未知文档 slug

- **WHEN** 用户访问 `/:lang/docs/non-existent-page`
- **THEN** 站点呈现文档区 NotFound 内容，不渲染空白页

#### Scenario: 用户通过 TOC 定位章节

- **WHEN** 用户打开一篇含多级标题的文档并点击 TOC 中的某个条目
- **THEN** 页面滚动到对应标题锚点位置

#### Scenario: 历史文档链接重定向

- **WHEN** 用户访问无语言段的 `/docs` 或其子路径
- **THEN** 站点重定向到访客语言对应的文档区路径

### Requirement: 部署深链兼容

文档区所有深链 SHALL 在 GitHub Pages 部署形态下可用：资源引用 SHALL 与站点统一 base path 一致，客户端路由 SHALL 经由现有 SPA 404 回退文档接管，直接访问 `<origin>/<base>/:lang/docs/<slug>` 与本地开发访问行为一致。

#### Scenario: 直接访问部署环境深链

- **WHEN** 用户在浏览器直接打开 `<github-pages-origin>/<base>/zh/docs/<任一有效 slug>`
- **THEN** 页面正常加载样式与脚本，并渲染该文档内容

### Requirement: 双语文档与结构一致性

文档内容 SHALL 以中文与英文双语维护，分别位于按语言划分的目录（zh 为源语言）。两种语言 SHALL 具有相同的文档集合与分组结构：每个中文文档 slug 必须存在对应英文文档，反之亦然；构建期 SHALL 有自动化检查保证双语 slug 集合一致、分组结构一致。缺失的英文文档在补齐前 SHALL 以 draft 标记排除出导航与检查，不得以机翻占位内容上线。

#### Scenario: 双语结构一致性检查

- **WHEN** 执行站点测试或构建
- **THEN** 检查发现中英 slug 集合与分组结构一致；存在单边缺失（且未标记 draft）时检查失败并指明缺失项

#### Scenario: 英文访客阅读文档

- **WHEN** 英文访客在 `/en/docs` 浏览任一已发布文档
- **THEN** 正文、侧边栏、导航文案均为英文，无中文混入

### Requirement: frontmatter 元数据自动化

每篇文档 SHALL 以 MDX frontmatter 声明 `title`、`description`、`order`（必填）与可选 `draft`；frontmatter SHALL 在构建期解析为模块导出并在加载时经 schema 校验（缺失必填字段或 slug 冲突时构建/测试失败）。文档页 SHALL 将 frontmatter 的 `title` 与 `description` 自动注入浏览器标题（`document.title`，格式 `<title> · AI Media SDK`）与 `<meta name="description">`。侧边栏、面包屑、翻页导航的标题 SHALL 读取 frontmatter，文档清单（manifest）SHALL NOT 重复维护标题文案。

#### Scenario: 浏览器标题与描述跟随文档页

- **WHEN** 用户打开任一文档页
- **THEN** `document.title` 为该页 frontmatter title 加站点后缀，`meta[name=description]` 内容为该页 frontmatter description

#### Scenario: frontmatter 缺失必填字段

- **WHEN** 某篇文档缺少 `title` 或 `description` 并执行站点测试或构建
- **THEN** 校验失败并指明出错文档

### Requirement: 文档信息架构完整性

每种语言的文档区 SHALL 包含以下页面（slug 与顺序以该语言 manifest 为准）：入门（introduction、quick-start）；指南（image-generation、video-generation、parameters、results、error-handling、file-upload）；Provider 参考（azure-openai、aliyun-bailian、volcengine、minimax）；uploader；FAQ；API 参考（api-reference）。manifest 与文档文件 SHALL 保持一致：manifest 中每个非 draft 条目必须对应一个可渲染的文档，每个非 draft 文档必须出现在 manifest 中；构建期 SHALL 有自动化检查保证该一致性。

#### Scenario: 构建期清单一致性检查

- **WHEN** 执行站点测试或构建
- **THEN** 检查发现 manifest 条目与非 draft 文档文件一一对应；存在清单有而文件缺失（或反向）时，检查失败并指明缺失项

#### Scenario: 开发者按信息架构查找内容

- **WHEN** 开发者打开文档侧边栏
- **THEN** 能看到入门 / 指南 / Providers / Uploader / FAQ / API 参考分组及组内全部页面

### Requirement: 入门与指南内容要求

quick-start 页 SHALL 包含安装命令、运行时要求（Node.js >= 20 或 Bun、ESM-only）与一个可直接运行的最小示例（构造 Provider → `generateImage` → 读取 `result.content`）。image-generation 页 SHALL 覆盖 `generateImage` 与 `editImage` 的用法、参数预检行为（非法参数在任何网络请求前抛出 `INVALID_REQUEST`）与参考图数量上限。video-generation 页 SHALL 覆盖 `submitImageTask` / `submitVideoTask`、`TaskHandle` 字段与 `wait()` 的轮询/超时/中止选项，以及各视频输入模式（`firstFrame` / `referenceImages` / `inputVideo`）的适用条件。parameters 页 SHALL 说明公共参数（`prompt` / `n` / `size` 的像素形式与档位形式）与 `providerOptions.<provider>` 命名空间规则。results 页 SHALL 说明 `GenerationResult` / `ImageContent` / `VideoContent` 结构、`toImageUrl` 用法，并明确警告 Provider 返回的结果 URL 是临时的、需及时持久化。file-upload 页（指南视角）SHALL 说明 uploader 的开发/测试定位、Aliyun 与 Google 两条上传链路的工作流与同 `editImage` 的集成示例，并明确生产环境应使用自有持久存储；uploader 包参考细节（子路径导出、完整配置表、`UploadedFile` 形状、`UploaderError` 错误码表）SHALL 由 uploader 页作为唯一维护点，file-upload 与 uploader 两页 SHALL 互相链接且不重复维护错误码表。

#### Scenario: 新用户按 quick-start 跑通首次生成

- **WHEN** 开发者按 quick-start 页的安装命令与最小示例代码操作
- **THEN** 无需阅读源码即可得到一次成功的图像生成调用（凭据自备）

#### Scenario: 开发者了解结果 URL 风险

- **WHEN** 开发者阅读 results 页
- **THEN** 能明确得知结果 URL 会过期，并获得持久化建议

### Requirement: Provider 页统一内容模板

四个 Provider 参考页 SHALL 采用统一的七段结构：概览（定位与支持的能力）、安装、配置（工厂函数与配置字段表：字段/类型/必填/说明）、快速开始（最小可运行示例）、模型列表（模型表）、providerOptions（命名空间、字段表与示例）、限制与差异。azure-openai 页 SHALL 额外覆盖自定义 deployment 的运行时注册（未注册 deployment 抛出 `UNKNOWN_MODEL`）；aliyun-bailian 页 SHALL 额外覆盖 `oss://` 输入 URL 的自动请求头注入与 Workspace baseUrl 配置；volcengine 页 SHALL 覆盖 `providerOptions.volcengine`（含 `optimize_prompt_options`）；minimax 页 SHALL 覆盖视频请求对 `providerOptions.minimax`（resolution/duration/ratio）的必填要求。Provider 页 SHALL NOT 重复维护错误码表，须链接到 error-handling 页。

#### Scenario: 开发者配置一个新 Provider

- **WHEN** 开发者打开任一 Provider 页
- **THEN** 能按"配置 → 快速开始 → 模型列表 → providerOptions"顺序获得该 Provider 全部可用字段与约束，无需阅读适配器源码

### Requirement: 模型与能力数据单一来源

文档中的模型列表、能力徽章（生成/编辑/视频/异步）、size 约束、n 上限、maxEditImages、maxResolution 等元数据 SHALL 由各 Provider 包导出的模型注册表常量在构建/渲染期派生，SHALL NOT 以手写副本形式维护在文档正文中。

#### Scenario: 注册表新增模型后文档自动跟随

- **WHEN** 某 Provider 包的模型注册表新增一个模型并重新构建站点
- **THEN** 对应 Provider 文档页与文档区任何聚合模型表自动出现该模型及其能力元数据，无需编辑文档正文

### Requirement: 错误处理文档单一事实源

error-handling 页 SHALL 是 `SdkError` 全部错误码（含含义与默认可重试性）的唯一维护点；FAQ 与 Provider 页提及错误时 SHALL 链接该页而非复制表格。error-handling 页 SHALL 覆盖 `SdkError` 的捕获模式与 `retryable` 标记的使用建议，并说明错误信息不包含凭据与 Provider 原始响应。

#### Scenario: 开发者排查生成失败

- **WHEN** 开发者遇到 `SdkError` 并打开 error-handling 页
- **THEN** 能查到该 code 的含义、是否可重试，以及建议的处理方式

### Requirement: 手写 API 参考

api-reference 页 SHALL 手写覆盖 SDK 核心公共导出：`generateImage`、`editImage`、`submitImageTask`、`submitVideoTask`、`createTaskHandle`、`pixelSize`、`tierSize`、`toImageUrl`、`GenerationResult`、`TaskHandle`、`ImageContent`、`VideoContent`、`SdkError`。每个条目 SHALL 包含签名、参数表（参数/类型/必填/说明）、返回值与抛出错误说明、使用示例；条目内容 SHALL 与源码当前签名一致，构建期无法自动校验的漂移风险 SHALL 由"API 参考与源码一致性"测试用例（至少覆盖导出名集合）缓解。自动 API 文档生成（TypeDoc/API Extractor）不在本变更范围，作为未来独立 change。

#### Scenario: 开发者查阅某个 API

- **WHEN** 开发者在 api-reference 页查找 `submitVideoTask`
- **THEN** 能看到其签名、参数表、返回值、抛出的错误类型与可运行示例

#### Scenario: SDK 导出变更被测试捕获

- **WHEN** SDK 公开导出集合发生变化并执行站点测试
- **THEN** 导出名集合校验用例失败，提示更新 api-reference 页

### Requirement: FAQ 覆盖常见失败场景

FAQ 页 SHALL 至少覆盖以下主题：API Key 的获取与配置位置（含本站 Playground 的浏览器本地 Key 与集成开发中的服务端 Key 之别）、浏览器直连 Provider 的 CORS 限制说明、结果临时 URL 过期处理、异步任务轮询超时与中止、`UNKNOWN_MODEL` 排查。

#### Scenario: 开发者遇到 CORS 报错

- **WHEN** 开发者在浏览器集成中遇到 Provider CORS 错误并查阅 FAQ
- **THEN** 能理解原因（浏览器直连第三方 API 的跨域限制）并获得可行的解决方向

### Requirement: 文档呈现质量

文档区 SHALL 优先使用站点共享 shadcn 组件构建布局与内容元素：侧边栏/移动端抽屉导航、滚动容器、分隔、提示块（Alert）、能力徽章（Badge）、数据表格（Table）、导航按钮（Button）；缺失的 shadcn 组件 SHALL 经 shadcn CLI 安装到 `packages/ui`，不在应用内自建等价物。文档页 SHALL 与站点现有视觉体系一致：统一内容容器宽度规则、深浅色主题；代码块 SHALL 有语法高亮、语言标识、复制按钮且随主题切换。每个文档页 SHALL 将该页标题写入浏览器标题。文档内容语言 SHALL 与路由语言一致（代码、标识符、包名除外）。

#### Scenario: 深色模式下阅读文档

- **WHEN** 用户切换到深色主题并浏览任一文档页
- **THEN** 正文、代码块、表格、侧边栏均可正常阅读，无颜色失效或不可读文本

#### Scenario: 移动端访问文档

- **WHEN** 用户在窄屏设备打开文档页
- **THEN** 侧边栏收纳为可展开的抽屉导航，正文保持可读
