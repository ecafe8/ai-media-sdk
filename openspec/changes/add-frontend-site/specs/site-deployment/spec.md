## Purpose

站点发布到 GitHub Pages 的部署能力：CI 工作流自动构建与发布、可配置的 base path、SPA 深链兜底，以及"产物为纯静态资源"的约束。

## ADDED Requirements

### Requirement: Automated deployment via GitHub Actions

仓库 SHALL 提供 GitHub Actions 工作流，在推送到 main 分支与手动触发时构建站点并发布到 GitHub Pages。构建 SHALL 使用仓库工具链（Bun + Turbo）并遵循 monorepo 工作区依赖解析。工作流 SHALL 声明 `contents: read`、`pages: write`、`id-token: write` 权限，并校验部署 artifact 包含 `index.html` 与 `404.html`。

#### Scenario: Push to main publishes the site

- **WHEN** 站点相关代码合入 main 分支
- **THEN** 工作流 SHALL 自动构建 `apps/site` 并将产物发布到 GitHub Pages

#### Scenario: Manual dispatch is supported

- **WHEN** 维护者在 Actions 界面手动触发工作流
- **THEN** 工作流 SHALL 执行同样的构建与发布流程

### Requirement: Base path is configurable with a repository-derived default

构建的资源 base path SHALL 可配置，默认值 SHALL 适配 GitHub Pages 的项目站点路径（`/<仓库名>/`）。客户端 Router 的 basename SHALL 从同一 base 配置派生。本地开发 SHALL 使用根 base path，且不受部署 base path 影响。

#### Scenario: Deployed assets resolve under the project path

- **WHEN** 站点发布到 `https://<user>.github.io/<repo>/`
- **THEN** 页面与其静态资源 SHALL 全部从该 base path 正确加载，无 404

#### Scenario: Router basename matches the asset base

- **WHEN** 访问者在项目站点子路径下打开并刷新 `/ai-media-sdk/playground`
- **THEN** Router SHALL 匹配 Playground，所有 chunk、样式和图片 SHALL 从同一 base path 加载

#### Scenario: Local dev uses root base path

- **WHEN** 开发者本地运行 dev server
- **THEN** 站点 SHALL 以根路径提供，无需部署 base path 配置

### Requirement: SPA deep links are served by a fallback document

部署产物 SHALL 包含 SPA 路由兜底文档，使任意客户端路由深链在 GitHub Pages 上返回应用入口而不是平台 404。

#### Scenario: Deep link returns the app shell

- **WHEN** 直接请求部署环境中的 `/playground` 路径
- **THEN** GitHub Pages SHALL 返回应用入口文档，客户端路由接管并渲染 Playground

### Requirement: Build output is fully static

构建产物 SHALL 为纯静态资源（HTML/JS/CSS/媒体），MUST NOT 包含任何服务端运行时代码或对服务端环境变量的运行时依赖；所有 Provider 凭证 SHALL 仅在体验者浏览器中存在。

#### Scenario: No server runtime in the artifact

- **WHEN** 检查构建产物
- **THEN** 产物 SHALL 仅含静态文件，不存在服务端入口或运行时需要 `process.env` 凭证的代码路径
