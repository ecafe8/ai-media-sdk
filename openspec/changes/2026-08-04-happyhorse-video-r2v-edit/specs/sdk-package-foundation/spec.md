## MODIFIED Requirements

### Requirement: submitVideoTask binds the video modality entry

The core `submitVideoTask(request)` function SHALL accept a video request carrying a provider-bound video model instance, a `prompt`, an optional `firstFrame: ImageContent` for i2v, optional ordered `referenceImages: ImageContent[]` for r2v/video-edit, an optional `inputVideo` carrying a public video URL for video-edit, and `providerOptions`. It SHALL validate `model.capabilities.async` and the video modality, build a modality-neutral `AdapterRequest`, and dispatch to `model.adapter.submit()` returning a `TaskHandle<VideoContent[]>`. The core SHALL NOT validate model-specific media combinations or prompt requirements; the bound adapter is the sole authority for those. The core SHALL reject a model that is not async and a model whose modality is not video with `INVALID_REQUEST` before dispatch.

#### Scenario: submitVideoTask dispatches for a t2v model

- **WHEN** `submitVideoTask` is called with an async t2v model and a non-empty prompt
- **THEN** it SHALL return a `TaskHandle<VideoContent[]>` bound to the adapter `submit`

#### Scenario: submitVideoTask dispatches for an i2v model with an empty prompt

- **WHEN** `submitVideoTask` is called with an async i2v model and an empty prompt
- **THEN** it SHALL build the adapter request and dispatch, because prompt presence is validated by the adapter, not the core

#### Scenario: submitVideoTask dispatches an r2v request

- **WHEN** `submitVideoTask` is called with an async r2v model, a non-empty prompt, and one to nine reference images
- **THEN** it SHALL return a `TaskHandle<VideoContent[]>` bound to the adapter `submit`

#### Scenario: submitVideoTask dispatches a video-edit request

- **WHEN** `submitVideoTask` is called with an async video-edit model, a non-empty prompt, and one public input video URL
- **THEN** it SHALL return a `TaskHandle<VideoContent[]>` bound to the adapter `submit`

#### Scenario: non-async model is rejected before dispatch

- **WHEN** `submitVideoTask` is called with a model whose `async` capability is false/undefined
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: non-video modality model is rejected before dispatch

- **WHEN** `submitVideoTask` is called with a model whose `modality` is not `"video"`
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter