## Why

The repository pins TypeScript `^5` (resolved 5.9.3). TypeScript 7.0.2 — the
native Go rewrite ("tsgo") — is now npm `latest`, delivering an order-of-
magnitude faster type-checking and emit. Upgrading is blocked today by
`@typescript-eslint/*` (v8.66.0, incl. canary), whose peer range is
`typescript: >=4.8.4 <6.1.0` and which imports the TS Compiler API at runtime;
tsgo's Compiler API is officially `not ready`. This blocks `bun run lint` and,
transitively, `release:check` (`scripts/release-check.ts:207`).

Replacing the ESLint + Prettier stack with Biome removes the blocker: Biome
parses TypeScript itself and does not depend on the `typescript` npm package,
so tsgo's API status is irrelevant. Biome also ships a `useSortedClasses` rule
that covers the current `prettier-plugin-tailwindcss` Tailwind-class sorting
(`.prettierrc:8-10`). With the lint gate decoupled from `typescript`, the TS
7.0.2 upgrade becomes feasible on a green pipeline.

## What Changes

### Phase A — Replace ESLint + Prettier with Biome (on TS 5.9.3, green gate)

- **BREAKING (dev-facing)** Remove `packages/eslint-config` workspace
  (`base.js`, `next.js`, `react-internal.js`) and all 8 per-workspace
  `eslint.config.js` files plus the root `.eslintrc.js` legacy stub.
- Add a single root `biome.json` carrying the equivalent configuration:
  `recommended` rules, `useSortedClasses` (on; `functions: ["cn","cva","tw",
  "tw.*"]`, matching `.prettierrc:10`), `noUnusedVariables`/`noUnusedImports`
  with `^_` ignore pattern (matching `ai-media-sdk/eslint.config.js:8-15`),
  formatter settings aligned to `.prettierrc` (double quotes, semicolons,
  2-space, ES5 trailing comma, width 80, LF), and
  `css.parser.tailwindDirectives: true` for Tailwind v4.
- Replace root `lint`/`format` scripts (`package.json:8-9`) with `biome lint`
  and `biome format --write`; remove the 8 per-workspace `lint`/`format`
  scripts (ai-media-sdk, provider-{aliyun-bailian,azure-openai,seedream}, ui,
  uploader, apps/web, examples/uploader-web).
- Simplify `turbo.json` `lint`/`format` tasks (L21-26) — Biome scans the whole
  repo once from root.
- Drop devDependencies: `prettier`, `prettier-plugin-tailwindcss`, `eslint`,
  `@typescript-eslint/*`, `typescript-eslint`, `@next/eslint-plugin-next`,
  `eslint-plugin-{react,react-hooks,turbo,only-warn}`, `eslint-config-prettier`,
  `globals`, and the `@workspace/eslint-config` workspace reference.
- Add devDependency `@biomejs/biome: ^2.5.7` (no peer dependencies; native
  binary).
- **Known rule-coverage losses (accepted)**: `turbo/no-undeclared-env-vars`
  (already mitigated by `turbo.json` `globalEnv`, L4-14) and
  `@next/eslint-plugin-next` `core-web-vitals` ruleset (Next 16 is deprecating
  `next lint`).

### Phase B — Upgrade TypeScript 5.9.3 → 7.0.2 (tsgo)

- Bump `typescript: "^5"` → `"^7.0.2"` across root and ~9 workspaces.
- `bun install` pulls the `@typescript/typescript-darwin-arm64` native binary.
- Validate `typecheck` (5 library packages run `tsc -p tsconfig.test.json
  --noEmit`) against tsgo's NodeNext + `noUncheckedIndexedAccess` +
  `isolatedModules` behavior (tsgo README: "same errors as TS 6.0").
- Validate `build` for the 5 publishable packages: `tsup --dts` declaration
  emit — **highest-risk step**; tsgo's declaration emit "differs greatly,
  intentionally, to be closer to TS declarations", expect `.d.ts` diffs.
- Validate `apps/web`: `tsc --noEmit` and `next build --webpack`; optionally
  bump Next 16.2.6 → 16.3.0 for improved TS 7 awareness.
- `bun run lint` (Biome) is unaffected; `bun test` (Bun built-in runner) is
  independent of the `typescript` package.
- Normalize `@types/node` version skew (examples pin `^26.1.2`, packages pin
  `^20`).

## Capabilities

This change is a pure toolchain migration (lint/format stack swap and
compiler version bump). It introduces no spec-level product behavior changes.
The change opts out of specs via `skip_specs: true` in its `.openspec.yaml`.

### New Capabilities

_None._

### Modified Capabilities

_None._

## Impact

**Dependencies**: remove ~12 ESLint/Prettier devDependencies and the
`@workspace/eslint-config` workspace; add `@biomejs/biome@^2.5.7`; bump
`typescript` to `^7.0.2`.

**Code**: `packages/eslint-config/*` deleted; 8 `eslint.config.js` +
`.eslintrc.js` deleted; new root `biome.json`; script fields updated in
`package.json` of root + 8 workspaces; `turbo.json` lint/format tasks
simplified.

**Build/typecheck**: `tsup --dts` (5 publishable packages) and `tsc --noEmit`
(5 library packages + `apps/web`) re-validated against tsgo.

**Docs**: `AGENTS.md` "Conventions That Affect Changes" bullet about Prettier
authoritativeness updated to reflect Biome; root `packages/eslint-config`
reference removed.

**Release pipeline**: `scripts/release-check.ts` calls `bun run lint`
(L207) — no source change needed (script name unchanged), but the lint engine
underneath changes from ESLint to Biome.
