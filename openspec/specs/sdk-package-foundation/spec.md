# sdk-package-foundation Specification

## Purpose
TBD - created by archiving change phase-0-sdk-foundation. Update Purpose after archive.
## Requirements
### Requirement: Core package exposes a modality-neutral alpha contract
The `@ai-media/sdk` package SHALL expose TypeScript contracts for Provider/model identity, capabilities, transport, adapter requests/results, `GenerationResult<TContent>`, `TaskHandle<TContent>`, retry policy, and classified SDK errors. Image specialization SHALL use the array content form so a single generation result can carry multiple images.

#### Scenario: Core package resolves through the workspace export
- **WHEN** a workspace consumer imports `@ai-media/sdk`
- **THEN** the import resolves to the package source entry without requiring an external runtime SDK

#### Scenario: Image content specializes the generic result contract
- **WHEN** an image API type is declared in the core package
- **THEN** it uses `GenerationResult<ImageContent[]>` or `TaskHandle<ImageContent[]>` for the image modality rather than a separate non-generic task/result model, keeping `GenerationResult<TContent>` generic for other modalities

### Requirement: Core package root exports are explicit
The `@ai-media/sdk` root entry SHALL export the supported Phase 0 public contracts and image stubs; consumers SHALL NOT need to import implementation files through `src` paths.

#### Scenario: Consumer imports supported root API
- **WHEN** a consumer imports `generateImage`, `editImage`, `ImageContent`, `GenerationResult`, `TaskHandle`, or `SdkError` from `@ai-media/sdk`
- **THEN** the symbols SHALL resolve from the package root export

#### Scenario: Internal source paths are not required
- **WHEN** a consumer uses the Phase 0 API
- **THEN** the consumer SHALL not need to import from `@ai-media/sdk/src/*`

### Requirement: Runtime core remains Node-oriented
The core package runtime TypeScript configuration SHALL use the shared Node library configuration without DOM libraries or Bun-only runtime types.

#### Scenario: Browser-only globals are unavailable to runtime source
- **WHEN** core runtime source references a browser global such as `window` or `document`
- **THEN** the package typecheck SHALL reject the reference

#### Scenario: Bun test types remain isolated
- **WHEN** core tests import from `bun:test`
- **THEN** the test tsconfig SHALL provide Bun types without adding Bun runtime types to the production tsconfig

### Requirement: Core package has a passing Bun smoke test
The core package SHALL contain at least one `bun:test` test that validates a stable error or contract behavior without network access.

#### Scenario: Core smoke test runs locally
- **WHEN** the root test task runs
- **THEN** the core smoke test SHALL pass without Provider credentials or external network access

### Requirement: Image editing dispatches through a provider-bound model instance
The core `editImage` function SHALL accept an image edit request carrying a provider-bound image model instance and 1-3 input images, validate `model.capabilities.edit` and the image count against the model's `maxEditImages`, build a modality-neutral `AdapterRequest`, and dispatch to `model.adapter.edit` instead of throwing `NOT_IMPLEMENTED`.

#### Scenario: editImage dispatches to the bound adapter
- **WHEN** `editImage` is called with a request whose `model` supports editing and `images` is within `maxEditImages`
- **THEN** it SHALL build an `AdapterRequest` with the prompt and images and invoke the adapter `edit`, returning the adapter's `GenerationResult<ImageContent[]>`

#### Scenario: Non-editable model is rejected before dispatch
- **WHEN** `editImage` is called with a model whose `capabilities.edit` is false
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: Out-of-range image count is rejected before dispatch
- **WHEN** `editImage` is called with zero images or more than `maxEditImages`
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

### Requirement: Image edit request carries a multi-image input contract
`ImageEditRequest` SHALL carry `model: ImageModelInstance`, `prompt: string`, and `images: ImageContent[]` (1-3 inputs). The `ImageContent` type SHALL keep `url` and `base64` (and optional `mimeType`) so providers can map each input to their native image-entry form. The Phase 0 singular `image: ImageContent` shape is retired.

#### Scenario: Edit request exposes a multi-image array
- **WHEN** a consumer constructs an `ImageEditRequest`
- **THEN** TypeScript SHALL require `model`, `prompt`, and `images` fields, and `images` SHALL be an array of `ImageContent`

#### Scenario: Single-image edit uses a one-element array
- **WHEN** a consumer edits a single image
- **THEN** it SHALL pass `images: [image]` rather than a singular `image` field

