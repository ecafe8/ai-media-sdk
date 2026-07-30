<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Every implementation task that changes files MUST end with a git commit before the final response.

- Inspect `git status` before editing and treat pre-existing or concurrent changes as user-owned.
- Review the final diff and run proportionate verification before committing.
- Stage only files or hunks that belong to the current task. Never bundle unrelated changes unless the user explicitly asks.
- Use a concise descriptive commit message on `main`, report the commit hash, and do not push, amend, or rewrite history unless asked.
- Read-only tasks and tasks with no file changes do not create empty commits.

## 项目上下文（AI Media SDK）

- 本仓库是 **AI Media SDK**：面向 Node.js 服务端的多 Provider 多模态生成 SDK。MVP 聚焦图像生成，核心类型模态无关泛型化，预留视频/音频（P1/P2）。产品需求见 `docs/prd/`。
- 包 scope `@ai-media/*`：核心契约包 `@ai-media/sdk`，Provider 包 `@ai-media/provider-<name>`（按平台拆分，纯 fetch，不包装官方 SDK）。根包名 `ai-media-sdk`。
- SDK/Provider 包与 `examples/*` **尚未创建**；当前只有 `apps/web`、`packages/ui`、`packages/eslint-config`、`packages/typescript-config`。新增包时按上述 scope 与目录约定建立。
- Provider 接入约定：Azure OpenAI 仅 API Key 鉴权（`api-key` 头）、同步图像 API；阿里云百炼无官方 JS SDK，原生 fetch 直连 DashScope 异步任务 API；wan/qwen 是否拆包待 live 契约探查后定。详见 `docs/prd/sub-provider-adapters/`。
- `apps/web` 当前不作为产品控制台，首期承载受控 Web Playground；Node.js SDK 示例将放在 `examples/*` 并为各 Provider 提供 `.env.example`。

## 工具链与命令

- 包管理器 **Bun**（`bun@1.3.14`，`engines.node >=20`）。用 `bun`、`bunx --bun`、`bun install`。`README.md` 中的 `pnpm dlx` 已过时，请忽略。
- 根命令由 Turbo 调度，遵循 `^build/^lint/^typecheck/^format` 依赖顺序：

  ```
  bun run dev        # 仅 apps/web，端口 3000
  bun run build
  bun run lint
  bun run typecheck
  bun run format
  bun run submodule  # 初始化/更新只读参考 submodule
  ```

- 只跑单个工作区：`turbo <task> --filter=web`（或 `--filter=@workspace/ui`）。每个工作区也有自己的 `lint` / `format` / `typecheck` 脚本。
- 改代码后按 **`lint → typecheck → build`** 验证。
- **当前没有测试框架与 `test` 脚本**，不要编造测试命令。测试基线将来用 `bun:test`。

## 工作区结构

| 路径 | 包名 | 作用 |
| --- | --- | --- |
| `apps/web` | `web` | Next.js 应用（端口 3000） |
| `packages/ui` | `@workspace/ui` | 共享 shadcn 组件库、`cn` 工具函数、`globals.css`、PostCSS 配置 |
| `packages/eslint-config` | `@workspace/eslint-config` | 共享 ESLint 配置：`base`、`next`、`react-internal` |
| `packages/typescript-config` | `@workspace/typescript-config` | 共享 tsconfig：`base.json`、`nextjs.json`、`react-library.json` |

- `.reference/zbx-template-monorepo` 是只读 git submodule，仅作组件/examples 页面参考；**不纳入 workspaces、turbo、ESLint ignore、Tailwind `@source` 与构建**。examples 页面布局可参考其 `examples/ui-blocks` 的 app-shell/preview 模式。

## 导入约定

- shadcn 组件：`@workspace/ui/components/shadcn/<name>`（如 `button`）。
- 工具函数：`@workspace/ui/lib/utils`（导出 `cn`）；Hooks：`@workspace/ui/hooks/*`；全局样式：`@workspace/ui/globals.css`；PostCSS 配置：`@workspace/ui/postcss.config`。
- 应用本地代码用 `@/*`（映射应用根目录）；`@workspace/ui/*` 映射 `packages/ui/src/*`。
- 导入**目录**而非文件：`@/components/block-page-header`，不写 `.../index.tsx`（shadcn 单文件组件例外）。

## shadcn 配置

- 样式 `base-luma`，基础色 `neutral`，图标库 `lucide`，`rsc` 与 `tsx` 开启。
- shadcn 组件以**单文件**存放在 `packages/ui/src/components/shadcn/`（如 `button.tsx`），不要改成 `folder/index.tsx`。
- 仓库有两个 `components.json`（`apps/web`、`packages/ui`）；应用级配置把 CSS 指向 `../../packages/ui/src/styles/globals.css`，`ui` 别名指向 `@workspace/ui/components/shadcn`。
- 根目录增删组件：`bunx --bun shadcn@latest add <name> --cwd packages/ui`。
- 扩展非 shadcn 自有基础组件时，在 `packages/ui/src/components/` 下另起子目录（如 `base/`）并单独定义导入路径，不要污染 `shadcn/`。

## 代码风格

- Prettier：**有分号**（`semi: true`）、双引号、2 空格缩进、`es5` 尾随逗号、`printWidth 80`。启用 Tailwind class 排序（`prettier-plugin-tailwindcss`），识别 `cn` 与 `cva` 为样式函数。
- TypeScript：`strict` + `noUncheckedIndexedAccess`。基础配置用 `NodeNext`；Next.js 应用用 `Bundler` 解析 + `ESNext` 模块。
- ESLint 为 flat config（每工作区 `eslint.config.js`）。`apps/web` 用 `@workspace/eslint-config/next-js`；`packages/ui` 用 `@workspace/eslint-config/react-internal`。`turbo/no-undeclared-env-vars` 为 `warn`，配合 `eslint-plugin-only-warn`，警告不导致失败。
- Tailwind CSS v4，经 `@tailwindcss/postcss`；无 `tailwind.config`，主题 token 位于 `packages/ui/src/styles/globals.css`。

<!-- BEGIN:module-naming-rules -->
# 模块命名规则

适用范围：`apps/web` 业务模块与 `packages/ui` 下非 shadcn 自有组件；shadcn 单文件组件与框架特殊文件例外。

## 文件组织

- 普通模块统一 `文件夹 + index.ts|tsx`：`components/example-section/index.tsx`。
- 目录名 `kebab-case`：`block-page-container/`、`pricing-cards/`。
- 导入引用目录，不引用具体文件：`@/components/block-page-header`，而非 `.../index.tsx`。
- 按职责收敛目录，例如应用壳层归 `components/app-shell/`、预览系统归 `components/preview/`、全局 Provider 归 `components/providers/`。

## 第三方组件例外

`packages/ui/src/components/shadcn/` 由 shadcn CLI 生成维护，不遵循本规则：

- 保留官方单文件名，例如 `button.tsx`、`dialog.tsx`，不迁移为 `button/index.tsx`。
- 统一通过 `@workspace/ui/components/shadcn/<name>` 导入。
- 经 `bunx --bun shadcn@latest add <name> --cwd packages/ui` 增删，优先保持官方生成结构。

## 框架例外

以下文件属框架约定的特殊文件，不改为 `index.ts|tsx`，否则路由发现或构建配置会失效：

- Next.js App Router 特殊文件：`app/layout.tsx`、`app/page.tsx`、`app/<segment>/layout.tsx`、`app/<segment>/page.tsx`。
- 构建与工具配置：`next.config.ts`、`eslint.config.js`、`postcss.config.mjs`、`tsconfig.json`、`components.json`。

这些文件所在目录名仍用 `kebab-case`。

## 命名方式

- 组件导出 `PascalCase`：`export function BlockPageContainer() {}`。
- 变量与函数 `camelCase`：`const previewMode = "desktop"`。
- 模块级不可变配置与枚举映射 `ALL_CAPS`：`const PREVIEW_WIDTHS = {} as const`。不要把普通 `const` 都改成大写。
- 类型与接口 `PascalCase`：`export type PreviewMode = "mobile" | "tablet" | "desktop"`。
- 私有成员 `_` 前缀仅在确实使用 `class` 时遵循，React 函数式组件不强制改写为 class。

## 注释

- 为公共组件、公共类型和非显而易见的工具函数补充 JSDoc。
- 逻辑直观的小型内部组件无需冗余注释。
- 默认不添加代码内注释，除非解释非显而易见的逻辑。
<!-- END:module-naming-rules -->
