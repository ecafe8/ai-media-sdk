## Context

The core `@ai-media/sdk` deliberately holds no Provider model list (to avoid reverse-depending on Provider packages); each Provider maintains an in-package registry (`ALIYUN_MODEL_REGISTRY`, `SEEDREAM_MODEL_REGISTRY`) and validates model ids at its `image()`/`video()` factory plus a defensive `requireRegistryEntry` inside `generate`/`edit`/`submit`. Azure has no registry at all — any deployment string flows straight into the URL. Unknown model ids currently surface as `INVALID_REQUEST`, indistinguishable from capability/modality mismatches. The Playground maintains a separate 17-entry hardcoded list that has already drifted (dead `z-image-turbo`, stale `wan2.7-t2v-*` placeholders). See `proposal.md` for full motivation.

Key existing constraints the design must respect:
- Core must not import any Provider package (reverse-dependency forbidden; `docs/prd/sub-provider-adapters/tech.md`).
- `ProviderAdapter<TContent>` (`contracts/adapter.ts:44-49`) is the adapter contract; provider factory interfaces (`AliyunBailianProvider` etc.) extend it with `image()`/`video()` factories. `listModels()` belongs on the factory interface, not the adapter contract (it is a provider-discovery concern, not a per-request adapter concern).
- Aliyun `wan-image` `generate: true` + adapter `NOT_IMPLEMENTED` is a deliberate spec decision (Wan supports generation via async `submit`; sync path deferred). This change keeps it intact.

## Goals / Non-Goals

**Goals:**
- One stable error code (`UNKNOWN_MODEL`) for "model id not in registry", separate from `INVALID_REQUEST` capability mismatches.
- A modality-neutral aggregation contract so consumers can obtain a unified supported-model list without the core importing providers.
- A provider-instance `listModels()` accessor for runtime introspection + package-level `*ModelRegistry` const for aggregation (single source of truth, both reference the same projection).
- Azure gains whitelist validation + an explicit `createAzureModel()` escape hatch for custom deployments.
- Playground derives its model list from the SDK registries; no dual maintenance.

**Non-Goals:**
- No central Provider registry inside the core; no auto-routing of model strings to providers. Provider selection stays explicit (`createXProvider(config).image(id)`).
- No change to the Aliyun `wan-image` `generate: true` + `NOT_IMPLEMENTED` sync-path contract (deliberate, kept).
- No change to Azure's `Authorization: Bearer` auth, `api-version`, or sync response mapping.
- No implementation of the deferred Wan sync path or Azure edit (`images/edits` multipart) path.
- No `CAPABILITY_ERROR` category (PRD `docs/prd/sub-capability-error-handling/tech.md:80` floated it; the implemented `INVALID_REQUEST` is retained for capability mismatches, and `UNKNOWN_MODEL` is added only for identity failures).

## Decisions

### Decision 1: Core exposes a projection contract, providers own the data
The core defines `SupportedModel` (a common subset: `providerId`, `id`, `label?`, `modality`, `capabilities`) and `ModelRegistry`/`ModelListable` source shapes. Each Provider projects its full in-package registry (which keeps Provider-specific fields like `family`, `paramSupport`, `outputFormats`, `requiresFirstFrame`) into a `ModelRegistry` const and a `listModels()` method returning the same `SupportedModel[]`.

*Why over alternatives:* keeps the core reverse-dependency-free while giving consumers one shape to aggregate. *Alternative rejected:* core maintaining a `SUPPORTED_MODELS` const — violates the no-reverse-dependency invariant and creates a third source of truth. *Alternative rejected:* Playground importing provider-specific full registries — would couple the UI to Provider-specific entry shapes and re-leak `family`/`paramSupport` into the UI layer.

### Decision 2: `collectSupportedModels` accepts both `ModelRegistry` consts and `ModelListable` instances
A discriminated source type `ModelRegistry | ModelListable`; the function checks `"listModels" in source` to dispatch. This lets a consumer pass either `aliyunModelRegistry` (const) or `createAliyunBailianProvider(config)` (instance, which implements `ModelListable`).

*Why:* supports both static (import a const) and runtime (introspect a configured provider) usage without two separate APIs. *Alternative rejected:* only accepting `ModelListable` instances — forces consumers to construct a provider just to list models, which is awkward for docs/tools and may require credentials.

### Decision 3: `UNKNOWN_MODEL` is non-retryable and identity-only
Added to `SdkErrorCode` with `RETRYABLE_BY_DEFAULT: false`. Used exclusively for "model id not present in the relevant Provider registry". Known-but-incompatible cases (edit on non-editable, video via `image()`) stay `INVALID_REQUEST` because the model identity is known — only the capability/modality is wrong.

*Message template:* the `unknownModel(modelId, providerId?)` helper SHALL produce ``Unknown model id "${modelId}"`` when `providerId` is omitted, and ``Unknown model id "${modelId}" for provider "${providerId}"`` when supplied (using the stable `providerId` string, not a friendly name). Provider factories MAY either call the helper OR construct their own `SdkError({ code: "UNKNOWN_MODEL", message: 'Unknown <Friendly> model id "x"' })` to preserve existing friendly messages (e.g. `Unknown Aliyun model id "x"`, `Unknown Seedream model id "x"`); the code MUST be `UNKNOWN_MODEL` either way. Existing per-provider message-regex test assertions (e.g. `/Unknown Aliyun model id/`) therefore continue to pass when providers keep their friendly messages.

*Why:* mirrors the user's "未知模型 vs 不兼容模型" distinction; retrying an unknown model id is pointless (the registry won't change between retries within a process). Letting providers keep friendly messages avoids churn in existing message-regex assertions while the helper serves core/external consumers. *Alternative rejected:* a single `INVALID_REQUEST` for both (current) — callers cannot branch "did I mistype the model id?" vs "did I ask for the wrong capability?".

### Decision 4: Azure whitelist + `createAzureModel` escape hatch (instance-bound, runtime registry)
Azure deployments are user-defined in the Azure Portal, so they cannot be universally enumerated. Each Azure provider instance holds a runtime `Map<ModelId, AzureModelEntry>` seeded from the static `AZURE_MODEL_REGISTRY` whitelist (`gpt-image-2`, the live-confirmed Serverless Global Standard deployment) at construction. `provider.image(deployment)` and the `generate()` defensive `requireAzureRegistryEntry` both consult this instance map. `createAzureModel(provider, deployment, capabilities?)` is a package-level exported function that takes the provider instance (to bind its adapter), a deployment name, and optional capabilities (defaulting to `{ modality:"image", generate:true, edit:false }`); it writes the entry into the provider's runtime map and returns the bound `ImageModelInstance`. This makes `createAzureModel`-registered deployments visible to the subsequent `generate()` re-check, so the escape hatch composes with the defensive validation instead of being rejected by it.

*Why:* gives fast validation + correct capabilities for the confirmed deployment while leaving custom deployments explicit (the caller opts in via `createAzureModel`). The runtime map reconciles the escape hatch with `generate()`'s defensive `requireAzureRegistryEntry`: without it, `generate()` would reject the very `createAzureModel` instances it should serve (since they are absent from the static whitelist). *Signature note:* the function takes `provider` as its first arg because a `ModelInstance` must bind a `provider.adapter`; a signature of `createAzureModel(deployment, capabilities?)` without a provider cannot produce a usable instance. *Alternative rejected:* `provider.image(deployment, { capabilities })` optional-arg — blurs the whitelist-vs-custom boundary and makes accidental typos silently succeed with default capabilities. *Alternative rejected:* hard-reject all unknown deployments with no escape hatch — too restrictive for a user-defined deployment name space. *Alternative rejected:* `generate()` trusting the bound instance with no re-check — breaks parity with Aliyun/Seedream's defensive validation.

### Decision 5: `listModels()` on the provider interface, not on `ProviderAdapter`
`listModels(): readonly SupportedModel[]` is added to each provider factory interface (`AliyunBailianProvider`, `SeedreamProvider`, `AzureOpenAIProvider`), not to the `ProviderAdapter` contract. The adapter contract (`generate`/`edit`/`submit`) is per-request; model discovery is a factory-level concern.

*Why:* keeps the adapter contract minimal and avoids forcing every future adapter implementation to provide a list. *Alternative rejected:* a `ModelListable` mixin on `ProviderAdapter` — would bloat the adapter contract and entangle discovery with request handling.

### Decision 6: Playground derives from Provider FULL registries; projection consts are a separate SDK surface
The Playground imports the three **full** in-package registries (`ALIYUN_MODEL_REGISTRY`, `SEEDREAM_MODEL_REGISTRY`, `AZURE_MODEL_REGISTRY`) and maps them to `PlaygroundModel[]`. UI-only display text (`label`, `recommendation`) lives in a sidecar `Record<\`${provider}:${id}\`, { label; recommendation }>`. The common projection consts (`aliyunModelRegistry`/`seedreamModelRegistry`/`azureModelRegistry`) are a **separate** surface for SDK consumers who want a modality-neutral list via `collectSupportedModels`; the Playground does NOT use them, because `PlaygroundModel` (`apps/web/lib/playground/types.ts:7-22`) needs Provider-specific fields the projection filters out — Aliyun video `requiresFirstFrame`/`requiresInputVideo`/`maxReferenceImages` and Seedream `maxEditImages` (carried in `capabilities`) come from the full entries.

*Why:* single source of truth; using the full registries preserves the rich video UI fields that `SupportedModel` (common subset: `providerId`, `id`, `label?`, `modality`, `capabilities`) omits for Aliyun video. Keeping the projection consts as a distinct SDK-consumer surface avoids coupling external aggregation to Provider-specific entry shapes. *Note:* Seedream registry contains an alias pair (`doubao-seedream-5-0-260128` ↔ `doubao-seedream-5-0-lite-260128`); the Playground SHALL list both ids (both are valid call targets) rather than collapsing aliases. *Alternative rejected:* Playground using projection consts — loses `requiresFirstFrame`/`maxReferenceImages`/`requiresInputVideo`, breaking the Aliyun video model UI. *Alternative rejected:* Playground using projection consts + re-importing full registries for rich fields — two imports for the same list, redundant and drift-prone.

## Risks / Trade-offs

- **[Breaking error-code change]** `INVALID_REQUEST → UNKNOWN_MODEL` for unknown models across Aliyun image/video, Seedream, Azure → Mitigation: any caller matching `code === "INVALID_REQUEST"` for the unknown-model case must update; the Playground's `PlaygroundResponse.error.code` union (`apps/web/lib/playground/types.ts:56`) already types as `SdkErrorCode | ...` and auto-extends. Document in the change log.
- **[Azure `image()` hardens]** callers previously passing any deployment string to `provider.image()` now get `UNKNOWN_MODEL` for non-whitelisted names → Mitigation: the only deployment used in-repo is `gpt-image-2` (`.env`, examples, tests), which is whitelisted; custom-deployment callers migrate to `createAzureModel()`. The `UNKNOWN_MODEL` message names `createAzureModel()` explicitly.
- **[Projection drift]** the `*ModelRegistry` projection consts could drift from the full in-package registries if maintained separately → Mitigation: each projection is derived programmatically from the full registry at module load (a `Object.entries` map), so they cannot drift by construction.
- **[Aggregation duplicate `(providerId, modelId)` pairs]** `collectSupportedModels` keeps the first occurrence and does not dedupe across providers (a model id could theoretically appear under two providers) → acceptable: cross-provider model aliasing is out of scope; `findSupportedModel` is `(providerId, modelId)`-scoped so aliasing across providers is unambiguous.
- **[Azure runtime map is per-instance]** a deployment registered via `createAzureModel` on one provider instance is NOT visible to another instance's `image()`/`generate()` → acceptable and intended: custom deployments are opt-in per configured provider; the static whitelist (`gpt-image-2`) is shared across all instances via the seed at construction.

## Migration Plan

1. Ship core `UNKNOWN_MODEL` + aggregation contract first (additive, no breakage).
2. Update Provider packages: export projections, add `listModels()`, migrate unknown-model error code. Tests updated in lockstep.
3. Add Azure registry + `createAzureModel`; update Azure tests.
4. Rewrite Playground derivation; update `registry.test.ts`.
5. Add examples `listModels()` print demo.
6. Verify: `bun run lint → typecheck → build`; `bun test` per affected workspace.
7. Commit on `main` (no push). No runtime migration is required — this is a library release; consumers pinning the old error code update on upgrade.

## Open Questions

None. All design-level decisions are resolved; remaining work is implementation detail captured in `tasks.md`.
