## 1. Workspace and Shared Configuration

- [x] 1.1 Update root `package.json` to include `examples/*` and add `test: turbo test`; add `@types/bun` only to test-bearing package development dependencies.
- [x] 1.2 Add the Turborepo `test` task with test-file inputs and document that `^build` is currently a no-op for source-first packages without build scripts.
- [x] 1.3 Add `packages/typescript-config/node-library.json` with ES2022 and Node types but no DOM libraries.
- [x] 1.4 Run `bun install` and verify the new workspace/configuration dependencies resolve without modifying unrelated lockfile entries.

## 2. Core SDK Package

- [x] 2.1 Create `packages/ai-media-sdk/package.json`, source-first exports, package scripts, and workspace tooling dependencies.
- [x] 2.2 Add runtime and test tsconfigs so production source uses Node types and test source additionally uses Bun types.
- [x] 2.3 Add the package ESLint configuration using `@workspace/eslint-config/base`.
- [x] 2.4 Add modality-neutral contract types for Provider/model identity, capabilities, transport, adapter requests/results, and retry policy.
- [x] 2.5 Add generic `GenerationResult<TContent>` and `TaskHandle<TContent>` contracts with `ImageContent` and task status types.
- [x] 2.6 Add classified `SdkError` and error-code types, including `NOT_IMPLEMENTED` with `retryable: false`, plus explicit not-implemented stubs for `generateImage` and `editImage`.
- [x] 2.7 Add the package barrel exports and a local `bun:test` smoke test for the error contract.

## 3. Provider Package Skeletons

- [x] 3.1 Create `packages/provider-azure-openai` with package metadata, source-first export, Node/runtime and test tsconfigs, base ESLint config, scripts, and package-local `@types/bun` development dependency.
- [x] 3.2 Add the Azure Provider factory/model boundary with typed `apiKey`, `endpoint`, and `apiVersion` configuration depending only on `@ai-media/sdk`; keep all adapter methods local stubs with no network call.
- [x] 3.3 Add an Azure no-network smoke test using a counting transport and assert the call count remains zero.
- [x] 3.4 Create `packages/provider-aliyun-bailian` with package metadata, source-first export, Node/runtime and test tsconfigs, base ESLint config, scripts, and package-local `@types/bun` development dependency.
- [x] 3.5 Add the Alibaba Provider factory/model boundary with typed `apiKey` and optional `baseUrl` configuration depending only on `@ai-media/sdk`; keep all adapter methods local stubs with no network call.
- [x] 3.6 Add an Alibaba no-network smoke test using a counting transport and assert the call count remains zero.
- [x] 3.7 Verify neither Provider package adds `openai`, DashScope, or another external Provider SDK runtime dependency, and both adapters use the shared transport boundary.

## 4. Phase 0 Verification

- [x] 4.1 Run `bun run lint` and resolve all new errors without changing the existing unrelated `Geist` warning.
- [x] 4.2 Run `bun run typecheck` and verify runtime and test tsconfigs both pass.
- [x] 4.3 Run `bun run test` and verify the core smoke test passes without Provider credentials or network access.
- [x] 4.4 Run a focused package/workspace inspection to verify all exports, workspace dependencies, and package names use `@ai-media/*`.
- [x] 4.5 Review the final diff against the proposal/specs and confirm Phase 0 did not add live API calls, credentials, or runnable Provider examples.
- [x] 4.6 Run a non-mutating Prettier check for all Phase 0 files and resolve formatting differences.
- [x] 4.7 Verify and document that source-first `.ts` exports are workspace-only and are not directly executable by plain Node.js until a later build/distribution change.
