## MODIFIED Requirements

### Requirement: Core aggregation helpers merge and query provider model lists

`collectSupportedModels(...sources)` SHALL accept any mix of `ModelRegistry` consts and `ModelListable` Provider instances and return a flat `readonly SupportedModel[]` preserving source order. `findSupportedModel(models, providerId, modelId)` SHALL return the matching `SupportedModel` or `undefined`. `isSupportedModel(models, providerId, modelId)` SHALL return a boolean. Lookup SHALL be stable for duplicate `(providerId, modelId)` pairs (first match wins) and SHALL NOT perform network access.

#### Scenario: Collect merges multiple provider lists

- **WHEN** `collectSupportedModels(aliyunModelRegistry, volcengineModelRegistry, azureModelRegistry)` is called
- **THEN** the result SHALL contain every model from all three registries in source order; when the same `(providerId, modelId)` pair appears more than once, only the first occurrence SHALL be kept (subsequent duplicates are dropped)

#### Scenario: Find locates a known model

- **WHEN** `findSupportedModel(models, "aliyun-bailian", "qwen-image-2.0-pro")` is called against an aggregate containing that pair
- **THEN** it SHALL return the `SupportedModel` entry

#### Scenario: Find returns undefined for an unknown model

- **WHEN** `findSupportedModel(models, "aliyun-bailian", "not-a-real-model")` is called
- **THEN** it SHALL return `undefined` and SHALL NOT throw

#### Scenario: isSupportedModel returns a boolean

- **WHEN** `isSupportedModel(models, "azure-openai", "gpt-image-2")` is called
- **THEN** it SHALL return `true` when the pair is present and `false` otherwise

### Requirement: Each Provider exposes its model registry and a listModels instance accessor

Every Provider package SHALL export a `*ModelRegistry` const of type `ModelRegistry` (the common projection of its in-package registry) AND expose a `listModels(): readonly SupportedModel[]` instance method on its Provider interface. The instance method SHALL return the same projection as the exported const (single source of truth, zero-overhead wrapper). The Provider's full in-package registry (with Provider-specific fields, including Aliyun's `family`/`paramSupport`/`requiresFirstFrame`/`requiresInputVideo`/`maxReferenceImages`/`supportedResolutions`/`supportedAspectRatios`, Volcengine Ark's `paramSupport`/`outputFormats`, and MiniMax's `family`/`supportedResolutions`/`supportedAspectRatios`/`maxReferenceImages`/`maxReferenceVideos`/`maxReferenceAudios`) SHALL also remain exported for Provider-specific concerns. Provider-specific fields SHALL NOT enter the common `SupportedModel` projection; consumers needing them import the Provider's full registry directly.

#### Scenario: Provider const and instance method agree

- **WHEN** a consumer compares `aliyunModelRegistry.models` to `createAliyunBailianProvider(config).listModels()`
- **THEN** the two arrays SHALL contain the same `SupportedModel` entries in the same order

#### Scenario: listModels returns the projection without network access

- **WHEN** `provider.listModels()` is called immediately after construction
- **THEN** it SHALL return synchronously (a `readonly SupportedModel[]`, not a `Promise`) without invoking the transport

#### Scenario: All providers expose a registry projection

- **WHEN** a consumer imports `aliyunModelRegistry`, `volcengineModelRegistry`, `azureModelRegistry`, and `minimaxModelRegistry` from their respective packages
- **THEN** each SHALL be a `ModelRegistry` whose `providerId` matches the Provider's stable id and whose `models` is a non-empty `SupportedModel[]`

#### Scenario: Provider video resolution metadata stays in the full registry

- **WHEN** a consumer needs the per-model list of supported `resolution`/`ratio` strings for an Aliyun HappyHorse/Wan 3.0 video model or a MiniMax-H3 video model
- **THEN** the consumer SHALL import `ALIYUN_MODEL_REGISTRY` or `MINIMAX_MODEL_REGISTRY` directly; the common `SupportedModel` projection SHALL NOT carry `supportedResolutions`/`supportedAspectRatios` (they are Provider-specific)
