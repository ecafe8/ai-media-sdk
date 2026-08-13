## MODIFIED Requirements

### Requirement: Base path is configurable with a repository-derived default

构建的资源 base path SHALL 可配置,默认值 SHALL 适配 GitHub Pages 的项目站点路径(`/<仓库名>/`)。客户端 Router 的 basename SHALL 由同一 base 配置与运行时挂载路径派生:访问 pathname 位于 base path 之下时 basename 等于 base path,否则(自定义域名根挂载)为空字符串。本地开发 SHALL 使用根 base path,且不受部署 base path 影响。部署产物 SHALL 在 base path 子目录下镜像入口文档与静态资源,使同一份产物的绝对资源 URL 在项目站点路径与自定义域名根挂载下均可解析。

#### Scenario: Deployed assets resolve under the project path

- **WHEN** 站点发布到 `https://<user>.github.io/<repo>/`
- **THEN** 页面与其静态资源 SHALL 全部从该 base path 正确加载,无 404

#### Scenario: Router basename matches the asset base

- **WHEN** 访问者在项目站点子路径下打开并刷新 `/ai-media-sdk/playground`
- **THEN** Router SHALL 匹配 Playground,所有 chunk、样式和图片 SHALL 从同一 base path 加载

#### Scenario: Local dev uses root base path

- **WHEN** 开发者本地运行 dev server
- **THEN** 站点 SHALL 以根路径提供,无需部署 base path 配置

#### Scenario: Custom domain root mount resolves the mirrored assets

- **WHEN** 访问者在绑定到 Pages 的自定义域名根路径打开站点
- **THEN** 入口文档 SHALL 加载成功,其绝对资源 URL SHALL 经产物的 base path 镜像解析,无 404,且 Router basename SHALL 为空字符串以匹配根挂载

#### Scenario: Custom domain deep link is served by the fallback document

- **WHEN** 访问者在自定义域名直接请求 `/zh/playground` 等客户端路由深链
- **THEN** Pages SHALL 返回兜底入口文档,绝对资源 SHALL 经镜像解析,客户端路由 SHALL 接管并渲染对应页面
