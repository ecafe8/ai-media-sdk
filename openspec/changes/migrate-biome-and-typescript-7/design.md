## Context

Today the repo runs ESLint 9 + `typescript-eslint` 8.66 + Prettier 3.8 with
`prettier-plugin-tailwindcss`, configured through a shared
`packages/eslint-config` workspace re-exported by 8 per-workspace
`eslint.config.js` files. TypeScript is pinned `^5` (resolved 5.9.3). See
`proposal.md` for why a migration is needed (tsgo + ESLint Compiler-API
blockade).

Relevant current-state facts that constrain the design:

- The lint/format scripts are uniform across 8 workspaces: `lint: eslint`,
  `format: "prettier --write \"**/*.{ts,tsx}\""`. Root delegates via
  `turbo lint` / `turbo format` (`turbo.json` L21-26).
- `scripts/release-check.ts:207` invokes `bun run lint` by name, then
  `typecheck:release`, `build`, `test`. The script-name contract is the only
  coupling — the engine underneath is swappable.
- `.prettierrc` declares `tailwindFunctions: ["cn","cva"]` and
`tailwindStylesheet: "packages/ui/src/styles/globals.css"` (Tailwind v4).
- tsconfig surface (`packages/typescript-config/base.json`): `module`/
`moduleResolution: NodeNext`, `target: ES2022`, `esModuleInterop: true`,
`strict`, `noUncheckedIndexedAccess`, `isolatedModules`, `incremental: false`,
no `composite`/`references`/`baseUrl`/`outFile`. tsgo's "unsupported flags"
list (Node10/Classic resolution, AMD/UMD/System modules, `esModuleInterop:
false`, `target: ES5`, `baseUrl`, `outFile`) does not intersect our config.
- Biome 2.5.7 has zero peer dependencies and ships a native binary per
platform; Bun 1.3.14 resolves optional native platform deps correctly.

## Goals / Non-Goals

**Goals:**

- A single green-gated pipeline after Phase A (Biome) on TS 5.9.3, shippable
  independently of Phase B.
- A single green-gated pipeline after Phase B (tsgo 7.0.2).
- Preserve existing formatting contract (double quotes, semicolons, 2-space,
  ES5 trailing comma, width 80, LF) and Tailwind-class ordering for
  `cn`/`cva`.
- Preserve the `_`-prefix ignore convention for unused vars/imports/args.
- Keep `release:check` working without source changes to
  `scripts/release-check.ts` (the `lint` script name is stable).

**Non-Goals:**

- Adopting TS 6/7-only language syntax in source files. The upgrade targets
  the toolchain, not the codebase's syntax surface.
- Replacing `tsup` (still used for `--dts` build of the 5 publishable
  packages).
- Replacing `tsc --noEmit` with Biome's diagnostics. `tsc` remains the
  authoritative type-checker; Biome is the linter/formatter only.
- Re-introducing Next-specific lint rules (the `@next/eslint-plugin-next`
  `core-web-vitals` ruleset is dropped, not replaced).
- Changing any published package's runtime behavior, public API, or emitted
  `dist` shape beyond what tsgo's declaration-emit differences force.

## Decisions

### D1 — One root `biome.json`, not per-workspace configs

Biome is a single-pass whole-repo scanner (Rust, sub-second on this monorepo).
Per-workspace configs add indirection without speed benefit. The root config
uses `files.includes`/`files.ignore` to scope rules where needed (e.g., React
rules under `apps/web`, `packages/ui`, `examples/uploader-web`; Node rules
under `packages/*` library packages).

**Alternative considered**: keep one `biome.json` per workspace mirroring the
old `eslint-config` pattern. Rejected — Biome's `extends` is meant for
cross-repo sharing, not in-repo deduplication; a root config with
`overrides` is idiomatic and simpler. The `packages/eslint-config` workspace
is deleted entirely (not repurposed as a `biome-config` package).

### D2 — Execution order: Phase A (Biome) before Phase B (tsgo)

Phase A on TS 5.9.3 is independently green and shippable. Reversing the
order would leave `bun run lint` (and `release:check`) red from the moment TS
7 lands until Biome is in, with no way to distinguish a tsgo regression from
a linter gap. The chosen order puts a green gate between the two risky,
independent changes.

**Alternative considered**: single combined commit. Rejected — fails the
"one green gate per risky change" principle and makes bisection harder.

### D3 — Replace `prettier-plugin-tailwindcss` with Biome
`useSortedClasses`

Biome's `useSortedClasses` (nursery) sorts Tailwind classes in string
literals and configurable function calls. Setting
`functions: ["clsx","cva","cn","tw","tw.*"]` and adding `className` plus the
`@workspace/ui` `cn`/`cva` helpers to the scan reproduces the current
`tailwindFunctions` surface. `css.parser.tailwindDirectives: true` covers
Tailwind v4 `@theme`/`@apply` directives in `packages/ui/src/styles`.

**Alternative considered**: keep Prettier solely for Tailwind sorting and run
Biome for everything else. Rejected — two formatters racing on the same
files creates merge churn and CI ordering sensitivity.

### D4 — Format settings mapped 1:1 from `.prettierrc` to `biome.json`

| `.prettierrc` | `biome.json` |
|---|---|
| `endOfLine: lf` | `formatter.lineEnding: "lf"` |
| `semi: true` | `javascriptFormatter.semicolons: "always"` |
| `singleQuote: false` | `formatter.indentStyle`, quotes via `javascriptFormatter.quoteStyle: "double"` |
| `tabWidth: 2` | `formatter.indentWidth: 2` |
| `trailingComma: es5` | `javascriptFormatter.trailingCommas: "es5"` |
| `printWidth: 80` | `formatter.lineWidth: 80` |

### D5 — `noUnusedVariables` rule with `^_` ignore pattern

Maps `ai-media-sdk/eslint.config.js:8-15` (`@typescript-eslint/no-unused-vars`
with `argsIgnorePattern`/`varsIgnorePattern`/`caughtErrorsIgnorePattern: ^_`)
to Biome's `noUnusedVariables` (with `ignorePattern: "^_"`) plus
`noUnusedImports` for import-specific cases.

### D6 — Phase B validation strategy for `tsup --dts`

tsgo README states declaration emit "differs greatly, intentionally, to be
closer to TS declarations". Validation order:

1. Run `bun run --cwd <pkg> build` for each of the 5 publishable packages
   and diff `dist/**/*.d.ts` against the pre-upgrade baseline.
2. If diffs are cosmetic (whitespace, qualifier ordering), accept and update
   any golden snapshots.
3. If diffs break consumers (e.g., missing overloads, changed export
   shapes), pin `tsup` to a tsgo-aware release or fall back to
   `tsc --emitDeclarationOnly` for `.d.ts` while keeping `tsup` for JS emit.
4. If tsgo declaration emit is fundamentally incompatible with tsup's
   `rollup-plugin-dts` pipeline, Phase B is blocked on a tsup release that
   supports tsgo — Phase A remains shipped and green.

### D7 — `@types/node` version skew normalized during Phase B

Examples pin `@types/node: ^26.1.2` while packages pin `^20`. TS 7 tolerates
both, but the skew causes `skipLibCheck`-masked drift. Phase B normalizes to
`^20` across workspaces (matching `engines.node: >=20`) — `^26` types pull in
Node APIs that may not exist on the supported runtime floor.

## Risks / Trade-offs

- **[tsup `--dts` × tsgo declaration emit incompatibility]** → Mitigation:
  D6 staged validation; fall back to `tsc --emitDeclarationOnly` for `.d.ts`
  if needed; keep Phase A green as a safe rollback point.
- **[Loss of `@next/eslint-plugin-next` `core-web-vitals` rules]** →
  Mitigation: accepted; Next 16 is deprecating `next lint`; the
  `core-web-vitals` rules (e.g., `no-img-element`) are advisory and not
  enforced at build time. Document in `AGENTS.md`.
- **[Loss of `turbo/no-undeclared-env-vars`]** → Mitigation: `turbo.json`
  `globalEnv` (L4-14) already enumerates the allowed env vars; the rule was a
  secondary safety net. Accepted.
- **[Biome TS syntax coverage lags tsgo]** → Mitigation: Biome 2.5.7 supports
  TS 5.9 syntax; tsgo 7.0 produces "the same syntax errors as TS 6.0" (tsgo
  README), so existing source parses fine. If the team later adopts TS 6/7-
  only syntax, Biome's rule coverage is re-checked at that time. Low
  near-term risk since the codebase currently targets 5.9.
- **[Biome formatter produces one-time reformat diff]** → Mitigation: run
  `biome format --write` once in Phase A as a dedicated "reformat" commit
  separate from rule changes, so the diff is reviewable and doesn't pollute
  semantic commits.
- **[`apps/web` `next build --webpack` + tsgo interaction]** → Mitigation:
  validate `tsc --noEmit` and `next build` together in Phase B; bump Next
  16.2.6 → 16.3.0 if type-check integration issues surface.
- **[Bun 1.3.14 native-binary resolution for `typescript@7`]** → Mitigation:
  verify `bunx tsc --version` resolves the `@typescript/typescript-darwin-
  arm64` binary in Phase B step 1 before running any task.

## Migration Plan

### Phase A — Biome (on TS 5.9.3)

1. Add `@biomejs/biome@^2.5.7` to root `devDependencies`; write root
   `biome.json` (D1, D3, D4, D5).
2. Replace root `lint`/`format` scripts; remove 8 per-workspace `lint`/
   `format` scripts; simplify `turbo.json` `lint`/`format` tasks.
3. Delete `packages/eslint-config`, 8 `eslint.config.js`, `.eslintrc.js`.
4. Remove ESLint/Prettier devDependencies from root and all workspaces.
5. `bun install` → run `biome format --write` as a standalone reformat
   commit.
6. `bun run lint && bun run typecheck && bun run build && bun run test` →
   green → commit on `main`.
7. Update `AGENTS.md` (Prettier-authoritativeness bullet → Biome; remove
   `packages/eslint-config` references).

### Phase B — TypeScript 7.0.2 (tsgo)

1. Bump `typescript` to `^7.0.2` across root + ~9 workspaces; normalize
   `@types/node` to `^20`.
2. `bun install`; verify `bunx tsc --version` resolves the native binary.
3. `bun run typecheck` (5 library packages' `tsconfig.test.json` path +
   `apps/web`).
4. `bun run build` (5 publishable packages via `tsup --dts`) — apply D6.
5. `apps/web`: `next build --webpack`; bump Next to 16.3.0 if needed.
6. `bun run lint` (Biome, unaffected) + `bun run test` (Bun runner).
7. `bun run release:check` end-to-end.
8. Green → commit on `main`.

### Rollback

- Phase A: revert the Phase A commit; `packages/eslint-config` and
  `eslint.config.js` files are recoverable from git history.
  `bun install` reinstalls the ESLint/Prettier deps.
- Phase B: revert the Phase B commit; `bun install` reinstalls TS 5.9.3.
  Phase A (Biome) is unaffected and remains shipped.

## Open Questions

- Whether Next 16.3.0 improves tsgo integration enough to skip the 16.2.6
  validation entirely — answerable in Phase B step 5 without changing this
  plan.
- Whether any of the 5 publishable packages' `.d.ts` consumers (downstream
  `apps/web`, `examples/*`) break on tsgo's declaration-emit differences —
  answerable in Phase B step 4 (D6 validation).
