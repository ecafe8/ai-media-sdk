## Why

公开站点(`apps/site`)当前所有文案为硬编码中文,仅服务中文用户;SDK 面向国际开发者,Landing 与 BYO-key Playground 需要中英双语支持,并通过带语言的 URL 让页面可分享、可被搜索引擎按语言索引。

## What Changes

- `apps/site` 引入 react-i18next,新增 JSON 翻译词典(zh/en)与类型化资源键。
- 路由改为 `/:lang` 前缀(`/zh`、`/en`):`/` 按已保存语言或浏览器语言重定向,非法语言段重定向到默认语言。
- 语言检测与持久化(localStorage)、`<html lang>` 同步、按语言更新 `document.title`。
- Landing 与 Playground 头部新增语言切换器,切换时保留当前页面路径。
- 抽取 Landing、Playground(工作台/结果/存储)、设置弹窗、表单 schema 的全部文案到词典;表单 schema 的字段 label 改为翻译键,渲染层查表;Provider/模型等专有名词不翻译。
- lib 层错误信息保持稳定的英文标识,UI 层在提示处映射为翻译文案。
- `packages/ui` 的 `ThemeSwitcher` 增加可选 labels/ariaLabel props,默认值改为英文;站点侧传入当前语言的文案。

## Capabilities

### New Capabilities

- `site-i18n`: 站点多语言能力——语言路由、语言检测与持久化、翻译词典组织与类型安全、语言切换器。

### Modified Capabilities

- `site-shell`: SPA 路由由 `/` 与 `/playground` 变更为语言前缀路由,根路径重定向到默认语言;Landing 与 Playground 外壳文案按当前语言渲染。
- `site-deployment`: SPA 深链兜底需覆盖语言前缀路径(如 `/ai-media-sdk/en/playground`)。

## Impact

- `apps/site`:`app.tsx` 路由结构、全部页面与组件文案、`lib/playground` 表单 schema、新增 `lib/i18n` 与 `locales/` 词典、`lib/locale` 工具与单测。
- `packages/ui`:`theme-switcher` 组件 props(仅 `apps/site` 使用该组件,无其他消费方)。
- 依赖:`i18next`、`react-i18next`(已安装)。
- 部署:`postbuild.ts` 的 `404.html` 兜底机制不变,语言深链由同一机制承接;无 CI 变更。
