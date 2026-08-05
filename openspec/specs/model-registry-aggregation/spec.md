# model-registry-aggregation Specification

## Purpose
Lets SDK consumers discover each Provider's supported models and uniformly reject unknown model ids before any network call, while keeping the modality-neutral core free of Provider-specific model lists.
## Requirements
### Requirement: Core exposes a stable UNKNOWN_MODEL error code

The `@ai-media/sdk` package SHALL expose an `UNKNOWN_MODEL` `SdkErrorCode` that is non-retryable by default, plus an `unknownModel(modelId, providerId?)` helper that returns an `SdkError` carrying that code. The message SHALL name the model id and, when supplied, the provider id, and SHALL NOT include credentials or request bodies. `UNKNOWN_MODEL` is reserved for "model id is not present in the relevant Provider registry"; capability or modality mismatches for known models SHALL continue to use `INVALID_REQUEST`.

#### Scenario: Unknown model error is non-retryable

- **WHEN** an unknown model id is rejected at a Provider factory
- **THEN** the thrown `SdkError` SHALL have `code: "UNKNOWN_MODEL"` and `retryable: false`

#### Scenario: Helper message carries provider context

- **WHEN** `unknownModel("foo", "aliyun-bailian")` is called
- **THEN** the resulting `SdkError.message` SHALL mention both the model id `"foo"` and the provider id `"aliyun-bailian"`, and SHALL NOT mention any API key

#### Scenario: Known-but-incompatible model stays INVALID_REQUEST

- **WHEN** a known model id is rejected because its capabilities do not match the request (e.g. `edit` on a non-editable model, or a video model via `provider.image()`)
- **THEN** the error SHALL remain `INVALID_REQUEST`, not `UNKNOWN_MODEL`

### Requirement: Core exposes a model-registry aggregation contract

The `@ai-media/sdk` package SHALL expose a `SupportedModel` projection (carrying `providerId`, `id`, optional `label`, `modality`, and `capabilities`), a `ModelRegistry` shape (`{ providerId, models: readonly SupportedModel[] }`), and a `ModelListable` interface (`{ providerId; listModels(): readonly SupportedModel[] }`). The core SHALL NOT import any Provider package; aggregation sources are passed in by the caller.

#### Scenario: Aggregation contract is exported from the package root

- **WHEN** a consumer imports `SupportedModel`, `ModelRegistry`, `ModelListable`, `collectSupportedModels`, `findSupportedModel`, or `isSupportedModel` from `@ai-media/sdk`
- **THEN** the symbols SHALL resolve from the package root export without reaching into `src/*`

#### Scenario: ModelListable providers participate in aggregation

- **WHEN** a `ModelListable` Provider instance is passed to `collectSupportedModels`
- **THEN** the function SHALL call its `listModels()` and include the returned models in the aggregate

#### Scenario: ModelRegistry consts participate in aggregation

- **WHEN** a `ModelRegistry` const is passed to `collectSupportedModels`
- **THEN** the function SHALL include its `models` array in the aggregate

### Requirement: Core aggregation helpers merge and query provider model lists

`collectSupportedModels(...sources)` SHALL accept any mix of `ModelRegistry` consts and `ModelListable` Provider instances and return a flat `readonly SupportedModel[]` preserving source order. `findSupportedModel(models, providerId, modelId)` SHALL return the matching `SupportedModel` or `undefined`. `isSupportedModel(models, providerId, modelId)` SHALL return a boolean. Lookup SHALL be stable for duplicate `(providerId, modelId)` pairs (first match wins) and SHALL NOT perform network access.

#### Scenario: Collect merges multiple provider lists

- **WHEN** `collectSupportedModels(aliyunModelRegistry, seedreamModelRegistry, azureModelRegistry)` is called
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

Every Provider package SHALL export a `*ModelRegistry` const of type `ModelRegistry` (the common projection of its in-package registry) AND expose a `listModels(): readonly SupportedModel[]` instance method on its Provider interface. The instance method SHALL return the same projection as the exported const (single source of truth, zero-overhead wrapper). The Provider's full in-package registry (with Provider-specific fields) SHALL also remain exported for Provider-specific concerns.

#### Scenario: Provider const and instance method agree

- **WHEN** a consumer compares `aliyunModelRegistry.models` to `createAliyunBailianProvider(config).listModels()`
- **THEN** the two arrays SHALL contain the same `SupportedModel` entries in the same order

#### Scenario: listModels returns the projection without network access

- **WHEN** `provider.listModels()` is called immediately after construction
- **THEN** it SHALL return synchronously (a `readonly SupportedModel[]`, not a `Promise`) without invoking the transport

#### Scenario: All three providers expose a registry projection

- **WHEN** a consumer imports `aliyunModelRegistry`, `seedreamModelRegistry`, and `azureModelRegistry` from their respective packages
- **THEN** each SHALL be a `ModelRegistry` whose `providerId` matches the Provider's stable id and whose `models` is a non-empty `SupportedModel[]`

