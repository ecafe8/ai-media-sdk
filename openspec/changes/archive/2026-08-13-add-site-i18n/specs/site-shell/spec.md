## MODIFIED Requirements

### Requirement: SPA routing with landing and playground routes

站点 SHALL 提供语言前缀下的 Landing 与 Playground 客户端路由(`/zh`、`/zh/playground`、`/en`、`/en/playground`),支持浏览器前进/后退与深链访问。根路径 `/` SHALL 重定向到体验者默认语言的 Landing。Router basename SHALL 从与 Vite base 相同的配置派生,语言前缀 SHALL 位于 basename 之内;部署环境下直接访问项目子路径下的语言前缀路由(如 `/<repo>/en/playground`)SHALL 能正常渲染对应页面而非平台错误页。

#### Scenario: Deep link to the playground renders

- **WHEN** 访问者在部署环境直接打开 `/en/playground` 深链
- **THEN** 站点 SHALL 渲染英文 Playground 页而不是 404 或平台错误页

#### Scenario: Project-site basename remains aligned

- **WHEN** 站点部署在 `/<repo>/` 子路径并直接刷新 `/<repo>/zh/playground`
- **THEN** 静态资源 SHALL 返回成功,客户端 Router SHALL 匹配 Playground 路由而不是回到 Landing 或显示路由错误

#### Scenario: Root path redirects to a locale landing

- **WHEN** 访问者打开站点根路径 `/`
- **THEN** 站点 SHALL 重定向到默认语言的 Landing,且 Landing 内容按该语言渲染
