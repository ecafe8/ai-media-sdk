# aliyun-happyhorse-video-r2v-edit Specification

## Purpose
Provide reference-to-video and source-video editing through Aliyun HappyHorse while preserving the existing asynchronous task and normalized video result contract.

## Requirements
### Requirement: HappyHorse r2v submits ordered reference images

The provider SHALL submit `happyhorse-1.1-r2v` requests to the existing asynchronous video-synthesis contract with one to nine ordered `reference_image` media entries, preserving prompt `[Image N]` ordering and mapping successful `output.video_url` responses to `VideoContent[]`.

#### Scenario: r2v preserves reference image order

- **WHEN** a caller submits three reference images and a prompt containing `[Image 1]`, `[Image 2]`, and `[Image 3]`
- **THEN** the provider SHALL send three `reference_image` entries in the same order and return a task handle

#### Scenario: r2v rejects an invalid reference image count

- **WHEN** a caller submits zero or more than nine reference images
- **THEN** the request SHALL fail with `INVALID_REQUEST` before any provider request is sent

### Requirement: HappyHorse video-edit submits source video and optional references

The provider SHALL submit `happyhorse-1.0-video-edit` requests with exactly one public source video URL followed by zero to five optional `reference_image` entries. It SHALL support `resolution`, `watermark`, `seed`, and `audio_setting`, and SHALL omit `ratio` and `duration`.

#### Scenario: video-edit sends source video before references

- **WHEN** a caller submits a source video URL and two reference images
- **THEN** the provider SHALL send one `video` media entry first followed by two `reference_image` entries

#### Scenario: video-edit forwards audio preservation

- **WHEN** `audio_setting` is `origin`
- **THEN** the provider SHALL send `parameters.audio_setting` as `origin`

#### Scenario: video-edit rejects a missing source video

- **WHEN** a caller omits the source video URL
- **THEN** the request SHALL fail with `INVALID_REQUEST` before any provider request is sent

#### Scenario: video-edit rejects a non-HTTP source video URL

- **WHEN** a caller supplies a source video URL that is missing, empty, or uses a non-`http:`/`https:` protocol
- **THEN** the request SHALL fail with `INVALID_REQUEST` before any provider request is sent

### Requirement: HappyHorse prompt requirement is per mode

The provider SHALL require a non-empty `prompt` for `happyhorse-1.1-r2v` and `happyhorse-1.0-video-edit`, and SHALL allow an empty `prompt` for `happyhorse-1.1-i2v` (first-frame image-to-video), matching the provider contract.

#### Scenario: r2v rejects an empty prompt

- **WHEN** a caller submits an r2v request with an empty prompt
- **THEN** the request SHALL fail with `INVALID_REQUEST` before any provider request is sent

#### Scenario: video-edit rejects an empty prompt

- **WHEN** a caller submits a video-edit request with an empty prompt
- **THEN** the request SHALL fail with `INVALID_REQUEST` before any provider request is sent

#### Scenario: i2v accepts an empty prompt

- **WHEN** a caller submits an i2v request with an empty prompt and one first frame
- **THEN** the request SHALL proceed and not fail on prompt presence

### Requirement: HappyHorse extended video tasks use the shared async lifecycle

The r2v and video-edit modes SHALL use the existing async submission header, task polling endpoint, status mapping, error classification, and `output.video_url` result mapping. They SHALL not introduce a runtime provider SDK or persistent task storage.

#### Scenario: Extended video task reaches success

- **WHEN** polling returns `PENDING`, then `RUNNING`, then `SUCCEEDED` with `output.video_url`
- **THEN** `TaskHandle.wait()` SHALL resolve with one `VideoContent` carrying the URL and the provider request ID

#### Scenario: Extended video task failure is sanitized

- **WHEN** submission or polling returns an authentication, rate-limit, timeout, or provider failure
- **THEN** the SDK SHALL return the corresponding stable error code without exposing the API key
