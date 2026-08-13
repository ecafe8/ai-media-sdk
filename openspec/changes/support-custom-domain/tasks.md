## 1. 运行时 basename

- [x] 1.1 `src/app.tsx` `deriveBasename()`:pathname 位于构建 base 之下时返回 base,否则返回空字符串;本地 dev(base `/`)行为不变。

## 2. 产物镜像

- [x] 2.1 `scripts/postbuild.ts`:从 HTML 绝对资源 URL 提取 base 前缀;前缀非空时将 `dist/index.html` 与 `dist/assets/` 镜像到 `dist/<前缀>/` 并校验镜像存在;前缀为空时跳过镜像。
- [x] 2.2 保留既有 404.html 兜底复制与绝对资源 base 校验逻辑。

## 3. 规范与文档

- [x] 3.1 `specs/site-deployment/spec.md` delta:修改 base path 要求,新增自定义域名根挂载与深链场景。
- [x] 3.2 AGENTS.md 补充"产物同时服务项路径与自定义域名根挂载"说明。

## 4. 验证

- [x] 4.1 `bun run lint`、`bun run typecheck`、`bun run build`、`bun run test`。
- [x] 4.2 `vite preview` 回归项目路径(`/ai-media-sdk/` 与深链)。
- [x] 4.3 临时静态服务器以 Pages 语义在根路径服务 `dist`,确认 `/` 与 `/zh/playground` 无资源 404。

## 5. 收尾

- [x] 5.1 提交到 `main` 并报告 commit hash。
