## 1. i18n 基础设施

- [x] 1.1 创建 `apps/site/src/locales/zh.json` 与 `en.json` 词典骨架(landing/playground/settings/errors/fields/models/common/meta 段落,先含路由/头部所需最小键集)
- [x] 1.2 创建 `lib/i18n/index.ts`:i18next 初始化(supportedLngs、fallbackLng、resources 内联)、`resources` 声明合并类型、导出 `FieldLabelKey` 等键类型
- [x] 1.3 创建 `lib/locale.ts`:`SUPPORTED_LANGS`、默认语言、`detectLocale`、localStorage 持久化读写;在 `main.tsx` 引入 i18n 初始化
- [x] 1.4 为 `lib/locale.ts` 编写 bun 单测(检测优先级、非法值回退、持久化读写)

## 2. 语言路由与切换器

- [x] 2.1 重构 `app.tsx`:`/` 重定向、`/:lang` 布局路由 + `index`/`playground` 子路由、非法语言回退、兼容旧 `/playground` 重定向
- [x] 2.2 实现 `LangLayout`:校验 lang、`changeLanguage`、同步 `document.documentElement.lang` 与 `document.title`、非法时保留后续路径重定向
- [x] 2.3 创建 `components/language-switcher/`:中/EN 切换,目标路径保留当前页面
- [x] 2.4 页面内链接改为相对路径(landing/playground 中的 `to="/playground"` 等)

## 3. Landing 文案抽取

- [x] 3.1 抽取 `pages/landing`:hero、badge、CTA、feature 卡、隐私条款、footer、页面标题
- [x] 3.2 抽取模型矩阵:能力徽章、模型数量(插值);`registry.ts` 中文括注改为语言中立,词典提供 `models.<provider>:<id>` 覆写(label/recommendation),更新 registry 测试
- [x] 3.3 landing 头部挂载语言切换器

## 4. Playground 文案抽取

- [x] 4.1 抽取 `components/playground/index.tsx` 外壳:环境状态、模态页签、API 设置按钮、footer 说明
- [x] 4.2 表单 schema 键化:`image-form-schema.ts`/`video-form-schema.ts` 的 label 改为 `FieldLabelKey`;`imageNOptions` 等计数 option 改由渲染层插值
- [x] 4.3 抽取 `image-workbench`:字段标签、占位符、校验提示、按钮、provider/模型选择器文案
- [x] 4.4 抽取 `video-workbench`:场景选择、字段标签、校验提示、提示文案
- [x] 4.5 抽取 `result-feed`、`result-panel`、`result-storage-panel`、`image-list-field`、`image-source-field`
- [x] 4.6 playground 头部挂载语言切换器;验证切换语言后表单与结果状态保留

## 5. 设置弹窗与错误本地化

- [x] 5.1 `key-store.validateProviderEndpoint` 错误码化,settings-dialog 按码翻译(同步更新 key-store 测试)
- [x] 5.2 `provider-client.EndpointNotUsableError` 结构化(reason + 上下文),executor 透传
- [x] 5.3 `executor.mapSdkErrorMessage` 改为英文消息;错误响应增加 `detail`;UI 按 `errors.<code>` 渲染(同步更新 executor 测试)
- [x] 5.4 `image-input.ts` 校验码化,字段组件渲染翻译(同步更新 image-input 测试)
- [x] 5.5 抽取 settings-dialog 全部文案(标题、安全说明、表单标签、提示、按钮、状态徽章)

## 6. 共享组件与收尾

- [x] 6.1 `packages/ui` ThemeSwitcher 增加可选 `labels`/`ariaLabel` props,默认英文;site 侧传入词典文案
- [x] 6.2 全量检查中文残留(`rg "[\u4e00-\u9fff]" apps/site/src`,词典除外),补齐遗漏键
- [x] 6.3 词典完整性:确认 en.json 与 zh.json 结构一致(typecheck 门禁)
- [x] 6.4 验证:`bun run lint`、`bun run typecheck`、`bun run build`、`bun run test`
- [x] 6.5 `bun run site:preview` 验证 `/ai-media-sdk/` 根重定向、`/zh/playground`、`/en/playground` 深链与语言切换
