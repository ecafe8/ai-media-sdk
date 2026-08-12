## Purpose

Provide a typed and validated MiniMax (Hailuo) video integration that generates MiniMax-H3 videos through the asynchronous V2 API, covering text-to-video, first/last-frame image-to-video, and reference-to-video with reference images, videos, and audio.

## ADDED Requirements

### Requirement: MiniMax-H3 is registered as an asynchronous video model

The MiniMax provider SHALL expose `MiniMax-H3` as a video model with asynchronous generation capability under the provider id `minimax`. The provider SHALL expose a `video(modelId)` binding that rejects unknown model ids with `UNKNOWN_MODEL` before transport dispatch. The provider SHALL NOT offer image binding or synchronous generation/editing; synchronous entry points for MiniMax models SHALL fail with `NOT_IMPLEMENTED`.

#### Scenario: MiniMax-H3 model is discoverable

- **WHEN** a caller lists MiniMax models or binds `provider.video("MiniMax-H3")`
- **THEN** the result SHALL identify `MiniMax-H3` as an asynchronous video model

#### Scenario: Unknown model id is rejected

- **WHEN** a caller binds `provider.video` with an id that is not registered
- **THEN** the provider SHALL throw an `SdkError` with code `UNKNOWN_MODEL` and SHALL not send a network request

#### Scenario: Synchronous entry points are not implemented

- **WHEN** a caller invokes synchronous generation or editing through the MiniMax adapter
- **THEN** the provider SHALL fail with `NOT_IMPLEMENTED`

### Requirement: MiniMax configuration uses a typed boundary with a default base URL

The provider factory SHALL accept a typed configuration carrying a required API key and an optional base URL. The base URL SHALL default to `https://api.minimax.io` and trailing slashes SHALL be normalized. Requests SHALL authenticate with `Authorization: Bearer {apiKey}`.

#### Scenario: Default base URL is applied

- **WHEN** a provider is created without an explicit base URL
- **THEN** submit and query requests SHALL target `https://api.minimax.io` endpoints

#### Scenario: Custom base URL is honored

- **WHEN** a provider is created with a custom base URL including trailing slashes
- **THEN** request URLs SHALL use the custom base without duplicated slashes

### Requirement: MiniMax accepts text-to-video, image-to-video, and reference-to-video inputs

The provider SHALL map SDK video inputs to the MiniMax multimodal `content[]` array. Every request SHALL include exactly one non-empty `text` item carrying the prompt. A `firstFrame` image SHALL map to an `image_url` item with role `first_frame`; a `lastFrame` image SHALL map to an `image_url` item with role `last_frame`; ordered `referenceImages` SHALL map to `image_url` items with role `reference_image`; ordered `referenceVideos` SHALL map to `video_url` items with role `reference_video`; ordered `referenceAudios` SHALL map to `audio_url` items with role `reference_audio`. Image items with base64 content and a MIME type SHALL be serialized as `data:{mime};base64,{data}` URLs; reference video and audio items SHALL carry public URLs only.

#### Scenario: Text-to-video sends a single text item

- **WHEN** a caller submits a prompt without any media
- **THEN** the provider SHALL send `content` containing only the `text` item

#### Scenario: First-frame image-to-video maps the first frame

- **WHEN** a caller submits a prompt with a `firstFrame` image URL
- **THEN** the provider SHALL send the text item plus one `image_url` item with role `first_frame`

#### Scenario: First and last frame are sent together

- **WHEN** a caller submits a prompt with both `firstFrame` and `lastFrame` images
- **THEN** the provider SHALL send one `image_url` item with role `first_frame` and one with role `last_frame`

#### Scenario: Mixed reference media preserves order and roles

- **WHEN** a caller submits reference images, reference videos, and reference audios
- **THEN** the provider SHALL send `image_url`/`video_url`/`audio_url` items with the corresponding reference roles preserving caller order within each media kind

#### Scenario: Base64 image is mapped to a data URI

- **WHEN** a caller submits a frame or reference image with base64 content and MIME type
- **THEN** the provider SHALL send a `data:{mime};base64,{data}` URL for that item

#### Scenario: Empty prompt is rejected

- **WHEN** a caller submits a request with a missing or empty prompt
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

### Requirement: MiniMax enforces scenario exclusivity and media limits

The provider SHALL reject invalid input combinations before transport dispatch. Image-to-video inputs (`firstFrame`/`lastFrame`) SHALL be mutually exclusive with reference inputs (`referenceImages`/`referenceVideos`/`referenceAudios`). A `lastFrame` SHALL require a `firstFrame`. The provider SHALL enforce at most one first frame, one last frame, nine reference images, three reference videos, and three reference audios. Each reference video or audio SHALL be 2-15 seconds and SHALL total no more than 15 seconds when caller-supplied duration metadata is available. Reference video and audio entries SHALL require a URL. The SDK SHALL NOT download remote media solely to discover metadata; provider-side validation remains authoritative when metadata is unavailable.

#### Scenario: Frame and reference modes are rejected together

- **WHEN** a caller submits `firstFrame` or `lastFrame` together with any reference image, video, or audio
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Last frame without first frame is rejected

- **WHEN** a caller submits a `lastFrame` without a `firstFrame`
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Reference count limits are enforced

- **WHEN** a caller submits more than nine reference images, more than three reference videos, or more than three reference audios
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Reference duration limits are enforced from metadata

- **WHEN** a caller submits reference videos or audios whose caller-supplied durations exceed 15 seconds individually or in total
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Reference media without URL is rejected

- **WHEN** a caller submits a reference video or audio entry without a URL
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

### Requirement: MiniMax validates and forwards native video parameters

The provider SHALL require `resolution` and `duration` under `providerOptions.minimax`, accepting `768P`/`2K` resolutions and integer durations 4-15, and SHALL reject other values with `INVALID_REQUEST` before transport. The `ratio` parameter SHALL follow per-scenario rules: text-to-video SHALL require a ratio and SHALL reject `adaptive`; image-to-video SHALL always send `adaptive`; reference-to-video SHALL default to `adaptive` and MAY accept any documented ratio (`adaptive`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`). An optional `callbackUrl` SHALL be forwarded when supplied.

#### Scenario: Text-to-video requires a concrete ratio

- **WHEN** a caller submits text-to-video without a ratio or with `adaptive`
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Image-to-video always uses adaptive ratio

- **WHEN** a caller submits an image-to-video request with any ratio value
- **THEN** the provider SHALL send `adaptive` as the ratio

#### Scenario: Reference-to-video defaults to adaptive

- **WHEN** a caller submits a reference-to-video request without a ratio
- **THEN** the provider SHALL send `adaptive` as the ratio

#### Scenario: Resolution and duration are validated

- **WHEN** a caller submits a resolution outside `768P`/`2K` or a duration outside 4-15
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

### Requirement: MiniMax submission and polling follow the shared async lifecycle

The provider SHALL submit tasks to `POST /v2/video_generation`, extract `task_id` from the response, and return a task handle whose poll closure queries `GET /v2/query/video_generation/{task_id}`. Provider statuses SHALL map to core statuses: `queued` to `pending`, `running` to `running`, `succeeded` to `succeeded`, `failed` to `failed`, `cancelled` to `cancelled`. On success the provider SHALL build the video result from `task.content.url` with `task.duration` metadata and expose billed usage as the raw result payload; a succeeded task without a video URL SHALL fail as `PROVIDER_ERROR`. A missing `task_id` in the submit response SHALL fail as `PROVIDER_ERROR`.

#### Scenario: Successful task resolves to a video URL

- **WHEN** the query endpoint reports `succeeded` with a `content.url`
- **THEN** the task handle SHALL resolve with a video content entry carrying that URL and the task duration

#### Scenario: Failed task surfaces the provider error message

- **WHEN** the query endpoint reports `failed` with an error code and message
- **THEN** the task handle SHALL fail with a `PROVIDER_ERROR` carrying the provider message

#### Scenario: Queued and running statuses keep polling

- **WHEN** the query endpoint reports `queued` or `running`
- **THEN** the poll SHALL report the mapped non-terminal status without a result

#### Scenario: Missing task id is a provider error

- **WHEN** the submit endpoint responds successfully without a `task_id`
- **THEN** the provider SHALL throw a `PROVIDER_ERROR`

### Requirement: MiniMax errors are classified and credentials are redacted

The provider SHALL parse OpenAI-style error bodies (`type: "error"` with `error.type`, `error.message`, `error.http_code`) and classify non-2xx responses: authentication failures to `AUTH_ERROR`, rate limits to `RATE_LIMITED`, invalid-parameter and sensitive-content rejections to `INVALID_REQUEST`, server errors to `PROVIDER_ERROR`, and insufficient-balance responses (HTTP 402) to `PROVIDER_ERROR` with the provider message. Transport-level failures SHALL map to `TIMEOUT`/`NETWORK_ERROR`. Every surfaced provider message SHALL have the configured API key redacted.

#### Scenario: Authentication failure is classified

- **WHEN** the provider API responds with HTTP 401
- **THEN** the provider SHALL raise a non-retryable `AUTH_ERROR`

#### Scenario: Rate limit is classified retryable

- **WHEN** the provider API responds with HTTP 429
- **THEN** the provider SHALL raise a retryable `RATE_LIMITED` error

#### Scenario: Insufficient balance is classified

- **WHEN** the provider API responds with HTTP 402
- **THEN** the provider SHALL raise a non-retryable `PROVIDER_ERROR` carrying the provider message

#### Scenario: API key never appears in error messages

- **WHEN** a provider error message contains the configured API key
- **THEN** the surfaced message SHALL replace the key with a redaction marker
