## Context

`apps/site` 是纯前端 SPA(Vite + React Router v7),部署在 GitHub Pages 项目子路径,深链由 `postbuild.ts` 生成的 `404.html` 兜底。全部界面文案为硬编码中文,散布在 2 个页面、10+ 个组件、2 个表单 schema 与 4 个 lib 模块(错误消息)中;`packages/ui` 的 `ThemeSwitcher` 也有少量中文 tooltip(仅 site 使用)。依赖 `i18next`/`react-i18next` 已安装。

## Goals / Non-Goals

**Goals:**

- 中英文双语,语言由 URL 前缀承载(`/zh/...`、`/en/...`),可分享、可刷新。
- 翻译键静态类型化:引用不存在的键在 typecheck 阶段失败;中英词典结构一致性由类型强制。
- 切换语言不丢失 Playground 已填写表单与结果状态。
- lib 层(SDK 调用、校验、缓存)保持纯逻辑:只产出稳定错误码与英文信息,UI 层负责本地化渲染。

**Non-Goals:**

- 不做 SSR/预渲染、hreflang、按语言分包懒加载(站点体量小,全量内联)。
- 不翻译 Provider/模型专有名词本体;仅其描述性注解与推荐语进入词典。
- 不涉及 `apps/web`、SDK 包与 provider 包的行为变更。

## Decisions

### D1: react-i18next + 每语言单文件 JSON 词典

词典放 `apps/site/src/locales/{zh,en}.json`,按页面分嵌套段落(`landing`/`playground`/`settings`/`errors`/`fields`/`models`/`common`/`meta`)。

- 备选:多命名空间按页懒加载。站点总键数约 200,懒加载收益为负,且单文件更易保证结构对齐。
- 类型化:`lib/i18n/index.ts` 中 `import zh from "@/locales/zh.json"`,通过 `declare module "i18next"` 声明合并把 `typeof zh` 注入 `resources`,使 `t("landing.hero.title")` 全量类型化。
- 词典对齐:`en.json` 在 TS 包装层以 `satisfies typeof zh`(或显式 `Record` 类型)约束,缺键/多键在 typecheck 报错。

### D2: `/:lang` 布局路由 + 根路径重定向

```
/            → RootRedirect(Navigate 到 /<detected>)
/:lang       → LangLayout(校验 + changeLanguage + html lang + title)
  index      → LandingPage
  playground → PlaygroundPage
```

- `LangLayout` 校验 `lang ∈ {zh, en}`,非法时用 `useLocation` 重建路径并重定向到默认语言(保留后续路径段)。
- 语言切换走同一 route 分支的 params 变化,React Router 复用元素实例,Playground 的 `useState`(表单、结果)不会 remount —— 满足"切换语言不丢状态"。
- `basename` 仍由 `BASE_URL` 派生,`:lang` 在 basename 之内,GitHub Pages 深链(如 `/ai-media-sdk/en/playground`)由现有 `404.html` 兜底,无需部署变更。
- 页内链接改为相对路径(`to="playground"`),天然语言无关。

### D3: 语言检测与持久化(`lib/locale.ts`)

纯函数模块,便于 bun test:

- `SUPPORTED_LANGS = ["zh", "en"] as const`;默认语言 `zh`(现有文案源语言)。
- `detectLocale(saved, navigatorLanguages)`:已保存选择 > `navigator.languages` 中首个匹配(`zh*` → zh,`en*`/其他 → en)> 默认。
- 持久化键 `site.lang`(localStorage);`LangLayout` 与切换器写入。
- 语言生效时同步 `document.documentElement.lang` 与 `document.title`(键 `meta.title`)。

### D4: 表单 schema 的 label 改为翻译键

`image-form-schema.ts`/`video-form-schema.ts` 的 `label` 字段由中文文案改为词典键(如 `fields.quality`、`fields.watermark`),渲染层(`Field` 调用处与 select option 渲染)统一 `t(label)`。

- 键类型:在 `lib/i18n` 导出 `FieldLabelKey`(词典 `fields` 段的键联合),schema 的 `label` 类型收窄为该联合,防止未登记键。
- 计数型 option(`${i} 张`)改为 option 仅存 value,渲染处 `t("fields.nImages", { count })`。
- 语言中立的 option(PNG/JPEG/URL/Base64/Standard/Fast、分辨率数字)保持原样不进词典。

### D5: 错误本地化 —— 码在 lib,文案在 UI

lib 层只产出稳定 code 与英文/结构化信息,UI 用 `errors.<code>` 键渲染,`detail` 走插值:

- `SitePlaygroundResponse.error` 增加可选 `detail?: string`;`executor.ts` 的 `mapSdkErrorMessage` 改为返回英文消息(既有 executor 测试同步改为断言英文),UI 按 code 映射翻译键。
- `EndpointNotUsableError` 增加结构化 `reason`(`MISSING_FIELD`/`INVALID_ENDPOINT`/`UNCONFIRMED_HOST`)与上下文(provider/field/host),替代中文 message 拼接。
- `key-store.validateProviderEndpoint` 的 `error` 由中文文案改为错误码(`EMPTY`/`NOT_URL`/`NOT_HTTPS`/`HAS_CREDENTIALS`/`NON_STANDARD_PORT`),settings-dialog 渲染翻译。
- `image-input.ts` 的类型/大小校验改为返回码(`UNSUPPORTED_TYPE`/`TOO_LARGE` + 字节数),字段组件渲染翻译。

### D6: 注册表描述文案经词典覆写

`registry.ts` 的 `label`/`recommendation` 保持英文/语言中立(删除中文括注,如 "HappyHorse 1.1 T2V（文生视频）" → "HappyHorse 1.1 T2V"),作为回退值;UI 展示时用 `t(`models.${provider}:${id}.label`, { defaultValue })` 查词典覆写(仅对有描述性文案的模型提供覆写)。registry 测试随之更新。

### D7: ThemeSwitcher props 化

`packages/ui` `ThemeSwitcher` 新增可选 `labels?: Partial<Record<ThemeOption, string>>` 与 `ariaLabel?: string`,默认值为英文(Light/System/Dark、"Theme");site 侧从词典传入中文。该组件仅 site 使用,无其他回归面。

### D8: 语言切换器

site 本地组件(`components/language-switcher/`),渲染 `中文 / EN` 分段按钮;目标路径 = 当前 location 替换首段语言;两个页面 header 各挂一个。

## Risks / Trade-offs

- [切换语言瞬间 i18n 资源应用延迟造成文案闪烁] → 资源全量内联、`useEffect` 同步触发,实际为一帧内完成;可接受。
- [英文翻译质量由开发者代笔] → 词典集中、键语义化,后续可由母语者校对,不影响实现。
- [`en.json` 与 `zh.json` 结构漂移] → `satisfies typeof zh` 强制对齐 + typecheck 门禁。
- [错误码映射遗漏导致英文 message 直出] → UI 映射函数对未知 code 回退到通用翻译键(`errors.generic`)而非原始 message;typecheck 覆盖 code 联合。
- [既有测试断言中文消息] → 属预期变更,随实现同步更新 executor/key-store/image-input 测试。
- [`/:lang` 使旧链接 `/playground` 失效] → 根级保留 `/playground` → `/zh/playground`(按检测语言)的兼容重定向,成本极低。

## Migration Plan

单次变更合入即完成;无数据迁移。回滚 = revert 提交。部署无需变更(`404.html` 兜底天然覆盖新路径)。
