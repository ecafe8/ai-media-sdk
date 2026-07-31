# aliyun-qwen-image-generation Specification

## Purpose
TBD - created by archiving change phase-2-aliyun-qwen-image-slice. Update Purpose after archive.
## Requirements
### Requirement: Aliyun adapter dispatches by model family via an in-package registry
The Aliyun Bailian provider SHALL maintain an in-package model capability registry mapping each `modelId` to its endpoint family (`qwen-multimodal` or `wan-image`), capabilities, and supported parameters. `provider.image(modelId)` SHALL bind a model instance to the shared adapter and SHALL reject an unknown model id with `INVALID_REQUEST`.

#### Scenario: Known Qwen model binds to the adapter
- **WHEN** `provider.image("qwen-image-2.0-pro")` is called
- **THEN** it SHALL return an `ImageModelInstance` with `providerId` `aliyun-bailian`, the model id, image-generation capabilities, and the bound adapter

#### Scenario: Unknown model id is rejected
- **WHEN** `provider.image("not-a-real-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not send a request

#### Scenario: Wan models stay not implemented in this slice
- **WHEN** the adapter `generate` or `edit` is dispatched for a Wan-family model id (e.g. `wan2.7-image-pro`)
- **THEN** it SHALL throw an `SdkError` with code `NOT_IMPLEMENTED`, `retryable: false`, and SHALL not invoke the transport

### Requirement: Qwen request is built via the shared transport
The Aliyun adapter SHALL build `POST {baseUrl}/services/aigc/multimodal-generation/generation` with `Authorization: Bearer {apiKey}` and a JSON body `{ model, input: { messages: [{ role: "user", content: [{ text: prompt }] }] }, parameters: { size?, n?, negative_prompt?, prompt_extend?, watermark? } }`, sent through the injected shared `Transport` rather than global `fetch`.

#### Scenario: Qwen request URL and auth header are correct
- **WHEN** the adapter builds a Qwen generation request for a configured `baseUrl` and API key
- **THEN** the `TransportRequest` SHALL target the `multimodal-generation/generation` path, carry the `Authorization: Bearer` header, and contain a `messages` body with the prompt

#### Scenario: Public parameters map to the Qwen request body
- **WHEN** the request supplies `prompt` and `size`
- **THEN** the body `input.messages` SHALL carry the prompt and `parameters.size` SHALL carry the size value

#### Scenario: Aliyun-native options forward through the provider namespace
- **WHEN** the request supplies `providerOptions.aliyun` with `negative_prompt`, `prompt_extend`, or `watermark`
- **THEN** the adapter SHALL forward them into the `parameters` body and SHALL NOT expose them as public parameters

#### Scenario: Aliyun adapter does not call global fetch
- **WHEN** the adapter executes a Qwen generation with an injected counting transport
- **THEN** it SHALL send exactly through the injected transport and SHALL not reference global `fetch`

### Requirement: Qwen sync response maps to image content results
The Aliyun adapter SHALL map `output.choices[].message.content[].image` into a `GenerationResult<ImageContent[]>` carrying one `ImageContent` per returned image URL, plus `provider: "aliyun-bailian"`, the model id, `requestId` from `request_id` when present, and non-sensitive `usage` metadata.

#### Scenario: Image URLs map to image content
- **WHEN** Qwen returns one or more `content[].image` URLs
- **THEN** the result `content` SHALL be an array of `ImageContent` each carrying the `url`, with provider id `aliyun-bailian` and the model id

#### Scenario: Multiple choices map to multiple image entries
- **WHEN** Qwen returns multiple `choices` each with an image
- **THEN** the result `content` SHALL contain one `ImageContent` per choice

### Requirement: Aliyun HTTP failures classify to stable SDK error codes
The Aliyun adapter SHALL classify non-2xx responses and transport failures via the shared `classifyHttpError`: 401/403 → `AUTH_ERROR`, 429 → `RATE_LIMITED`, 400/422 → `INVALID_REQUEST` (including content-safety `DataInspectionFailed`), 5xx → `PROVIDER_ERROR`, timeout → `TIMEOUT`, network failure → `NETWORK_ERROR`. Error messages and `cause` SHALL NOT include the API key.

#### Scenario: Authentication failure is not retryable and leak-free
- **WHEN** Aliyun responds with HTTP 401
- **THEN** the adapter SHALL throw an `SdkError` with code `AUTH_ERROR`, `retryable: false`, and the error text SHALL omit the API key

#### Scenario: Rate limiting is retryable
- **WHEN** Aliyun responds with HTTP 429 (or a `Throttling` error body)
- **THEN** the adapter SHALL throw an `SdkError` with code `RATE_LIMITED`

#### Scenario: Content-safety rejection is an invalid request
- **WHEN** Aliyun returns a `DataInspectionFailed` error body on HTTP 400
- **THEN** the adapter SHALL throw an `SdkError` with code `INVALID_REQUEST`

### Requirement: Aliyun config requires a region-scoped base URL
`AliyunBailianConfig` SHALL require `apiKey` and a region-scoped `baseUrl` (e.g. `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1`). The optional-`baseUrl` Phase 0 shape is retired.

#### Scenario: Config shape is explicit
- **WHEN** a consumer constructs the Aliyun Provider configuration
- **THEN** TypeScript SHALL require both `apiKey` and `baseUrl` fields

### Requirement: Qwen image editing reuses the T2I endpoint and request contract
The Aliyun adapter `edit()` SHALL build the same `POST {baseUrl}/services/aigc/multimodal-generation/generation` request as `generate()`, differing only in the `content` array: it SHALL lead with 1-3 `{"image": ...}` entries (in input order) followed by exactly one `{"text": prompt}`. Response mapping and error classification SHALL be identical to T2I.

#### Scenario: I2I content array shape
- **WHEN** `edit()` is called for a Qwen model with 1-3 input images and a prompt
- **THEN** the request body `input.messages[0].content` SHALL contain the image entries first, in input order, followed by a single text entry

#### Scenario: I2I response maps like T2I
- **WHEN** Qwen returns `output.choices[].message.content[].image` for an edit call
- **THEN** the result SHALL be a `GenerationResult<ImageContent[]>` with `provider: "aliyun-bailian"` and the model id, identical in shape to the T2I result

### Requirement: Image inputs map to Qwen content entries
For each input `ImageContent`, the adapter SHALL emit a Qwen `{"image": <value>}` entry: `input.url` → `{image: url}`; otherwise `input.base64` → `{image: "data:" + (mimeType ?? "image/png") + ";base64," + base64}`.

#### Scenario: URL input maps to an image entry
- **WHEN** an input `ImageContent` carries a `url`
- **THEN** the adapter SHALL place `{"image": url}` in the content array

#### Scenario: Base64 input maps to a data-URI image entry
- **WHEN** an input `ImageContent` carries `base64` (and no `url`)
- **THEN** the adapter SHALL place `{"image": "data:" + (mimeType ?? "image/png") + ";base64," + base64}` in the content array

### Requirement: editImage pre-flight validates edit capability and image count
`editImage` SHALL reject a model whose capabilities do not include edit with `INVALID_REQUEST`, and SHALL reject an `images` array whose length is outside the model's `maxEditImages` (Qwen: 1-3) with `INVALID_REQUEST` before any transport call.

#### Scenario: Non-editable model is rejected pre-flight
- **WHEN** `editImage` is called with a model whose `capabilities.edit` is false
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the transport

#### Scenario: Out-of-range image count is rejected pre-flight
- **WHEN** `editImage` is called with zero images or more than `maxEditImages`
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the transport

