## ADDED Requirements

### Requirement: submitImageTask binds the image async modality entry

The core `submitImageTask(request)` function SHALL accept an image async request carrying a provider-bound image model instance, a `prompt`, optional `n` and `size`, and `providerOptions`, reusing the existing `ImageGenerationRequest` type (the same shape as sync `generateImage`). It SHALL validate `model.capabilities.async` and the image modality, build a modality-neutral `AdapterRequest` with `modality: "image"` and an `ImageGenerationInput` payload, and dispatch to `model.adapter.submit()` via `submitTask<ImageContent[]>`, returning a `TaskHandle<ImageContent[]>`. It SHALL reject a non-async model, a non-image modality model, and an empty `prompt` with `INVALID_REQUEST` before dispatch.

#### Scenario: submitImageTask dispatches for an async image model

- **WHEN** `submitImageTask` is called with an async-capable image model (`modality: "image"`, `async: true`) and a non-empty prompt
- **THEN** it SHALL return a `TaskHandle<ImageContent[]>` bound to the adapter `submit`

#### Scenario: Non-async image model is rejected before dispatch

- **WHEN** `submitImageTask` is called with a model whose `async` capability is false/undefined
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: Non-image modality model is rejected before dispatch

- **WHEN** `submitImageTask` is called with a model whose `modality` is not `"image"` (e.g. video)
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: Empty prompt is rejected before dispatch

- **WHEN** `submitImageTask` is called with an empty prompt
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

### Requirement: submitImageTask reuses the sync image generation request type

`submitImageTask` SHALL reuse the existing `ImageGenerationRequest` (`{ model: ImageModelInstance, prompt, n?, size?, providerOptions? }`) as its public request type rather than introducing a new `ImageSubmissionRequest`. The sync `generateImage` and async `submitImageTask` entry points SHALL share the same public request contract; the dispatch path differs (sync → `adapter.generate`, async → `adapter.submit` via `submitTask`).

#### Scenario: submitImageTask accepts the same request shape as generateImage

- **WHEN** a consumer constructs a request for `submitImageTask`
- **THEN** TypeScript SHALL accept an `ImageGenerationRequest` value identical to what `generateImage` accepts, with `model`, `prompt`, optional `n`/`size`, and optional `providerOptions`
