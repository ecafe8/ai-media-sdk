# aliyun-video-generation Specification

## Purpose
Aliyun Bailian (DashScope) video generation and editing via the HappyHorse model family: asynchronous task submission to `POST /services/aigc/video-generation/video-synthesis` (`X-DashScope-Async: enable`) and polling via the shared `GET /tasks/{task_id}` endpoint, mapping `output.video_url` to a single-element `VideoContent[]`. Four modes are covered: text-to-video (t2v, `happyhorse-1.1-t2v`), first-frame image-to-video (i2v, `happyhorse-1.1-i2v`), reference-to-video (r2v, `happyhorse-1.1-r2v`, 1-9 reference images), and video editing (`happyhorse-1.0-video-edit`, 1 source video + 0-5 reference images). The four modes share the same submit endpoint, task state machine, and poll path; they differ only in `input.media` composition and forwarded `parameters`.
## Requirements
### Requirement: Aliyun video adapter submits async tasks to the video-synthesis endpoint

The Aliyun adapter `submit()` SHALL route `video`-modality requests to `POST {baseUrl}/services/aigc/video-generation/video-synthesis` with `X-DashScope-Async: enable`, `Authorization: Bearer {apiKey}`, and `Content-Type: application/json`. It SHALL read `output.task_id` + `output.task_status` from the submit response and return a `TaskHandle<VideoContent[]>` whose poll closure polls the shared `GET /tasks/{task_id}` endpoint. The API key SHALL NOT appear in messages or `cause`.

#### Scenario: Submit request targets the video-synthesis path with the async header

- **WHEN** `submit()` builds a video generation request for a configured `baseUrl` and API key
- **THEN** the `TransportRequest` SHALL target `/services/aigc/video-generation/video-synthesis`, carry the `X-DashScope-Async: enable` and `Authorization: Bearer` headers, and contain a `model` + `input` body

#### Scenario: Unknown video model id is rejected

- **WHEN** `provider.image("not-a-real-video-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `UNKNOWN_MODEL` and SHALL not send a request

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

### Requirement: r2v builds a reference-image media input body

For a reference-to-video model (e.g. `happyhorse-1.1-r2v`), the adapter SHALL build the body `{ model, input: { prompt, media: [{ type: "reference_image", url }, ...] }, parameters: { resolution?, ratio?, duration?, watermark?, seed? } }`. The `referenceImages` array SHALL map in order to `media` entries (1-9 entries), so the prompt's `[Image N]` references correspond to array position N (1-based). No `first_frame` or `video` media entry SHALL be present.

#### Scenario: r2v body carries ordered reference-image media entries

- **WHEN** `submit()` builds an r2v request with three `referenceImages`
- **THEN** the body `input.media` SHALL contain exactly three entries each `{ type: "reference_image", url: <mapped url> }` in the input order, `input.prompt` SHALL carry the prompt verbatim (including `[Image N]` references), and `parameters.ratio`/`duration` SHALL be forwarded when supplied

#### Scenario: r2v base64 reference images map to data URIs

- **WHEN** `submit()` builds an r2v request whose `referenceImages` carry `base64`
- **THEN** each `media[].url` SHALL be `"data:" + (mimeType ?? "image/png") + ";base64," + base64`

### Requirement: video-edit builds a source-video plus reference-image media input body

For a video-editing model (e.g. `happyhorse-1.0-video-edit`), the adapter SHALL build the body `{ model, input: { prompt, media: [{ type: "video", url }, { type: "reference_image", url }, ...] }, parameters: { resolution?, watermark?, audio_setting?, seed? } }`. The `inputVideo` SHALL map to the first `media` entry `{ type: "video", url }`; the optional `referenceImages` (0-5) SHALL follow as `{ type: "reference_image", url }` entries. `ratio` and `duration` SHALL NOT be forwarded (the edit follows the source video's aspect ratio and duration).

#### Scenario: video-edit body leads with the source video entry

- **WHEN** `submit()` builds a video-edit request with an `inputVideo` URL and two `referenceImages`
- **THEN** the body `input.media` SHALL be `[{ type: "video", url: <video url> }, { type: "reference_image", url: <ref 1> }, { type: "reference_image", url: <ref 2> }]`, and `parameters` SHALL NOT contain `ratio` or `duration`

#### Scenario: video-edit forwards the audio_setting native option

- **WHEN** `submit()` builds a video-edit request with `providerOptions.aliyun.audio_setting = "origin"`
- **THEN** `parameters.audio_setting` SHALL equal `"origin"`

### Requirement: Video media input combinations are gated by model capability

The adapter SHALL validate the media combination against the model's registry entry before sending any transport request: a t2v model SHALL reject any `firstFrame`/`referenceImages`/`inputVideo`; an i2v model SHALL require exactly one `firstFrame` and reject `referenceImages`/`inputVideo`; an r2v model SHALL require 1-9 `referenceImages` and reject `firstFrame`/`inputVideo`; a video-edit model SHALL require exactly one `inputVideo`, accept 0-5 `referenceImages`, and reject `firstFrame`. Violations SHALL throw `INVALID_REQUEST` before dispatch.

#### Scenario: r2v submission without reference images is rejected before transport

- **WHEN** `submit()` is called for an r2v model with no `referenceImages`
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL NOT send a request

#### Scenario: video-edit submission without an input video is rejected before transport

- **WHEN** `submit()` is called for a video-edit model with no `inputVideo`
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL NOT send a request

#### Scenario: reference image count above the model limit is rejected before transport

- **WHEN** `submit()` is called for an r2v model with ten `referenceImages` (limit 9) or a video-edit model with six `referenceImages` (limit 5)
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL NOT send a request

#### Scenario: media input on a t2v model is rejected before transport

- **WHEN** `submit()` is called for a t2v model with a `firstFrame`, `referenceImages`, or `inputVideo`
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL NOT send a request

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

The video adapter SHALL reuse the existing `AliyunBailianConfig` (`apiKey` + region-scoped `baseUrl`) and the same `Authorization: Bearer` transport. The in-package model registry SHALL register `happyhorse-1.1-t2v` (t2v), `happyhorse-1.1-i2v` (first-frame i2v, `requiresFirstFrame: true`), `happyhorse-1.1-r2v` (r2v, `maxReferenceImages: 9`), and `happyhorse-1.0-video-edit` (video-edit, `requiresInputVideo: true`, `maxReferenceImages: 5`) with `modality: "video"`, `generate: true`, `edit: false`, `async: true`.

#### Scenario: HappyHorse video models bind with video and async capabilities

- **WHEN** `provider.video("happyhorse-1.1-t2v")`, `provider.video("happyhorse-1.1-i2v")`, `provider.video("happyhorse-1.1-r2v")`, and `provider.video("happyhorse-1.0-video-edit")` are called
- **THEN** each SHALL return a video model instance whose `capabilities.modality` is `"video"` and `capabilities.async` is `true`

