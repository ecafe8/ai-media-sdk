## ADDED Requirements

### Requirement: Aliyun adapter dispatches by model family via an in-package registry
The Aliyun Bailian provider SHALL maintain an in-package model capability registry mapping each `modelId` to its endpoint family (`qwen-multimodal` or `wan-image`), capabilities, and supported parameters. `provider.image(modelId)` SHALL bind a model instance to the shared adapter and SHALL reject an unknown model id with `INVALID_REQUEST`.

#### Scenario: Known Qwen model binds to the adapter
- **WHEN** `provider.image("qwen-image-2.0-pro")` is called
- **THEN** it SHALL return an `ImageModelInstance` with `providerId` `aliyun-bailian`, the model id, image-generation capabilities, and the bound adapter

#### Scenario: Unknown model id is rejected
- **WHEN** `provider.image("not-a-real-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not send a request

#### Scenario: Wan models stay not implemented in this slice
- **WHEN** the adapter `generate` is dispatched for a Wan-family model id (e.g. `wan2.7-image-pro`)
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
