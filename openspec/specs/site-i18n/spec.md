# site-i18n Specification

## Purpose
公开站点(`apps/site`)的多语言能力:语言前缀路由、语言检测与持久化、按语言渲染全部界面文案,以及不离开当前页面即可切换语言的切换器;翻译资源为纯静态数据,语言选择仅存于体验者浏览器。
## Requirements
### Requirement: 语言前缀路由

站点全部页面路由 SHALL 位于语言前缀之下,支持的语言为 `zh` 与 `en`。根路径 `/` SHALL 重定向到默认语言路径;语言段非法时 SHALL 重定向到默认语言的对应页面,不得渲染空白页或路由错误。语言前缀 SHALL 与部署 base path 正确叠加,且语言选择 SHALL 仅存于体验者浏览器,不经过任何服务端。

#### Scenario: 根路径按浏览器语言重定向

- **WHEN** 体验者首次访问 `/`(无已保存的语言选择)且浏览器语言为中文
- **THEN** 站点 SHALL 重定向到 `/zh` 并渲染中文 Landing

#### Scenario: 根路径按浏览器语言重定向(非中文)

- **WHEN** 体验者首次访问 `/` 且浏览器语言为非中文(如 `en-US`、`ja`)
- **THEN** 站点 SHALL 重定向到 `/en` 并渲染英文 Landing

#### Scenario: 已保存语言优先于浏览器语言

- **WHEN** 体验者此前已将语言切换为 `en` 并再次访问 `/`
- **THEN** 站点 SHALL 重定向到 `/en`,无论浏览器语言为何

#### Scenario: 非法语言段回退

- **WHEN** 体验者访问 `/fr/playground` 等不支持的语言前缀
- **THEN** 站点 SHALL 重定向到默认语言的对应页面并正常渲染

### Requirement: 语言检测与持久化

语言检测 SHALL 按以下优先级解析:已保存的语言选择 > 浏览器语言(中文语言环境匹配 `zh`,其余匹配 `en`)> 默认语言。体验者主动切换语言时,选择 SHALL 持久化到浏览器本地存储,并在后续访问生效。语言变化时 SHALL 同步更新文档语言标记(`lang` 属性)与页面标题。

#### Scenario: 切换语言后再次访问保持选择

- **WHEN** 体验者在 Playground 将语言从 `zh` 切换为 `en`,关闭页面后重新打开站点根路径
- **THEN** 站点 SHALL 重定向到 `/en`

#### Scenario: 语言切换同步文档元信息

- **WHEN** 体验者在任意页面切换语言
- **THEN** 文档语言标记与页面标题 SHALL 更新为对应语言的内容

### Requirement: 界面文案按当前语言渲染

站点全部面向体验者的文案 SHALL 来自当前语言的翻译资源,不得在组件中硬编码界面文案。翻译资源 SHALL 按语言与命名空间组织,且翻译键 SHALL 具备静态类型检查:引用不存在的键 SHALL 在类型检查阶段报错。计数类文案(如模型数量、生成张数)SHALL 使用插值而非拼接。Provider 名称与模型名称等专有名词不属于翻译范围。

#### Scenario: 页面不残留未翻译文案

- **WHEN** 体验者以英文打开 Landing 与 Playground 的全部界面
- **THEN** 界面文案 SHALL 全部为英文,不出现中文硬编码残留

#### Scenario: 缺失键在构建期被发现

- **WHEN** 组件引用了翻译资源中不存在的键
- **THEN** 类型检查 SHALL 失败,阻止该代码进入构建产物

### Requirement: 语言切换器保留当前页面

Landing 与 Playground 的头部 SHALL 提供语言切换器。切换 SHALL 导航到同一页面的另一语言路径,不得重置到首页;Playground 内已填写的表单与结果状态 SHALL 不因切换语言而丢失。

#### Scenario: 在 Playground 切换语言

- **WHEN** 体验者在 `/zh/playground` 已填写提示词并切换为英文
- **THEN** 站点 SHALL 导航到 `/en/playground`,界面为英文且已填写的提示词与已有结果保持不变

### Requirement: 错误提示本地化

lib 层产生的错误 SHALL 携带稳定的英文错误标识,面向体验者的提示文案 SHALL 在 UI 层按当前语言映射渲染;同一错误在中英文环境下 SHALL 表达一致的含义。

#### Scenario: 错误提示随语言变化

- **WHEN** 体验者在英文界面触发一个配置缺失类错误
- **THEN** 提示文案 SHALL 为英文;同样错误在中文界面下 SHALL 显示对应中文文案

