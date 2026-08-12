# aliyun-wan3-video-generation Specification

## Purpose
Provide a typed and validated Alibaba Bailian Wan 3.0 video integration that supports text, frame-constrained, and heterogeneous reference media generation through the model's asynchronous API.
## Requirements
### Requirement: Wan 3.0 is registered as a distinct asynchronous video model

The Alibaba provider SHALL expose `wan3.0-video` as a video model with asynchronous generation capability and family `wan3-video`, separate from the existing Wan image and HappyHorse video families. Binding the model SHALL preserve the provider id and SHALL reject unknown or non-video model ids before transport dispatch.

#### Scenario: Wan 3.0 model is discoverable

- **WHEN** a caller lists Alibaba models or binds `provider.video("wan3.0-video")`
- **THEN** the result SHALL identify `wan3.0-video` as an asynchronous video model

#### Scenario: Wan 3.0 is not treated as a Wan image model

- **WHEN** a caller attempts to bind `provider.image("wan3.0-video")`
- **THEN** the provider SHALL reject the request with `INVALID_REQUEST` and SHALL not send a network request

### Requirement: Wan 3.0 accepts text and ordered heterogeneous media inputs

The provider SHALL submit a Wan 3.0 request when `input.prompt` or `input.media` is present. Each media entry SHALL preserve caller order and SHALL support `first_frame`, `last_frame`, `reference_image`, `reference_video`, `reference_audio`, `file`, or `link` with a public `http`/`https` URL, an `oss://` URL, or a supported image data URI. Image media SHALL support JPEG/JPG/PNG/BMP/WEBP subject to the provider's documented dimensions, aspect-ratio, transparency, and size limits. Video media SHALL support MP4/MOV, audio media SHALL support WAV/MP3, and file media SHALL support the documented office/document formats and size/page limits. Base64 data URIs SHALL be accepted only for image media. In reference mode, image and video references SHALL retain independent one-based numbering for prompt references such as `图1` and `视频1`.

#### Scenario: Text-to-video omits media

- **WHEN** a caller submits a prompt without media
- **THEN** the provider SHALL send `input.prompt` and SHALL omit `input.media`

#### Scenario: Mixed reference media preserves order

- **WHEN** a caller submits image, video, audio, file, and link media in a specific order
- **THEN** the provider SHALL send the corresponding `input.media` entries in exactly that order with their documented media types

#### Scenario: Reference prompt numbering is modality-specific

- **WHEN** a caller submits two reference images followed by two reference videos and uses `图1`, `图2`, `视频1`, and `视频2` in the prompt
- **THEN** the provider SHALL preserve media order and the documented independent image/video numbering semantics

#### Scenario: Base64 image media is mapped to a data URI

- **WHEN** a caller submits a supported image media entry with base64 content
- **THEN** the provider SHALL send a `data:{mime};base64,{data}` URL and SHALL reject base64 content for video, audio, file, or link media

#### Scenario: OSS media enables resource resolution

- **WHEN** any Wan 3.0 media entry uses an `oss://` URL
- **THEN** the provider SHALL include `X-DashScope-OssResourceResolve: enable` in the submit request

#### Scenario: Unsupported media content is rejected

- **WHEN** a caller submits a non-image base64 value or a media URL/file format outside the documented Wan 3.0 formats
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Media-only generation is accepted

- **WHEN** a caller submits valid media without a prompt
- **THEN** the provider SHALL submit the task without rejecting the missing prompt

### Requirement: Wan 3.0 enforces media mode exclusivity and limits

The provider SHALL reject invalid media combinations before transport dispatch. `first_frame` and `last_frame` entries SHALL be mutually exclusive with all `reference_*`, `file`, and `link` entries; `file` and `link` SHALL be mutually exclusive. The provider SHALL enforce at most one first frame, one last frame, one file, one link, ten reference images, five reference videos, and five reference audio entries. Each reference video SHALL be 1-15 seconds and reference videos SHALL total no more than 15 seconds; each reference audio SHALL be 1-15 seconds and reference audio SHALL total no more than 15 seconds when caller-supplied duration metadata is available. The SDK SHALL not download remote media solely to discover metadata; provider-side validation remains authoritative when metadata is unavailable.

#### Scenario: First and last frame are accepted together

- **WHEN** a caller submits exactly one `first_frame` and one `last_frame` without reference, file, or link media
- **THEN** the provider SHALL submit both entries in their supplied order

#### Scenario: Frame and reference modes are rejected together

- **WHEN** a caller submits `first_frame` or `last_frame` together with any `reference_*`, `file`, or `link` entry
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: File and link are rejected together

- **WHEN** a caller submits both a `file` and a `link`
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Reference image limit is enforced

- **WHEN** a caller submits 11 `reference_image` entries
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Reference video limit is enforced

- **WHEN** a caller submits 6 `reference_video` entries
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Reference audio limit is enforced

- **WHEN** a caller submits 6 `reference_audio` entries
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

### Requirement: Wan 3.0 forwards and validates generation parameters

The provider SHALL support `resolution` values `480P`, `720P`, and `1080P` with `1080P` as the default; `ratio` values `adaptive`, `16:9`, `4:3`, `1:1`, `3:4`, and `9:16` with `adaptive` as the default; integer `duration` values from 2 through 30 or `-1`; boolean `audio` with default `true`; boolean `watermark` with default `false`; and integer `seed` values from 0 through 2147483647. When reference videos are supplied, input video duration plus output duration SHALL NOT exceed 30 seconds when caller-supplied duration metadata is available. Supplied values outside these ranges SHALL be rejected before transport dispatch.

#### Scenario: Wan 3.0 parameters are forwarded

- **WHEN** a caller supplies valid resolution, ratio, duration, audio, seed, and watermark values
- **THEN** the provider SHALL forward them under the request `parameters` object unchanged

#### Scenario: Wan 3.0 uses documented defaults

- **WHEN** a caller omits resolution, ratio, audio, and watermark
- **THEN** the generated request SHALL preserve the documented effective defaults of `1080P`, `adaptive`, `true`, and `false` without forwarding HappyHorse's `audio_setting`

#### Scenario: Invalid duration is rejected

- **WHEN** a caller supplies a duration below 2, above 30, or other than `-1` as the smart-duration sentinel
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

#### Scenario: Video input duration leaves room for output

- **WHEN** caller-supplied reference video metadata totals 28 seconds and the requested output duration is 3 seconds
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request because the combined duration exceeds 30 seconds

#### Scenario: Invalid seed is rejected

- **WHEN** a caller supplies a seed outside the inclusive range 0 through 2147483647 or a non-integer seed
- **THEN** the provider SHALL return `INVALID_REQUEST` before sending a request

### Requirement: Wan 3.0 uses the shared asynchronous task lifecycle

The provider SHALL submit Wan 3.0 tasks to the configured regional video-synthesis endpoint with `Authorization: Bearer {apiKey}`, `Content-Type: application/json`, and `X-DashScope-Async: enable`. It SHALL poll the returned task ID through the shared task endpoint, map successful `output.video_url` to `VideoContent[]`, and sanitize API keys from errors.

#### Scenario: Successful task returns normalized video content

- **WHEN** submission returns a task ID and polling reaches `SUCCEEDED` with `output.video_url`
- **THEN** the task handle SHALL resolve with one video result containing that URL and the provider/model metadata

#### Scenario: Provider failure does not leak credentials

- **WHEN** submission or polling returns an authentication or provider error containing the API key
- **THEN** the SDK SHALL return a stable SDK error without exposing the API key in its message or cause

