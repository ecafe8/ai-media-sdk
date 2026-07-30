## ADDED Requirements

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
