## 1. Core Video Contract

- [x] 1.1 Extend `VideoGenerationInput` and `VideoGenerationRequest` with optional ordered `referenceImages` and `inputVideo` fields, modeling `inputVideo` as `{ readonly url: string }`, preserving existing t2v/i2v callers.
- [x] 1.2 Keep core `submitVideoTask` validation to `async` capability and `video` modality only; remove the core-only empty-prompt rejection so model-specific prompt/media rules are delegated to the adapter.
- [x] 1.3 Add core async contract tests for t2v/i2v dispatch, r2v dispatch, video-edit dispatch, non-async model rejection, non-video modality rejection, and i2v with an empty prompt dispatching.

## 2. Aliyun HappyHorse Adapter

- [x] 2.1 Extend `AliyunModelEntry` with provider-private media requirements and register `happyhorse-1.1-r2v` (`maxReferenceImages: 9`) and `happyhorse-1.0-video-edit` (`requiresInputVideo: true`, `maxReferenceImages: 5`) as async video models.
- [x] 2.2 Implement the adapter as the sole validator of model-specific rules: media presence/exclusivity, reference-image counts, prompt requirement (required for t2v/r2v/video-edit, optional for i2v), and `inputVideo` `http:`/`https:` URL validation, all returning `INVALID_REQUEST` before transport.
- [x] 2.3 Extend the Aliyun video input guard and body builder for ordered r2v `reference_image` media, preserving `[Image N]` order and existing image URL/base64 mapping.
- [x] 2.4 Extend the Aliyun video body builder for video-edit media with the source `video` entry first and 0-5 following `reference_image` entries.
- [x] 2.5 Add the video-edit parameter allowlist for `resolution`, `watermark`, `seed`, and `audio_setting`; omit `ratio` and `duration` for video-edit while preserving existing t2v/i2v behavior. Validate `audio_setting` (`"auto"`/`"origin"`), `resolution` tiers, and `duration`/`seed` ranges before transport.
- [x] 2.6 Add Aliyun adapter contract tests for model binding, r2v/video-edit request bodies, media ordering, base64 image mapping, parameter omission, and pre-transport validation (missing media, excessive references, incompatible media, non-HTTP input video URL, empty prompt for r2v/video-edit, invalid `audio_setting`/`resolution`).
- [x] 2.7 Add async result and error tests for r2v/video-edit covering `PENDING` → `RUNNING` → `SUCCEEDED`, `video_url` mapping, success with missing `video_url`, submit response missing `task_id`, failed/canceled/unknown tasks, HTTP classification, timeout, and API-key redaction.

## 3. Playground and Example Integration

- [x] 3.1 Register HappyHorse r2v and video-edit models in the Playground capability registry with their media requirements and supported parameters; keep Wan video models unavailable.
- [x] 3.2 Extend the Playground form and server request mapping with ordered reference-image URL inputs for r2v and source-video/reference-image URL inputs for video-edit, including accessible validation, no duplicate submission, and sanitized error presentation.
- [x] 3.3 Extend the Aliyun video example configuration and invocation path to demonstrate r2v and video-edit requests without making them part of default offline tests; define example inputs (model, source-video URL, reference-image URLs, `[Image N]` prompt) via environment variables or CLI arguments.
- [x] 3.4 Add offline example and Playground tests for configuration, model capability registration, valid media request construction, invalid input rejection, and sanitized error output.

## 4. Documentation and Verification

- [x] 4.1 Update README/example usage documentation with r2v and video-edit commands, media limits, `[Image N]` ordering, public `http:`/`https:` source-video URL requirements, the absence of `ratio`/`duration` for video-edit, `audio_setting` values, and 24-hour task/result URL expiry.
- [x] 4.2 Run repository formatting for all changed files and inspect the complete diff for accidental scope expansion or credential exposure.
- [x] 4.3 Run `bun run lint` and resolve only errors introduced by this change.
- [x] 4.4 Run `bun run typecheck` across the core, Aliyun provider, example, and web workspaces.
- [x] 4.5 Run `bun run test` and verify all new tests pass without Provider credentials or external network access.
- [x] 4.6 Run `bun run build` and confirm the Playground bundle contains no Provider credentials or server-only construction imports.