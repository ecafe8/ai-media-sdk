## ADDED Requirements

### Requirement: Aliyun Wan image adapter submits async tasks to the image-generation endpoint

The Aliyun adapter `submit()` SHALL route `wan-image`-family requests to `POST {baseUrl}/services/aigc/image-generation/generation` with `X-DashScope-Async: enable`, `Authorization: Bearer {apiKey}`, and `Content-Type: application/json`. It SHALL read `output.task_id` + `output.task_status` from the submit response and return a `TaskHandle<ImageContent[]>` whose poll closure polls the shared `GET /tasks/{task_id}` endpoint (the same endpoint used by HappyHorse video async). The API key SHALL NOT appear in messages or `cause`.

#### Scenario: Submit request targets the image-generation path with the async header

- **WHEN** `submit()` builds a Wan image generation request for a configured `baseUrl` and API key
- **THEN** the `TransportRequest` SHALL target `/services/aigc/image-generation/generation`, carry the `X-DashScope-Async: enable` and `Authorization: Bearer` headers, and contain a `model` + `input` body

#### Scenario: Unknown Wan model id is rejected

- **WHEN** `provider.image("not-a-real-wan-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not send a request

### Requirement: Wan image body builds a prompt and parameters input

For a Wan text-to-image model, the adapter SHALL build the body `{ model, input: { prompt }, parameters: { size?, n?, seed? } }` where `size` and `n` are sourced from the public `ImageGenerationInput` and `seed` (and other Aliyun-native fields) are sourced from `providerOptions.aliyun`. No `media` field SHALL be present.

#### Scenario: Wan body carries prompt and ali-native parameters

- **WHEN** `submit()` builds a Wan request with public `size`/`n` and `providerOptions.aliyun` carrying `seed`
- **THEN** the body `input.prompt` SHALL carry the prompt, `parameters.size`/`n` SHALL carry the public values, `parameters.seed` SHALL carry the aliyun-native value, and `input.media` SHALL be absent

### Requirement: Shared getTask polls the tasks endpoint and maps task status for Wan image

The adapter SHALL reuse the existing shared `getTask(taskId)` (built in Phase 4) that calls `GET {baseUrl}/tasks/{task_id}` with `Authorization: Bearer` and maps `output.task_status` to the core `TaskStatus`: `PENDING` → `pending`, `PROCESSING`/`RUNNING` → `running`, `SUCCEEDED` → `succeeded`, `FAILED` → `failed`, `CANCELED` → `cancelled`, `UNKNOWN` → `failed`. It SHALL return the raw task envelope for content extraction.

#### Scenario: Poll maps PENDING and PROCESSING to in-progress core statuses

- **WHEN** `getTask` reads a `PENDING` then `PROCESSING` task status
- **THEN** the poll closure SHALL return `pending` then `running` and SHALL keep polling

#### Scenario: Poll maps SUCCEEDED and extracts the result urls

- **WHEN** `getTask` reads a `SUCCEEDED` status with `output.results[].url`
- **THEN** the poll closure SHALL return `{ status: "succeeded", result }` where the `result.content` is an `ImageContent[]` carrying one entry per `output.results[].url`

#### Scenario: Poll maps FAILED/CANCELED/UNKNOWN to terminal errors

- **WHEN** `getTask` reads a `FAILED`/`CANCELED`/`UNKNOWN` status
- **THEN** the poll closure SHALL return `{ status: "failed", error }` or `{ status: "cancelled" }` with a sanitized `SdkError`

### Requirement: Wan image async results support multiple urls

Unlike HappyHorse video (fixed `video_count: 1`), Wan image async SHALL map each entry of `output.results[]` to an `ImageContent` entry, producing a potentially multi-element `ImageContent[]` when `n > 1`. The `requestId` SHALL be read from `request_id`; non-sensitive `usage`/`metrics` SHALL be carried in `raw`.

#### Scenario: Multi-element result is returned for n greater than one

- **WHEN** `getTask` reads a `SUCCEEDED` status with `output.results` containing multiple URL entries
- **THEN** the `result.content` SHALL be an `ImageContent[]` with one entry per URL, preserving order

### Requirement: Aliyun Wan image HTTP failures classify to stable SDK error codes

The adapter SHALL classify non-2xx submit and poll responses via the shared `classifyHttpError`: 401/403 → `AUTH_ERROR`, 429 → `RATE_LIMITED`, 400/422 → `INVALID_REQUEST`, 5xx → `PROVIDER_ERROR`, timeout → `TIMEOUT`, network failure → `NETWORK_ERROR`. The sanitized message SHALL be read from the `{ code, message }` body and redacted of the API key.

#### Scenario: Submit authentication failure is not retryable and leak-free

- **WHEN** the submit endpoint responds with HTTP 401
- **THEN** the adapter SHALL throw an `SdkError` with code `AUTH_ERROR`, `retryable: false`, and the error text SHALL omit the API key

#### Scenario: Poll rate limiting is retryable

- **WHEN** the poll endpoint responds with HTTP 429
- **THEN** the adapter SHALL throw an `SdkError` with code `RATE_LIMITED`

#### Scenario: Transport timeout maps to TIMEOUT

- **WHEN** the transport throws a `TransportError` with `kind: "timeout"`
- **THEN** the adapter SHALL throw an `SdkError` with code `TIMEOUT`

### Requirement: Aliyun Wan image config and registry declare async image capability

The Wan image adapter SHALL reuse the existing `AliyunBailianConfig` (`apiKey` + region-scoped `baseUrl`) and the same `Authorization: Bearer` transport. The in-package model registry SHALL register `wan2.7-image-pro`, `wan2.7-image`, and `z-image-turbo` with `modality: "image"`, `generate: true`, `edit: false`, and `async: true`.

#### Scenario: Wan image models bind with image and async capabilities

- **WHEN** `provider.image("wan2.7-image-pro")`, `provider.image("wan2.7-image")`, or `provider.image("z-image-turbo")` is called
- **THEN** each SHALL return an `ImageModelInstance`-shaped instance whose `capabilities.modality` is `"image"` and `capabilities.async` is `true`

### Requirement: Wan sync generate and edit remain not implemented

The Aliyun adapter `generate()` and `edit()` SHALL keep throwing a classified `SdkError` with code `NOT_IMPLEMENTED` for `wan-image`-family models; only `submit()` runs the async image path. The sync path (same endpoint without `X-DashScope-Async`, same `output.results[].url` result shape) is deferred to a later slice.

#### Scenario: Wan sync generate stays not implemented

- **WHEN** the Aliyun adapter `generate` is invoked for a `wan-image`-family model during this slice
- **THEN** it SHALL throw a classified `SdkError` with code `NOT_IMPLEMENTED`, `retryable: false`, and SHALL not invoke the transport

#### Scenario: Wan sync edit stays not implemented

- **WHEN** the Aliyun adapter `edit` is invoked for a `wan-image`-family model during this slice
- **THEN** it SHALL throw a classified `SdkError` with code `NOT_IMPLEMENTED`, `retryable: false`, and SHALL not invoke the transport
