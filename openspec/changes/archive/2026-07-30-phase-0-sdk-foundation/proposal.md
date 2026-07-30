## Why

The repository currently has no runnable SDK core, Provider packages, or test baseline. Before implementing Azure OpenAI and Alibaba Bailian adapters, the monorepo needs stable package boundaries and a Node-only TypeScript foundation that keeps runtime code independent from Bun and browser APIs.

This change establishes the Phase 0 foundation for the `@ai-media/*` multi-modal SDK. It is intentionally limited to scaffolding and contracts; image API behavior and live Provider integration remain later phases.

## What Changes

- Add the `@ai-media/sdk` core package skeleton for modality-neutral contracts, transport, task/result types, errors, retry policy, and image API stubs.
- Add `@ai-media/provider-azure-openai` and `@ai-media/provider-aliyun-bailian` package skeletons depending on the core package.
- Add a reusable Node library TypeScript configuration without DOM types.
- Add `examples/*` to Bun workspaces without creating live examples yet.
- Add the `bun:test` test task and a core-package smoke test, while keeping runtime package TypeScript configuration separate from Bun test types.
- Add package-level lint, typecheck, format, and test scripts compatible with Turborepo, including explicit formatting verification.
- Preserve the current pure-fetch direction: no Azure OpenAI or Alibaba Bailian runtime SDK dependency is introduced in this phase.

## Capabilities

### New Capabilities

- `sdk-package-foundation`: Core `@ai-media/sdk` package structure and modality-neutral alpha contract types.
- `provider-package-foundation`: Independent Azure OpenAI and Alibaba Bailian Provider package boundaries and core dependency relationship.
- `workspace-test-foundation`: `examples/*` workspace support and `bun:test` execution/typecheck baseline.

### Modified Capabilities

- None. This change creates the implementation foundation; it does not change an existing published API requirement.

## Impact

- Affected root configuration: `package.json`, `turbo.json`.
- Affected shared configuration: `packages/typescript-config/node-library.json`.
- New workspace packages under `packages/ai-media-sdk`, `packages/provider-azure-openai`, and `packages/provider-aliyun-bailian`.
- New development dependency: `@types/bun` in test-bearing packages; no new runtime Provider SDK dependency.
- No external API calls, credentials, live Provider behavior, Playground behavior, or runnable Provider examples are introduced.
- Phase 0 packages are source-first workspace packages for Bun/Next.js transpilation and are not directly executable or publishable by plain Node.js until a later build/distribution change.
