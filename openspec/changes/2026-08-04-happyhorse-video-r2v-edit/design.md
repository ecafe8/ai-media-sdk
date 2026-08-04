## Context

Phase 4 already provides a modality-neutral async task contract and an Aliyun HappyHorse adapter for t2v and first-frame i2v. The new official contracts use the same `video-synthesis` submission endpoint, `/tasks/{task_id}` polling endpoint, status mapping, and `output.video_url` result shape. The remaining differences are the public media inputs and the native parameter allowlist for each model.

The implementation must preserve existing t2v/i2v behavior, avoid adding a provider SDK, and keep the source video as a caller-supplied public URL. See `docs/prd/sub-video-generation/tech.md` for the complete provider contract and media limits.

## Goals / Non-Goals

**Goals:**

- Add r2v and video-edit to the existing unified `submitVideoTask` flow.
- Validate model-specific media presence, exclusivity, and count before transport dispatch.
- Map r2v and video-edit requests to the exact ordered DashScope media shapes.
- Keep polling, result mapping, error classification, and credential redaction shared with existing video paths.
- Make both modes testable without credentials or external network access.

**Non-Goals:**

- Wan video, `animate-*`, streaming, webhook callbacks, task persistence, or task cancellation.
- Local media inspection, transcoding, uploading, or SSRF-safe URL fetching.
- A second public video-edit entry point; all modes use `submitVideoTask`.

## Decisions

### D1: Extend the existing video input instead of adding a second API

Add optional `referenceImages` and `inputVideo` fields to `VideoGenerationInput` and `VideoGenerationRequest`. Keep `firstFrame` for i2v. The core entry remains `submitVideoTask` and creates the same modality-neutral adapter request.

This keeps the public task lifecycle stable and reflects that all four modes share one provider operation. A separate `submitVideoEditTask` would duplicate task semantics and still require a reference-image extension for r2v.

### D2: Keep media requirements in the Aliyun registry

Extend the provider-private `AliyunModelEntry` with `requiresInputVideo?: boolean` and `maxReferenceImages?: number`, alongside the existing `requiresFirstFrame`. Do not add provider-specific media fields to the core `ModelCapability` yet.

The core validates the generic modality and delegates provider/model-specific media rules to the bound adapter or a provider capability guard. This preserves the core package's provider-neutral contract while making the rules explicit and testable in the Aliyun registry.

### D3: Build media in deterministic provider order

- t2v: no `input.media`.
- i2v: one `{ type: "first_frame", url }`.
- r2v: `referenceImages` mapped in input order to `{ type: "reference_image", url }`.
- video-edit: `{ type: "video", url }` first, followed by reference images.

Image URL/base64 mapping reuses the existing image conversion helper. The source video accepts only a public URL string; the SDK does not upload or transform local video data.

### D4: Use per-mode parameter allowlists

Continue reading native fields from `providerOptions.aliyun`. r2v uses the t2v allowlist. Video-edit forwards only `resolution`, `watermark`, `seed`, and `audio_setting`; it deliberately drops `ratio` and `duration` because the provider derives them from the source video.

The adapter should not silently forward unsupported fields. Existing callers remain compatible because the new request fields are optional and existing t2v/i2v option handling is preserved.

### D5: Reuse shared task handling and errors

The adapter keeps the existing `getTask`, `mapTaskStatus`, `createTaskHandle`, transport error mapping, and sanitized task failure messages. New modes only select different request-body construction before creating the same task handle.

This avoids a second polling implementation and ensures `PENDING`/`RUNNING`/terminal states, 24-hour task/result TTL guidance, and stable error codes remain consistent.

### D6: Add Playground support only for URL-based inputs

The Playground will expose URL fields for r2v references and the video-edit source video/references. It will not upload files or perform local media validation in this slice. The server route will translate the form data into the extended SDK request and keep existing image behavior unchanged.

## Risks / Trade-offs

- **Provider limits are not locally measurable** → Validate structure and counts locally; document and rely on provider validation for codec, duration, dimensions, size, and frame rate.
- **Prompt `[Image N]` references can be semantically wrong** → Preserve reference order exactly and document the convention; do not attempt prompt parsing.
- **A public video URL may expire or be inaccessible** → Return the provider's classified request/task error; do not fetch or persist the media in the SDK.
- **Optional fields could allow invalid cross-mode combinations** → Add explicit negative contract tests for every incompatible media combination before dispatch.
- **Existing video behavior could regress during refactoring** → Retain t2v/i2v fixtures and run the full lint, typecheck, test, and build sequence.

## Migration Plan

1. Extend core video request types and validation without changing existing required fields.
2. Add provider registry entries and media/parameter builders behind the existing `happyhorse-video` family.
3. Add fake-transport provider/core tests before enabling Playground models.
4. Add example and Playground URL-based flows, then update usage documentation.
5. Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build`.
6. Roll back by removing the new model entries and optional-field handling; existing t2v/i2v and image paths remain usable.

## Open Questions

- Whether a later slice should add local media metadata validation or upload support.
- Whether DashScope task cancellation should be exposed after the r2v/video-edit slice.
