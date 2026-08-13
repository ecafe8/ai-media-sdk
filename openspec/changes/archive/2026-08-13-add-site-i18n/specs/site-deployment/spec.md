## MODIFIED Requirements

### Requirement: SPA deep links are served by a fallback document

部署产物 SHALL 包含 SPA 路由兜底文档,使任意客户端路由深链(包括语言前缀路径)在 GitHub Pages 上返回应用入口而不是平台 404。

#### Scenario: Deep link returns the app shell

- **WHEN** 直接请求部署环境中的 `/zh/playground` 或 `/en/playground` 路径
- **THEN** GitHub Pages SHALL 返回应用入口文档,客户端路由接管并渲染对应语言的 Playground

#### Scenario: Root deep link returns the app shell

- **WHEN** 直接请求部署环境的根路径
- **THEN** GitHub Pages SHALL 返回应用入口文档,客户端路由接管并重定向到默认语言 Landing
