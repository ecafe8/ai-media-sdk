## MODIFIED Requirements

### Requirement: Core exposes a model-registry aggregation contract

The `@ai-media/sdk` package SHALL expose a `SupportedModel` projection (carrying `providerId`, `id`, optional `label`, `modality`, and `capabilities`), a `ModelRegistry` shape (`{ providerId, models: readonly SupportedModel[] }`), and a `ModelListable` interface (`{ providerId; listModels(): readonly SupportedModel[] }`). `ModelCapability` SHALL be a `readonly` interface with the fields: `modality: Modality`, `generate: boolean`, `edit: boolean`, optional `maxEditImages: number`, optional `async: boolean`, optional `supportedSizes: readonly string[]`, optional `maxResolution: { readonly width: number; readonly height: number }`, and optional `maxN: number`. The `supportedSizes`/`maxResolution`/`maxN` fields SHALL be honoured by `generateImage` pre-flight validation (see the `image-param-validation` capability) and SHALL be projected unchanged from each Provider's in-package registry. The core SHALL NOT import any Provider package; aggregation sources are passed in by the caller.

#### Scenario: Aggregation contract is exported from the package root

- **WHEN** a consumer imports `SupportedModel`, `ModelRegistry`, `ModelListable`, `collectSupportedModels`, `findSupportedModel`, or `isSupportedModel` from `@ai-media/sdk`
- **THEN** the symbols SHALL resolve from the package root export without reaching into `src/*`

#### Scenario: ModelListable providers participate in aggregation

- **WHEN** a `ModelListable` Provider instance is passed to `collectSupportedModels`
- **THEN** the function SHALL call its `listModels()` and include the returned models in the aggregate

#### Scenario: ModelRegistry consts participate in aggregation

- **WHEN** a `ModelRegistry` const is passed to `collectSupportedModels`
- **THEN** the function SHALL include its `models` array in the aggregate

#### Scenario: SupportedModel projection carries size and maxN metadata

- **WHEN** a Provider's in-package registry declares `supportedSizes`, `maxResolution`, or `maxN` for a model
- **THEN** the projected `SupportedModel.capabilities` for that model SHALL carry those fields unchanged, so consumers (including Playground) can drive UI and validation from the aggregation result

### Requirement: Each Provider exposes its model registry and a listModels instance accessor

Every Provider package SHALL export a `*ModelRegistry` const of type `ModelRegistry` (the common projection of its in-package registry) AND expose a `listModels(): readonly SupportedModel[]` instance method on its Provider interface. The instance method SHALL return the same projection as the exported const (single source of truth, zero-overhead wrapper). The Provider's full in-package registry (with Provider-specific fields, including Aliyun's `family`/`paramSupport`/`requiresFirstFrame`/`requiresInputVideo`/`maxReferenceImages`/`supportedResolutions`/`supportedAspectRatios`, and Seedream's `paramSupport`/`outputFormats`) SHALL also remain exported for Provider-specific concerns. Provider-specific fields SHALL NOT enter the common `SupportedModel` projection; consumers needing them import the Provider's full registry directly.

#### Scenario: Provider const and instance method agree

- **WHEN** a consumer compares `aliyunModelRegistry.models` to `createAliyunBailianProvider(config).listModels()`
- **THEN** the two arrays SHALL contain the same `SupportedModel` entries in the same order

#### Scenario: listModels returns the projection without network access

- **WHEN** `provider.listModels()` is called immediately after construction
- **THEN** it SHALL return synchronously (a `readonly SupportedModel[]`, not a `Promise`) without invoking the transport

#### Scenario: All three providers expose a registry projection

- **WHEN** a consumer imports `aliyunModelRegistry`, `seedreamModelRegistry`, and `azureModelRegistry` from their respective packages
- **THEN** each SHALL be a `ModelRegistry` whose `providerId` matches the Provider's stable id and whose `models` is a non-empty `SupportedModel[]`

#### Scenario: Aliyun video resolution metadata stays in the full registry

- **WHEN** a consumer needs the per-model list of supported `resolution` strings for a HappyHorse video model
- **THEN** the consumer SHALL import `ALIYUN_MODEL_REGISTRY` directly; the common `SupportedModel` projection SHALL NOT carry `supportedResolutions` (it is Provider-specific)
