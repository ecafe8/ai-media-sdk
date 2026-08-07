# Repository Instructions

## Toolchain

- Use Bun `1.3.14` and Node.js `>=20`; run `bun install` after dependency changes.
- This is a Bun/Turborepo monorepo. Workspaces are under `apps/*`, `packages/*`, and `examples/*`.
- The root `bun.lock` is authoritative. Do not replace Bun commands with pnpm/npm commands.

## Workspace Boundaries

- `packages/ai-media-sdk`: provider-independent SDK contracts and image/video task abstractions; exports from `src/index.ts`.
- `packages/provider-*`: provider adapters; they depend on `@ai-media/sdk` and use native `fetch`, not provider SDKs.
- `packages/uploader`: upload implementations and subpath exports for core, Aliyun, and Google uploaders.
- `packages/ui`: shared Base/shadcn UI, Tailwind v4 theme, PostCSS config, and `cn`/`cva` utilities.
- `apps/web`: Next.js 16 controlled Playground; provider credentials stay on the server and must not be exposed to browser code.
- `examples/*`: runnable provider/uploader examples. Copy the local `.env.example` to `.env`; never commit credentials.

## Commands

- Full verification after code changes: `bun run lint`, then `bun run typecheck`, `bun run build`, and `bun run test`.
- Root shortcuts: `bun run dev`, `bun run lint`, `bun run typecheck`, `bun run build`, `bun run test`, `bun run format`, `bun run docs`.
- Run one workspace task with `bunx turbo <task> --filter=<workspace>` or `bun run --cwd <workspace> <task>`.
- Run focused Bun tests with `bun run --cwd <workspace> test -- <test-path-or-pattern>`.
- `turbo test` builds dependencies first; a failed or missing build can therefore be a test prerequisite issue.
- `bun run dev` starts only `apps/web` on `http://localhost:3000`. The uploader web example has its own `bun run --cwd examples/uploader-web dev` command.
- Provider examples use `bun run --cwd examples/<name> start` after their environment file is configured.

## Conventions That Affect Changes

- Use directory modules with `index.ts`/`index.tsx` for application and custom components; import the directory, not `index.tsx`.
- Keep Next App Router files and build/config files in their framework-required names. `apps/web` uses `next build --webpack`.
- `packages/ui/src/components/shadcn/` is the exception: shadcn components remain single files and are imported as `@workspace/ui/components/shadcn/<name>`.
- Use `@workspace/ui/*` exports for shared UI and `@ai-media/*` workspace packages; do not create ad-hoc aliases.
- Prettier is authoritative: double quotes, semicolons, 2 spaces, ES5 trailing commas, width 80, and Tailwind class sorting via `prettier-plugin-tailwindcss`.
- TypeScript is strict with `noUncheckedIndexedAccess`; provider and SDK packages also typecheck their `tsconfig.test.json`.

## Environment And Provider Gotchas

- Web Playground server configuration is documented in `apps/web/.env.example`; root Turbo forwards provider variables such as `AZURE_OPENAI_*`, `ALIYUN_BAILIAN_*`, `ARK_*`, and `GEMINI_API_KEY`.
- Azure uses API-key authentication and a synchronous image API. Alibaba Bailian uses native DashScope HTTP calls and asynchronous tasks; preserve task polling/result handling when changing it.
- Results and task URLs from remote providers are temporary; examples are responsible for downloading/persisting them if needed.

## OpenSpec And Git

- Product/domain requirements live under `docs/prd/`; active change artifacts live under `openspec/changes/`. Follow the repository OpenSpec skill when implementing an active change.
- Before editing, inspect `git status` and treat unrelated changes as user-owned. Before finishing, review the diff and stage only task files.
- Any implementation that changes files must end with a concise git commit on `main`; do not push, amend, rewrite history, or create empty commits unless explicitly requested. Report the commit hash.
