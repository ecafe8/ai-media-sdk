# doubao-seedream-image-generation Specification

## Purpose
TBD - created by archiving change phase-3-seedream-image-slice. Update Purpose after archive.
## Requirements
### Requirement: Seedream adapter dispatches by an in-package model registry
The Doubao-Seedream provider SHALL maintain an in-package model capability registry mapping each `modelId` to its capabilities, supported parameters, and accepted output formats. `provider.image(modelId)` SHALL bind a model instance to the shared adapter and SHALL reject an unknown model id with `UNKNOWN_MODEL`.

#### Scenario: Known Seedream model binds to the adapter

- **WHEN** `provider.image("doubao-seedream-5-0-pro-260628")` is called
- **THEN** it SHALL return an `ImageModelInstance` with `providerId` `doubao-seedream`, the model id, image-generation/edit capabilities, and the bound adapter

#### Scenario: Unknown model id is rejected

- **WHEN** `provider.image("not-a-real-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `UNKNOWN_MODEL` and SHALL not send a request

### Requirement: Seedream request is built via the shared transport

The Seedream adapter SHALL build `POST {baseUrl}/images/generations` with `Authorization: Bearer {apiKey}` and a JSON body `{ model, prompt, size?, response_format? }` plus Seedream-native fields under `providerOptions.seedream`, sent through the injected shared `Transport` rather than global `fetch`. `generate()` SHALL omit the `image` field.

#### Scenario: T2I request URL and auth header are correct

- **WHEN** the adapter builds a Seedream generation request for a configured `baseUrl` and API key
- **THEN** the `TransportRequest` SHALL target the `/images/generations` path, carry the `Authorization: Bearer` header, and contain a `prompt` body without an `image` field

#### Scenario: Public parameters map to the request body

- **WHEN** the request supplies `prompt` and `size`
- **THEN** the body SHALL carry the prompt and `size` SHALL carry the size value (tier or `WxH`)

#### Scenario: Seedream-native options forward through the provider namespace

- **WHEN** the request supplies `providerOptions.seedream` with `watermark`, `output_format`, or `optimize_prompt_options`
- **THEN** the adapter SHALL forward them into the body and SHALL NOT expose them as public parameters

#### Scenario: Seedream adapter does not call global fetch

- **WHEN** the adapter executes a Seedream generation with an injected counting transport
- **THEN** it SHALL send exactly through the injected transport and SHALL not reference global `fetch`

### Requirement: Seedream sync response maps to image content results

The Seedream adapter SHALL map the `data[]` response into a `GenerationResult<ImageContent[]>` carrying one `ImageContent` per returned image (`url` or `base64` from `b64_json`), plus `provider: "doubao-seedream"`, the model id, `requestId` from `request_id` when present, and non-sensitive `usage` metadata. When `data[].size` is a `"WxH"` string, the adapter SHALL parse it into `width`/`height`.

#### Scenario: Image URLs map to image content

- **WHEN** the response returns one or more `data[].url` values
- **THEN** the result `content` SHALL be an array of `ImageContent` each carrying the `url`, with provider id `doubao-seedream` and the model id

#### Scenario: Base64 results map to image content

- **WHEN** the response returns `data[].b64_json` values
- **THEN** the result `content` SHALL carry each as `base64` on an `ImageContent`

#### Scenario: Multiple data entries map to multiple images

- **WHEN** the response returns multiple `data[]` entries
- **THEN** the result `content` SHALL contain one `ImageContent` per entry

### Requirement: Seedream image editing reuses the T2I endpoint with an image field

The Seedream adapter `edit()` SHALL build the same `POST {baseUrl}/images/generations` request as `generate()`, differing only by adding the `image` field: a single string for one reference image, or a `string[]` for 1-N references (up to the model's `maxEditImages`: 10 for `doubao-seedream-5-0-pro`, 14 for the others), preserving input order. Response mapping and error classification SHALL be identical to T2I.

#### Scenario: Single-image edit sends a string image field

- **WHEN** `edit()` is called with one input image and a prompt
- **THEN** the request body `image` SHALL be a single string (the image URL or data URI)

#### Scenario: Multi-image edit sends an ordered string array image field

- **WHEN** `edit()` is called with 2-N input images
- **THEN** the request body `image` SHALL be a `string[]` whose entries follow the input image order

#### Scenario: I2I response maps like T2I

- **WHEN** the response returns `data[]` for an edit call
- **THEN** the result SHALL be a `GenerationResult<ImageContent[]>` with `provider: "doubao-seedream"` and the model id, identical in shape to the T2I result

### Requirement: Image inputs map to Seedream image entries

For each input `ImageContent`, the adapter SHALL emit one image entry: `input.url` → the URL string; otherwise `input.base64` → `"data:" + (mimeType ?? "image/png") + ";base64," + base64` (mime lowercase). An input carrying neither `url` nor `base64` SHALL be rejected with `INVALID_REQUEST`.

#### Scenario: URL input maps to an image entry

- **WHEN** an input `ImageContent` carries a `url`
- **THEN** the adapter SHALL place the URL string in the `image` field

#### Scenario: Base64 input maps to a data-URI image entry

- **WHEN** an input `ImageContent` carries `base64` (and no `url`)
- **THEN** the adapter SHALL place `"data:" + (mimeType ?? "image/png") + ";base64," + base64` in the `image` field

### Requirement: Seedream HTTP failures classify to stable SDK error codes

The Seedream adapter SHALL classify non-2xx responses and transport failures via the shared `classifyHttpError`: 401/403 → `AUTH_ERROR`, 429 → `RATE_LIMITED`, 400/422 → `INVALID_REQUEST`, 5xx → `PROVIDER_ERROR`, timeout → `TIMEOUT`, network failure → `NETWORK_ERROR`. The sanitized message SHALL be read from the OpenAI-style `{ error: { code, message } }` body and the API key SHALL NOT appear in messages or `cause`.

#### Scenario: Authentication failure is not retryable and leak-free

- **WHEN** Ark responds with HTTP 401
- **THEN** the adapter SHALL throw an `SdkError` with code `AUTH_ERROR`, `retryable: false`, and the error text SHALL omit the API key

#### Scenario: Rate limiting is retryable

- **WHEN** Ark responds with HTTP 429
- **THEN** the adapter SHALL throw an `SdkError` with code `RATE_LIMITED`

#### Scenario: Server error maps to provider error

- **WHEN** Ark responds with HTTP 5xx
- **THEN** the adapter SHALL throw an `SdkError` with code `PROVIDER_ERROR`

### Requirement: Seedream config requires an API key and a regional base URL

`SeedreamConfig` SHALL require `apiKey` and `baseUrl`, where `baseUrl` is the regional Ark API base (e.g. `https://ark.cn-beijing.volces.com/api/v3`). The package SHALL supply the `ark+cn-beijing` default when a caller omits `baseUrl`.

#### Scenario: Config shape is explicit

- **WHEN** a consumer constructs the Seedream Provider configuration
- **THEN** TypeScript SHALL require the `apiKey` field and SHALL allow `baseUrl` to default to the Ark cn-beijing endpoint

### Requirement: editImage pre-flight validates edit capability and image count

`editImage` SHALL reject a model whose capabilities do not include edit with `INVALID_REQUEST`, and SHALL reject an `images` array whose length is outside the model's `maxEditImages` (10 for `doubao-seedream-5-0-pro`, 14 for the others) with `INVALID_REQUEST` before any transport call.

#### Scenario: Non-editable model is rejected pre-flight

- **WHEN** `editImage` is called with a model whose `capabilities.edit` is false
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the transport

#### Scenario: Out-of-range image count is rejected pre-flight

- **WHEN** `editImage` is called with zero images or more than `maxEditImages`
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the transport

