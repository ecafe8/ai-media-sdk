## Why

The SDK currently has no unified "supported models" surface: the core deliberately holds no model list (to avoid reverse-depending on Provider packages), while Aliyun and Seedream each maintain in-package registries with partial validation, and Azure has none. Unknown model ids throw `INVALID_REQUEST` — the same code used for capability mismatches — so callers cannot distinguish "model does not exist" from "model exists but cannot do this". The Playground hand-maintains a separate 18-entry model list (including a duplicate `wan2.7-t2v-2026-06-12` entry) that has already drifted from the SDK registries (e.g. dead `z-image-turbo`, stale `wan2.7-t2v-2026-06-12`/`wan2.7-r2v-2026-06-12` placeholders). Additionally, `z-image-turbo` is a dead registry entry (sync path `NOT_IMPLEMENTED`, no `async` flag to reach `submit`), so callers cannot reach it via any dispatch path this phase.

## What Changes

- Introduce a core `UNKNOWN_MODEL` error code (non-retryable) and `unknownModel(modelId, providerId?)` helper to distinguish "model id not in any registry" from capability/modality mismatches (which remain `INVALID_REQUEST`).
- Introduce a core model-registry aggregation contract: `SupportedModel`, `ModelRegistry`, `ModelListable`, `collectSupportedModels(...)`, `findSupportedModel(...)`, `isSupportedModel(...)`. The core stays registry-free; aggregation accepts either `ModelRegistry` consts or `ModelListable` provider instances.
- Each Provider package exports a `*ModelRegistry` projection (`aliyunModelRegistry`, `seedreamModelRegistry`, `azureModelRegistry`) and gains a `listModels(): readonly SupportedModel[]` instance method returning the same projection (zero-overhead wrapper).
- **BREAKING**: Unknown model id rejection changes from `INVALID_REQUEST` to `UNKNOWN_MODEL` across Aliyun image/video, Seedream, and Azure.
- Azure: add a known-deployment whitelist (`gpt-image-2`, the live-confirmed Serverless Global Standard deployment) and validate `provider.image(deployment)` against it; unknown deployments throw `UNKNOWN_MODEL` with a hint to use the new `createAzureModel(provider, deployment, capabilities?)` escape hatch for custom deployments. Add `requireAzureRegistryEntry` defensive re-check inside `generate()` for parity with Aliyun/Seedream.
- Aliyun `wan-image`: keep `WAN_GENERATE_CAPABILITY.generate: true` and the adapter `NOT_IMPLEMENTED` sync path (a deliberate spec decision — Wan supports generation via async `submit`, the sync path is deferred, so `NOT_IMPLEMENTED` is the accurate code). Remove the dead `z-image-turbo` registry entry (sync path not implemented and no `async` flag to reach `submit`, making it unreachable this phase).
- Aliyun `image()`: add a modality gate rejecting known video-family models ("is not an image model", `INVALID_REQUEST`) so `provider.image("happyhorse-1.1-t2v")` fails fast at the factory.
- Playground: rewrite `apps/web/lib/playground/registry.ts` to derive `PLAYGROUND_MODELS` from the Provider **full** in-package registries (`ALIYUN_MODEL_REGISTRY`, `SEEDREAM_MODEL_REGISTRY`, `AZURE_MODEL_REGISTRY`) as the single source of truth for ids/capabilities/modality (the full registries preserve Aliyun video rich fields `requiresFirstFrame`/`maxReferenceImages`/`requiresInputVideo` that the common projection omits), keeping UI-only labels/recommendations in a sidecar map. The common `*ModelRegistry` projection consts remain a separate SDK-consumer surface for `collectSupportedModels`. Removes drifted entries (`z-image-turbo`, the duplicate `wan2.7-t2v-2026-06-12`, `wan2.7-r2v-2026-06-12`).
- Examples: add a "print available models" demo using `provider.listModels()` in `examples/azure-image` and `examples/aliyun-bailian-image`.

## Capabilities

### New Capabilities

- `model-registry-aggregation`: Core aggregation API for supported-model discovery and unknown-model interception — defines `UNKNOWN_MODEL` error code, `SupportedModel`/`ModelRegistry`/`ModelListable` contracts, `collectSupportedModels`/`findSupportedModel`/`isSupportedModel` helpers, and the Provider `listModels()` + `*ModelRegistry` export contract.

### Modified Capabilities

- `aliyun-qwen-image-generation`: Unknown model id rejection changes from `INVALID_REQUEST` to `UNKNOWN_MODEL`; `provider.image()` rejects known non-image (video-family) models with `INVALID_REQUEST` "is not an image model" so callers use `provider.video()` for video models; the Wan-family sync `NOT_IMPLEMENTED` adapter path is unchanged (deliberate spec decision).
- `doubao-seedream-image-generation`: Unknown model id rejection changes from `INVALID_REQUEST` to `UNKNOWN_MODEL`.
- `azure-image-generation`: `provider.image(deployment)` validates against a known-deployment whitelist and rejects unknown deployments with `UNKNOWN_MODEL`; new `createAzureModel(provider, deployment, capabilities?)` escape hatch; `generate()` adds a defensive registry re-check.
- `aliyun-wan-image-async`: Unknown Wan model id rejection changes from `INVALID_REQUEST` to `UNKNOWN_MODEL`; dead `z-image-turbo` entry removed from the registry (its generation-only-until-sync-contract scenario is retired).
- `aliyun-video-generation`: Unknown video model id rejection changes from `INVALID_REQUEST` to `UNKNOWN_MODEL`.
- `playground-api`: The Playground model list derives from Provider registries (single source of truth) instead of a hand-maintained hardcoded list.

## Impact

- **Core contracts** (`packages/ai-media-sdk/src/contracts/`): new `error.ts` code + helper, new `model-registry.ts` module, updated `contracts/index.ts` and `src/index.ts` exports.
- **Provider packages**: `provider-aliyun-bailian` (registry edit, exports, `listModels()`, error-code migration, `image()` modality gate), `provider-seedream` (exports, `listModels()`, error-code migration), `provider-azure-openai` (new `registry.ts`, whitelist validation, `createAzureModel`, `listModels()`, defensive `generate()` check).
- **`apps/web`**: `lib/playground/registry.ts` rewrite (derivation from registries), `lib/playground/registry.test.ts` assertion updates; `lib/playground/types.ts` error-code union already covers `SdkErrorCode` (auto-extends). `components/playground/index.tsx` default fallback `gpt-image-2` stays valid.
- **Examples**: `examples/azure-image/src/index.ts` and `examples/aliyun-bailian-image/src/index.ts` gain a `provider.listModels()` print demo.
- **Tests**: assertion updates across `provider-aliyun-bailian` (z-image-turbo removal, `listModels`), `provider-seedream` (unknown-model code, `listModels`), `provider-azure-openai` (unknown-deployment `UNKNOWN_MODEL`, `createAzureModel`, `listModels`), and `apps/web` (registry.test).
- **Breaking**: any caller matching `code === "INVALID_REQUEST"` for unknown models must switch to `UNKNOWN_MODEL`; Azure callers passing custom deployment names to `provider.image()` must migrate to `createAzureModel()`.
