## MODIFIED Requirements

### Requirement: submitVideoTask binds the video modality entry

The core `submitVideoTask(request)` function SHALL accept a video request carrying a provider-bound video model instance, a `prompt`, an optional `firstFrame: ImageContent` for i2v, optional ordered `referenceImages: ImageContent[]` for r2v/video-edit, an optional `inputVideo` carrying a public video URL for video-edit, and `providerOptions`. It SHALL validate `model.capabilities.async` and the video modality, validate the model-specific media combination before dispatch, build a modality-neutral `AdapterRequest`, and dispatch to `model.adapter.submit()` returning a `TaskHandle<VideoContent[]>`. It SHALL reject invalid prompt/media combinations with `INVALID_REQUEST` before invoking the adapter.

#### Scenario: submitVideoTask dispatches an r2v request

- **WHEN** `submitVideoTask` is called with an async r2v model, a non-empty prompt, and one to nine reference images
- **THEN** it SHALL return a `TaskHandle<VideoContent[]>` bound to the adapter `submit`

#### Scenario: submitVideoTask dispatches a video-edit request

- **WHEN** `submitVideoTask` is called with an async video-edit model, a non-empty prompt, and one public input video URL
- **THEN** it SHALL return a `TaskHandle<VideoContent[]>` bound to the adapter `submit`

#### Scenario: r2v media is rejected before dispatch when invalid

- **WHEN** `submitVideoTask` is called for r2v with no reference images or more than nine
- **THEN** it SHALL throw `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: video-edit media is rejected before dispatch when invalid

- **WHEN** `submitVideoTask` is called for video-edit without an input video or with more than five reference images
- **THEN** it SHALL throw `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: incompatible media is rejected before dispatch

- **WHEN** a t2v/i2v request contains media belonging to another video mode
- **THEN** it SHALL throw `INVALID_REQUEST` and SHALL not invoke the adapter
