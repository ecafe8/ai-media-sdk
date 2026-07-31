## ADDED Requirements

### Requirement: Aliyun video adapter submits async tasks to the video-synthesis endpoint

The Aliyun adapter `submit()` SHALL route `video`-modality requests to `POST {baseUrl}/services/aigc/video-generation/video-synthesis` with `X-DashScope-Async: enable`, `Authorization: Bearer {apiKey}`, and `Content-Type: application/json`. It SHALL read `output.task_id` + `output.task_status` from the submit response and return a `TaskHandle<VideoContent[]>` whose poll closure polls the shared `GET /tasks/{task_id}` endpoint. The API key SHALL NOT appear in messages or `cause`.

#### Scenario: Submit request targets the video-synthesis path with the async header

- **WHEN** `submit()` builds a video generation request for a configured `baseUrl` and API key
- **THEN** the `TransportRequest` SHALL target `/services/aigc/video-generation/video-synthesis`, carry the `X-DashScope-Async: enable` and `Authorization: Bearer` headers, and contain a `model` + `input` body

#### Scenario: Unknown video model id is rejected

- **WHEN** `provider.image("not-a-real-video-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not send a request

### Requirement: t2v builds a prompt-only input body

For a text-to-video model, the adapter SHALL build the body `{ model, input: { prompt }, parameters: { resolution?, ratio?, duration?, watermark?, seed? } }` where `parameters` fields are sourced from `providerOptions.aliyun`. No `media` field SHALL be present.

#### Scenario: t2v body carries prompt and ali-native parameters

- **WHEN** `submit()` builds a t2v request with `providerOptions.aliyun` carrying `resolution`, `duration`, and `watermark`
- **THEN** the body `input.prompt` SHALL carry the prompt, `parameters.resolution`/`duration`/`watermark` SHALL carry the values, and `input.media` SHALL be absent

### Requirement: i2v builds a first-frame media input body

For a first-frame image-to-video model, the adapter SHALL build the body `{ model, input: { prompt?, media: [{ type: "first_frame", url }] }, parameters: { resolution?, duration?, watermark?, seed? } }`. The first-frame `ImageContent` SHALL map to `media[0].url` (URL or `data:{mime};base64,{base64}`); `ratio` SHALL be omitted (i2v follows the first-frame aspect ratio).

#### Scenario: i2v body carries the first-frame media entry

- **WHEN** `submit()` builds an i2v request with a `firstFrame` carrying a URL
- **THEN** the body `input.media` SHALL contain exactly one entry `{ type: "first_frame", url: <firstFrame url> }` and `parameters.ratio` SHALL be absent

#### Scenario: i2v maps a base64 first-frame to a data URI

- **WHEN** `submit()` builds an i2v request with a `firstFrame` carrying `base64`
- **THEN** the `media[0].url` SHALL be `"data:" + (mimeType ?? "image/png") + ";base64," + base64`

### Requirement: Shared getTask polls the tasks endpoint and maps task status

The adapter SHALL provide a shared `getTask(taskId)` that calls `GET {baseUrl}/tasks/{task_id}` with `Authorization: Bearer` and maps `output.task_status` to the core `TaskStatus`: `PENDING` → `pending`, `RUNNING`/`PROCESSING` → `running`, `SUCCEEDED` → `succeeded`, `FAILED` → `failed`, `CANCELED` → `cancelled`, `UNKNOWN` → `failed`. It SHALL return the raw task envelope for content extraction.

#### Scenario: Poll maps PENDING and RUNNING to in-progress core statuses

- **WHEN** `getTask` reads a `PENDING` then `RUNNING` task status
- **THEN** the poll closure SHALL return `pending` then `running` and SHALL keep polling

#### Scenario: Poll maps SUCCEEDED and extracts the video url

- **WHEN** `getTask` reads a `SUCCEEDED` status with `output.video_url`
- **THEN** the poll closure SHALL return `{ status: "succeeded", result }` where the `result.content` is a one-element `VideoContent[]` carrying the `video_url`

#### Scenario: Poll maps FAILED/CANCELED/UNKNOWN to terminal errors

- **WHEN** `getTask` reads a `FAILED`/`CANCELED`/`UNKNOWN` status
- **THEN** the poll closure SHALL return `{ status: "failed", error }` or `{ status: "cancelled" }` with a sanitized `SdkError`

### Requirement: Aliyun video HTTP failures classify to stable SDK error codes

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

### Requirement: Aliyun video config and registry reuse the image provider boundary

The video adapter SHALL reuse the existing `AliyunBailianConfig` (`apiKey` + region-scoped `baseUrl`) and the same `Authorization: Bearer` transport. The in-package model registry SHALL register `happyhorse-1.1-t2v` (t2v) and `happyhorse-1.1-i2v` (first-frame i2v) with `modality: "video"`, `generate: true`, `edit: false`, `async: true`.

#### Scenario: HappyHorse video models bind with video and async capabilities

- **WHEN** `provider.image("happyhorse-1.1-t2v")` and `provider.image("happyhorse-1.1-i2v")` are called
- **THEN** each SHALL return an `ImageModelInstance`-shaped instance whose `capabilities.modality` is `"video"` and `capabilities.async` is `true`
