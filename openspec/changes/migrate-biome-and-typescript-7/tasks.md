## 1. Phase A — Add Biome configuration

- [ ] 1.1 Add `@biomejs/biome@^2.5.7` to root `package.json` `devDependencies`
- [ ] 1.2 Create root `biome.json` with formatter settings mapped from `.prettierrc` (D4), `useSortedClasses` for `cn`/`cva`/`tw` (D3), `noUnusedVariables` with `^_` ignore pattern (D5), `css.parser.tailwindDirectives: true`, and `vcs.useIgnoreFile: true`; scope React rules under `apps/web`, `packages/ui`, `examples/uploader-web`
- [ ] 1.3 Run `bun install` and verify `bunx biome --version` resolves the native binary

## 2. Phase A — Replace lint/format scripts

- [ ] 2.1 Replace root `package.json` `lint` script (`turbo lint`) with `biome lint` and `format` script (`turbo format`) with `biome format --write`
- [ ] 2.2 Remove `lint` and `format` scripts from the 8 workspace `package.json` files (ai-media-sdk, provider-aliyun-bailian, provider-azure-openai, provider-seedream, ui, uploader, apps/web, examples/uploader-web)
- [ ] 2.3 Simplify `turbo.json` `lint` and `format` tasks (L21-26): remove `dependsOn: ["^lint"]`/`["^format"]` so they run once at root, or delete the two task entries if root scripts call Biome directly
- [ ] 2.4 Verify `scripts/release-check.ts:207` still calls `bun run lint` (no source change needed; confirm the contract holds)

## 3. Phase A — Remove ESLint and Prettier

- [ ] 3.1 Delete `packages/eslint-config/` workspace (`base.js`, `next.js`, `react-internal.js`, `package.json`, `README.md`)
- [ ] 3.2 Delete the 8 per-workspace `eslint.config.js` files and the root `.eslintrc.js` legacy stub
- [ ] 3.3 Remove the `@workspace/eslint-config` workspace entry from root `package.json` `workspaces` array (and any `workspace:^` references in `apps/web`/`packages/ui`/`examples/uploader-web` `devDependencies`)
- [ ] 3.4 Remove ESLint/Prettier devDependencies from root and all workspaces: `prettier`, `prettier-plugin-tailwindcss`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `typescript-eslint`, `@next/eslint-plugin-next`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-turbo`, `eslint-plugin-only-warn`, `eslint-config-prettier`, `globals`, `@eslint/js`
- [ ] 3.5 Delete `.prettierrc` (formatting contract now lives in `biome.json`)
- [ ] 3.6 Run `bun install` to update `bun.lock`

## 4. Phase A — Validate and reformat

- [ ] 4.1 Run `bunx biome format --write` as a standalone reformat commit (D-risk mitigation) and review the diff
- [ ] 4.2 Run `bun run lint` — fix any Biome rule violations (expect `noUnusedImports`/`noUnusedVariables` churn from rule differences)
- [ ] 4.3 Run `bun run typecheck` — confirm TS 5.9.3 type-checking is unaffected
- [ ] 4.4 Run `bun run build` — confirm tsup build of 5 publishable packages is unaffected
- [ ] 4.5 Run `bun run test` — confirm Bun test runner is unaffected
- [ ] 4.6 Run `bun run release:check` end-to-end — confirm green
- [ ] 4.7 Commit Phase A on `main` (Biome swap, green gate established)

## 5. Phase A — Documentation

- [ ] 5.1 Update `AGENTS.md` "Conventions That Affect Changes" bullet: replace "Prettier is authoritative..." with Biome authoritativeness (formatter + linter, config in root `biome.json`)
- [ ] 5.2 Remove `AGENTS.md` references to `packages/eslint-config` if any
- [ ] 5.3 Update the "Full verification after code changes" command list if it references Prettier (`bun run format` now runs Biome — command name unchanged, behavior documented)

## 6. Phase B — Upgrade TypeScript to 7.0.2

- [ ] 6.1 Bump `typescript` from `^5` to `^7.0.2` in root `package.json` and the ~9 workspace `package.json` files (ai-media-sdk, uploader, provider-azure-openai, provider-aliyun-bailian, provider-seedream, ui, apps/web, examples/uploader-web)
- [ ] 6.2 Normalize `@types/node` to `^20` in the 5 `examples/*` that currently pin `^26.1.2` (D7)
- [ ] 6.3 Run `bun install` and verify `bunx tsc --version` resolves the `@typescript/typescript-darwin-arm64` native binary (reports 7.0.2)

## 7. Phase B — Validate typecheck

- [ ] 7.1 Run `bun run typecheck` — resolve any new tsgo diagnostics against `NodeNext` + `noUncheckedIndexedAccess` + `isolatedModules` (tsgo README: "same errors as TS 6.0"; expect near-zero diff)
- [ ] 7.2 Specifically validate the 5 library packages' `tsc -p tsconfig.test.json --noEmit` path
- [ ] 7.3 Validate `apps/web` `tsc --noEmit`

## 8. Phase B — Validate build (tsup × tsgo declaration emit)

- [ ] 8.1 Snapshot pre-upgrade `dist/**/*.d.ts` baseline for the 5 publishable packages (ai-media-sdk, uploader, provider-azure-openai, provider-aliyun-bailian, provider-seedream)
- [ ] 8.2 Run `bun run build` and diff `.d.ts` against baseline (D6)
- [ ] 8.3 If diffs are cosmetic (whitespace, qualifier ordering) — accept and proceed
- [ ] 8.4 If diffs break consumers — attempt `tsc --emitDeclarationOnly` fallback for `.d.ts` while keeping tsup for JS emit
- [ ] 8.5 If tsgo declaration emit is fundamentally incompatible with tsup's `rollup-plugin-dts` — halt Phase B, keep Phase A shipped, document blocker in this change's design.md Open Questions

## 9. Phase B — Validate apps/web and full pipeline

- [ ] 9.1 Run `next build --webpack` in `apps/web`; if type-check integration issues surface, bump Next 16.2.6 → 16.3.0
- [ ] 9.2 Run `bun run lint` (Biome — should be unaffected by TS version)
- [ ] 9.3 Run `bun run test` (Bun runner — independent of `typescript` package)
- [ ] 9.4 Run `bun run release:check` end-to-end (lint → typecheck:release → build → test → pack)
- [ ] 9.5 Commit Phase B on `main` (tsgo 7.0.2, green gate) — report commit hash

## 10. Phase B — Documentation

- [ ] 10.1 Update `AGENTS.md` Toolchain bullet: TypeScript `^5` → `^7.0.2` and note tsgo native binary
- [ ] 10.2 Update `packages/typescript-config/README.md` if it references TS 5.x specifics
- [ ] 10.3 Archive this change via the OpenSpec archive workflow once both phases are merged and green
