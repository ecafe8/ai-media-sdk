# `@workspace/typescript-config`

Shared TypeScript configuration for the workspace. Targets TypeScript `^7.0.2` (tsgo native binary).

## Configs

- `base.json` — shared strict base (`NodeNext` module/resolution, `noUncheckedIndexedAccess`, `isolatedModules`, ES2022).
- `node-library.json` — for `packages/*` libraries; adds `node` types, `allowImportingTsExtensions`.
- `react-library.json` — for React libraries; adds `jsx: react-jsx`.
- `nextjs.json` — for `apps/web`; `Bundler` resolution, `jsx: preserve`, `allowJs`.
- `emit-dts.json` — extends `node-library.json`; emits declaration files only (`declaration` + `emitDeclarationOnly`). Consumed by each publishable package's `tsconfig.emit-dts.json` (which sets `rootDir: src` + `outDir: dist`) to generate `dist/**/*.d.ts` via `tsc`, since `tsup`'s bundled `rollup-plugin-dts` is incompatible with tsgo's Compiler API.
