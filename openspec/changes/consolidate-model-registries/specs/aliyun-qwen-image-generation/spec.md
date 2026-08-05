## MODIFIED Requirements

### Requirement: Aliyun adapter dispatches by model family via an in-package registry
The Aliyun Bailian provider SHALL maintain an in-package model capability registry mapping each `modelId` to its endpoint family (`qwen-multimodal` or `wan-image`), capabilities, and supported parameters. `provider.image(modelId)` SHALL bind a model instance to the shared adapter and SHALL reject an unknown model id with `UNKNOWN_MODEL`. Known video-family models SHALL be rejected by `provider.image()` with `INVALID_REQUEST` ("is not an image model") so callers use `provider.video()` for video models.

#### Scenario: Known Qwen model binds to the adapter
- **WHEN** `provider.image("qwen-image-2.0-pro")` is called
- **THEN** it SHALL return an `ImageModelInstance` with `providerId` `aliyun-bailian`, the model id, image-generation capabilities, and the bound adapter

#### Scenario: Unknown model id is rejected
- **WHEN** `provider.image("not-a-real-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `UNKNOWN_MODEL` and SHALL not send a request

#### Scenario: Wan models stay not implemented in this slice
- **WHEN** the adapter `generate` or `edit` is dispatched for a Wan-family model id (e.g. `wan2.7-image-pro`)
- **THEN** it SHALL throw an `SdkError` with code `NOT_IMPLEMENTED`, `retryable: false`, and SHALL not invoke the transport

#### Scenario: Video-family models are rejected by the image factory
- **WHEN** `provider.image("happyhorse-1.1-t2v")` is called
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` whose message names the model as not an image model, and SHALL not bind an image instance
