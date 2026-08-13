## Why

公开站点在 GitHub Pages 配置了自定义域名 `sdk.we-media.cc`。Pages 将同一份产物同时挂在自定义域名根路径与项目站点路径 `/ai-media-sdk/` 下,而产物 HTML 硬编码绝对资源路径 `/ai-media-sdk/assets/...`、Router basename 烘焙为 `/ai-media-sdk`,导致自定义域名根路径下静态资源全部 404、页面空白。

## What Changes

- Router basename 增加运行时挂载检测:访问 pathname 位于构建 base 之下时 basename 等于 base(github.io 行为不变),否则为空字符串(自定义域名根挂载)。
- postbuild 增加镜像步骤:在产物内将入口文档与 `assets/` 复制到 base 路径子目录,使绝对资源 URL 在自定义域名根挂载下同样可解析。
- `site-deployment` spec 增加自定义域名双挂载要求与场景。
- `vite.config.ts`、CI 工作流、`index.html` 均不改动;404.html 深链兜底机制不变。

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `site-deployment`:basename 派生由"恒等于构建 base"改为运行时挂载检测;部署产物包含 base 路径下的入口与资源镜像。

## Impact

- `apps/site`:`src/app.tsx` 的 `deriveBasename()` 运行时逻辑;`scripts/postbuild.ts` 的镜像与校验逻辑。
- 部署:artifact 体积约翻倍(当前约 784K),工作流的 `index.html`/`404.html` 校验不变。
- 文档:AGENTS.md 补充双挂载说明。
- 与活跃 change `add-site-docs` 正交:其改动路由与文档页,本变更仅动 basename 派生与 postbuild。
