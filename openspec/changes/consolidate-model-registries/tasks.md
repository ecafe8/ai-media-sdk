## 1. Core SDK: UNKNOWN_MODEL error code + aggregation contract

- [x] 1.1 Add `"UNKNOWN_MODEL"` to `SdkErrorCode` and `RETRYABLE_BY_DEFAULT` (false) in `packages/ai-media-sdk/src/contracts/error.ts`; add `unknownModel(modelId, providerId?)` helper returning an `SdkError` with that code and the message template ``Unknown model id "${modelId}"`` (no provider) / ``Unknown model id "${modelId}" for provider "${providerId}"`` (with provider)
- [x] 1.2 Create `packages/ai-media-sdk/src/contracts/model-registry.ts` defining `SupportedModel`, `ModelRegistry`, `ModelListable`, and `collectSupportedModels`/`findSupportedModel`/`isSupportedModel` (discriminating `ModelRegistry | ModelListable` via `"listModels" in source`)
- [x] 1.3 Export the new contracts and helpers from `packages/ai-media-sdk/src/contracts/index.ts` and the package root `packages/ai-media-sdk/src/index.ts`
- [x] 1.4 Add/update a core smoke test asserting `unknownModel` produces `code: "UNKNOWN_MODEL"`, `retryable: false`, and that `collectSupportedModels`/`findSupportedModel`/`isSupportedModel` behave per the aggregation contract

## 2. Aliyun Bailian provider

- [x] 2.1 Remove the `z-image-turbo` entry from `packages/provider-aliyun-bailian/src/provider/registry.ts` (keep `WAN_GENERATE_CAPABILITY.generate: true` unchanged)
- [x] 2.2 Build an `aliyunModelRegistry: ModelRegistry` projection (programmatic `Object.entries` map over `ALIYUN_MODEL_REGISTRY`) and export it from `packages/provider-aliyun-bailian/src/provider/registry.ts` and the package entry `src/index.ts`; also export `ALIYUN_MODEL_REGISTRY` itself
- [x] 2.3 Add `listModels(): readonly SupportedModel[]` to `AliyunBailianProvider` in `packages/provider-aliyun-bailian/src/provider/index.ts`, returning `aliyunModelRegistry.models`
- [x] 2.4 Migrate the unknown-model error code from `INVALID_REQUEST` to `UNKNOWN_MODEL` in `image()`, `video()`, and `requireRegistryEntry()`. Keep each factory's existing friendly message text (e.g. `Unknown Aliyun model id "x"`) so the existing message-regex assertions still match; only change the `code` to `"UNKNOWN_MODEL"` (do not call `unknownModel()` here, to preserve the friendly "Aliyun" wording)
- [x] 2.5 Add a modality gate to `image()`: reject known non-image (`modality !== "image"`) models with `INVALID_REQUEST` "is not an image model" (keep the existing `family !== "qwen-multimodal"` `NOT_IMPLEMENTED` paths in `generate`/`edit` unchanged)
- [x] 2.6 Update `packages/provider-aliyun-bailian/tests/aliyun-adapter.test.ts`: assert `code: "UNKNOWN_MODEL"` for unknown ids; keep the existing `/Unknown Aliyun model id/` message-regex assertions (friendly message preserved); add a `listModels()` count/shape assertion; keep the Wan `NOT_IMPLEMENTED` scenario unchanged
- [x] 2.7 Update `packages/provider-aliyun-bailian/tests/aliyun-wan-image-adapter.test.ts`: remove or rewrite the `rejects z-image-turbo async submission before transport` test (:100-108) — `provider.image("z-image-turbo")` now throws `UNKNOWN_MODEL` synchronously at the factory (z-image-turbo removed), so `submitImageTask` is never reached; replace with a `provider.image("z-image-turbo")` → `UNKNOWN_MODEL` assertion
- [x] 2.8 Update `packages/provider-aliyun-bailian/tests/aliyun-video-adapter.test.ts`: strengthen the `video() rejects an unknown or non-video model` test (:54-62) to assert `code: "UNKNOWN_MODEL"` for `provider.video("not-a-real-model")` (currently only checks `toThrow(SdkError)`); keep the `provider.video("qwen-image-2.0-pro")` → `/not a video model/` `INVALID_REQUEST` assertion unchanged

## 3. Doubao-Seedream provider

- [x] 3.1 Build a `seedreamModelRegistry: ModelRegistry` projection over `SEEDREAM_MODEL_REGISTRY` and export it from `packages/provider-seedream/src/provider/registry.ts` and the package entry `src/index.ts`
- [x] 3.2 Add `listModels(): readonly SupportedModel[]` to `SeedreamProvider` in `packages/provider-seedream/src/provider/index.ts`, returning `seedreamModelRegistry.models`
- [x] 3.3 Migrate the unknown-model error code from `INVALID_REQUEST` to `UNKNOWN_MODEL` in `image()` and `requireRegistryEntry()`. Keep the existing friendly message `Unknown Seedream model id "x"` so the message-regex assertion still matches; only change the `code` (do not call `unknownModel()` here)
- [x] 3.4 Update `packages/provider-seedream/tests/seedream-adapter.test.ts`: assert `code: "UNKNOWN_MODEL"` for unknown ids; add a `listModels()` assertion

## 4. Azure OpenAI provider (whitelist + escape hatch)

- [x] 4.1 Create `packages/provider-azure-openai/src/provider/registry.ts` defining `AzureModelEntry`, the static `AZURE_MODEL_REGISTRY = { "gpt-image-2": { capabilities: { modality:"image", generate:true, edit:false } } }`, and an `azureModelRegistry: ModelRegistry` projection
- [x] 4.2 In `packages/provider-azure-openai/src/provider/index.ts`, give each provider instance a runtime `Map<ModelId, AzureModelEntry>` seeded from `AZURE_MODEL_REGISTRY` at construction; `provider.image(deployment)` consults this map — known → return entry capabilities; unknown → throw `SdkError({ code: "UNKNOWN_MODEL", message: 'Unknown Azure deployment "x". Use createAzureModel() to register a custom deployment.' })`
- [x] 4.3 Add a defensive `requireAzureRegistryEntry` re-check inside `generate()` that consults the same instance runtime map (mirror Aliyun/Seedream), throwing `UNKNOWN_MODEL` for deployments absent from both the static whitelist and the runtime map
- [x] 4.4 Add a package-level exported `createAzureModel(provider, deployment, capabilities?)` function that writes the entry into the provider's runtime map (default capabilities `{ modality:"image", generate:true, edit:false }`) and returns an `ImageModelInstance` bound to `provider.adapter` with the supplied capabilities — this makes the registered deployment visible to subsequent `image()`/`generate()` lookups
- [x] 4.5 Add `listModels(): readonly SupportedModel[]` to `AzureOpenAIProvider` returning `azureModelRegistry.models`
- [x] 4.6 Export `AZURE_MODEL_REGISTRY`, `azureModelRegistry`, `createAzureModel`, and `AzureModelEntry` from `packages/provider-azure-openai/src/index.ts`
- [x] 4.7 Update `packages/provider-azure-openai/tests/azure-adapter.test.ts`: add "unknown deployment rejected with `UNKNOWN_MODEL`", "createAzureModel registers a custom deployment that then passes `image()` and `generate()` lookup", and "`listModels()` includes `gpt-image-2`"; keep the existing `gpt-image-2` happy-path assertions passing

## 5. Playground derivation

- [x] 5.1 Rewrite `apps/web/lib/playground/registry.ts`: derive `PLAYGROUND_MODELS` from the Provider **full** in-package registries (`ALIYUN_MODEL_REGISTRY`, `SEEDREAM_MODEL_REGISTRY`, `AZURE_MODEL_REGISTRY`) — NOT the projection consts — to preserve Aliyun video rich fields (`requiresFirstFrame`/`requiresInputVideo`/`maxReferenceImages`); map each entry to `PlaygroundModel`, listing both ids of alias pairs (e.g. Seedream `doubao-seedream-5-0-260128` + `doubao-seedream-5-0-lite-260128`); move UI labels/recommendations into a sidecar `PLAYGROUND_LABELS: Record<\`${provider}:${id}\`, { label; recommendation }>` with id fallback
- [x] 5.2 Keep `getPlaygroundModel`/`getClientPlaygroundModels` working against the derived list; preserve `configured` flag semantics
- [x] 5.3 Update `apps/web/lib/playground/registry.test.ts` to assert derived ids (no `z-image-turbo`, no duplicate `wan2.7-t2v-2026-06-12`, no `wan2.7-r2v-2026-06-12`); both Seedream alias ids (`doubao-seedream-5-0-260128` and `doubao-seedream-5-0-lite-260128`) appear; keep the `gpt-image-2` configured assertion
- [x] 5.4 Verify `apps/web/components/playground/index.tsx` default fallback `"gpt-image-2"` still resolves (it is in the whitelist)

## 6. Examples listModels demo

- [x] 6.1 In `examples/azure-image/src/index.ts`, print `provider.listModels()` (id/modality/capabilities one-line per model) at startup before the batch loop
- [x] 6.2 In `examples/aliyun-bailian-image/src/index.ts`, print `provider.listModels()` the same way; also remove the now-dead `z-image-turbo` special-case at :19-21 and simplify the async/sync branch at :25 from `modelId.startsWith("wan") || modelId === "z-image-turbo"` to `modelId.startsWith("wan")`

## 7. Verification and commit

- [x] 7.1 Run `bun run lint`, `bun run typecheck`, `bun run build` (root, turbo-scheduled) and fix any failures
- [x] 7.2 Run `bun test` in affected workspaces: `packages/ai-media-sdk`, `packages/provider-aliyun-bailian`, `packages/provider-seedream`, `packages/provider-azure-openai`, and `apps/web` registry tests
- [x] 7.3 Inspect `git status`/`git diff`; stage only change-related files; commit on `main` with message `feat: consolidate supported-model registries and intercept unknown/incompatible models`; report the commit hash and do not push
