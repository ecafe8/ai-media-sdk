# Repository Instructions

## Toolchain

- Use Bun `1.3.14` and Node.js `>=20`; run `bun install` after dependency changes.
- TypeScript `^7.0.2` (tsgo native binary); `tsc --noEmit` is the type-check gate, `tsup` bundles JS, and `tsc --emitDeclarationOnly` (via each package's `tsconfig.emit-dts.json`) emits `.d.ts`.
- This is a Bun/Turborepo monorepo. Workspaces are under `apps/*`, `packages/*`, and `examples/*`.
- The root `bun.lock` is authoritative. Do not replace Bun commands with pnpm/npm commands.

## Workspace Boundaries

- `packages/ai-media-sdk`: provider-independent SDK contracts and image/video task abstractions; exports from `src/index.ts`.
- `packages/provider-*`: provider adapters; they depend on `@ai-media/sdk` and use native `fetch`, not provider SDKs.
- `packages/uploader`: upload implementations and subpath exports for core, Aliyun, and Google uploaders.
- `packages/ui`: shared Base/shadcn UI, Tailwind v4 theme, PostCSS config, and `cn`/`cva` utilities.
- `apps/web`: Next.js 16 controlled Playground; provider credentials stay on the server and must not be exposed to browser code.
- `apps/site`: Vite + React Router public site (landing + BYO-key playground); pure frontend, no server, credentials stay in the browser.
- `examples/*`: runnable provider/uploader examples. Copy the local `.env.example` to `.env`; never commit credentials.

## Commands

- Full verification after code changes: `bun run lint`, then `bun run typecheck`, `bun run build`, and `bun run test`.
- Root shortcuts: `bun run dev`, `bun run lint`, `bun run typecheck`, `bun run build`, `bun run test`, `bun run format`, `bun run docs`.
- Run one workspace task with `bunx turbo <task> --filter=<workspace>` or `bun run --cwd <workspace> <task>`.
- Run focused Bun tests with `bun run --cwd <workspace> test -- <test-path-or-pattern>`.
- `turbo test` builds dependencies first; a failed or missing build can therefore be a test prerequisite issue.
- `bun run dev` starts only `apps/web` on `http://localhost:3000`. The uploader web example has its own `bun run --cwd examples/uploader-web dev` command.
- Provider examples use `bun run --cwd examples/<name> start` after their environment file is configured.
- Verify the GitHub Pages build locally with `bun run site:preview`: it builds `apps/site` with the Pages base path and serves `dist/` (including the SPA `404.html` fallback) at `http://localhost:4173/ai-media-sdk/`. The same artifact also serves a custom domain mounted at the root path: postbuild mirrors the entry and `assets/` under the base path so absolute asset URLs resolve on both mounts, and the Router basename is detected at runtime.

## Conventions That Affect Changes

- Use directory modules with `index.ts`/`index.tsx` for application and custom components; import the directory, not `index.tsx`.
- Keep Next App Router files and build/config files in their framework-required names. `apps/web` uses `next build --webpack`.
- `packages/ui/src/components/shadcn/` is the exception: shadcn components remain single files and are imported as `@workspace/ui/components/shadcn/<name>`.
- Use `@workspace/ui/*` exports for shared UI and `@ai-media/*` workspace packages; do not create ad-hoc aliases.
- Biome is authoritative for both formatting and linting: the root `biome.json` defines double quotes, semicolons, 2 spaces, ES5 trailing commas, width 80, LF line endings, and Tailwind class sorting via the `useSortedClasses` rule (covering `cn`/`cva`/`clsx`/`tw`). Run `bun run lint` to check and `bun run format` to apply safe fixes.
- TypeScript is strict with `noUncheckedIndexedAccess`; provider and SDK packages also typecheck their `tsconfig.test.json`.

## UI Component Rules

- Prefer shadcn components whenever possible: import them from `@workspace/ui/components/shadcn/<name>` and replace native form controls with their shadcn equivalents (`<select>` → `select`, `<input type="checkbox">` → `checkbox`, other `<input>` → `input`, `<textarea>` → `textarea`, `<button>` → `button`).
- shadcn CLI config (`components.json`) lives in `packages/ui` and in each app; running `bunx shadcn@latest add <component>` from any of them installs into `packages/ui/src/components/shadcn/`. Do not create app-local copies of shadcn components.
- If shadcn has no component that directly covers a need but the need can be met by composing shadcn components, prefer the shadcn composition over a bespoke implementation.
- Ask before creating custom shared UI: before extracting a new pure-UI composite component into `packages/ui/src/components/custom/` (exported as `@workspace/ui/components/custom/<name>`), ask the user and get agreement on the placement — the component may belong in another shared location or in the consuming app layer instead.
- Business components live in the consuming app's own `components/` directory, grouped into per-feature kebab-case subdirectories with an `index.ts`/`index.tsx` entry.

## Site Layout Width Rules (`apps/site`)

- `apps/site` has one content container: `PageContainer` (`apps/site/src/components/layout/page-container/`). It is the single source of truth for the page max-width (`max-w-7xl` / 1280px) and horizontal gutter (`px-4 sm:px-6 lg:px-8`).
- Every page-level block (header inner row, sections, workbench grids, footer inner row) must be wrapped in `PageContainer` so header, content, and footer edges align; do not hand-roll `mx-auto max-w-*` or per-block horizontal padding for page layout.
- Full-bleed bars (header/footer with background or border) render a `PageContainer` inside and must not add their own horizontal padding; vertical spacing stays on the outer bar/section.

## Environment And Provider Gotchas

- Web Playground server configuration is documented in `apps/web/.env.example`; root Turbo forwards provider variables such as `AZURE_OPENAI_*`, `ALIYUN_BAILIAN_*`, `ARK_*`, and `GEMINI_API_KEY`.
- Azure uses API-key authentication and a synchronous image API. Alibaba Bailian uses native DashScope HTTP calls and asynchronous tasks; preserve task polling/result handling when changing it.
- Results and task URLs from remote providers are temporary; examples are responsible for downloading/persisting them if needed.

## OpenSpec And Git

- Product/domain requirements live under `docs/prd/`; active change artifacts live under `openspec/changes/`. Follow the repository OpenSpec skill when implementing an active change.
- Before editing, inspect `git status` and treat unrelated changes as user-owned. Before finishing, review the diff and stage only task files.
- Any implementation that changes files must end with a concise git commit on `main`; do not push, amend, rewrite history, or create empty commits unless explicitly requested. Report the commit hash.
