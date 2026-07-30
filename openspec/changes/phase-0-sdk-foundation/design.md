## Context

The repository is a Bun 1.3.14 and Turborepo monorepo with `apps/web`, `packages/ui`, and shared TypeScript/ESLint configuration, but it has no SDK implementation package, Provider package, examples workspace, or test runner. The product direction is `@ai-media/*`: an image-first SDK whose core contracts are modality-neutral and can later support video and audio.

Phase 0 must establish package boundaries without coupling runtime code to Bun, browser APIs, or Provider SDKs. Azure OpenAI will use API Key authentication and direct REST calls. Alibaba Bailian has no official JS/TS SDK, so its future adapter will also use direct REST calls.

## Goals / Non-Goals

**Goals:**

- Establish `@ai-media/sdk` as the core workspace package.
- Establish independent Azure OpenAI and Alibaba Bailian Provider package boundaries.
- Define compile-safe, modality-neutral alpha contracts for content, tasks, errors, transport, and image entry points.
- Keep runtime TypeScript Node-only while allowing Bun test types through a separate test tsconfig.
- Add a repeatable `bun:test` and Turborepo test baseline.
- Add `examples/*` as a workspace glob without introducing live Provider calls.

**Non-Goals:**

- No real Azure or Alibaba HTTP requests, credentials, endpoint probing, or Provider response mapping.
- No final public API behavior for `generateImage` or `editImage`.
- No Google, Seedream, video, audio, Playground, or runnable Provider examples.
- No production build/publish pipeline or package versioning policy.
- No decision about splitting Alibaba Wan and Qwen packages; that remains a Phase 1 contract-probe outcome.

## Decisions

### Package boundaries

The core package is `@ai-media/sdk`. Each platform adapter is an independent package such as `@ai-media/provider-azure-openai` and `@ai-media/provider-aliyun-bailian`, with each Provider depending on the core package through a workspace dependency. This keeps Provider-specific dependencies and release scope isolated.

The packages are source-first in Phase 0: their `exports` map points to TypeScript source files, matching the existing `@workspace/ui` pattern. They are workspace-internal packages consumed by Bun scripts or Next.js with `transpilePackages`; plain Node.js cannot execute the exported `.ts` files directly. A compiled distribution pipeline and publishable Node entrypoints are deferred until a later build/distribution change.

### Node library configuration

Add `packages/typescript-config/node-library.json` extending the existing strict base configuration. It removes DOM libraries and explicitly includes Node types. SDK and Provider runtime code therefore cannot accidentally rely on browser globals. Each package uses `@workspace/eslint-config/base`, not the React or Next.js configurations.

### Modality-neutral contracts

Core result and task types use generics, principally `GenerationResult<TContent>` and `TaskHandle<TContent>`. Phase 0 provides `ImageContent` and image function signatures, while video/audio types and functions remain future extensions. This preserves a stable shared lifecycle without implementing unsupported modalities.

### Test type isolation

Runtime package tsconfigs include only Node types. Packages that contain tests install `@types/bun` as a package-local development dependency and use a separate `tsconfig.test.json` with `types: ["node", "bun"]`; the runtime tsconfig remains Bun-free. The package `typecheck` script runs both runtime and test projects. This avoids making production code Bun-specific while allowing `bun:test` imports to typecheck.

### Test and workspace orchestration

The root adds a `test` script delegating to Turbo. Turbo receives a `test` task with test-file inputs; `^build` is retained for future dependency ordering but is currently a no-op for source-first Phase 0 packages without build scripts. The core package includes one small error-contract smoke test, and Provider skeletons include no-network smoke tests to prove injected fetch is never called. Formatting is verified separately from lint/typecheck.

### Runtime transport

Phase 0 exposes transport types and a minimal construction boundary only. Future Provider adapters SHALL receive or construct the shared transport abstraction and SHALL NOT call global `fetch` directly inside adapter logic. The eventual implementation will use injected `fetch`, timeout, and headers. No `openai`, DashScope, or other Provider runtime SDK is added.

## Risks / Trade-offs

- [Source-first package exports] → Consumers may need Next.js `transpilePackages` or equivalent source transpilation. Keep this consistent with the existing workspace UI package and add a build pipeline only when publishing is required.
- [Alpha contracts are intentionally incomplete] → Mark stubs as not implemented and keep Phase 1/2 contract discovery as a prerequisite for real adapter behavior.
- [Separate test tsconfig adds package boilerplate] → The isolation prevents Bun globals from leaking into Node runtime code and is preferable for a server SDK.
- [Adding `examples/*` before example packages exist] → Only the workspace glob is added in Phase 0; actual examples remain a later deliverable.
- [Provider split may change for Alibaba] → Keep the initial Bailian package boundary and model-family internals replaceable until Wan/Qwen edit contracts are probed.
