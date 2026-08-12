## Why

MiniMax (Hailuo) ships the MiniMax-H3 video model through an asynchronous V2 API (`POST /v2/video_generation` + `GET /v2/query/video_generation/{task_id}`) that supports text-to-video, first/last-frame image-to-video, and reference-to-video with reference images, videos, and audio. The SDK has no MiniMax provider, and its video input contract cannot express last-frame images or reference video/audio media, which blocks any provider implementing these modes ergonomically.

## What Changes

- Add a `packages/provider-minimax` package (`@ai-media/provider-minimax`) implementing the MiniMax V2 video generation API with native `fetch`-based transport, no provider SDK dependency.
- Register `MiniMax-H3` as an asynchronous video model with `768P`/`2K` resolutions and the documented aspect-ratio set.
- Extend the core `VideoGenerationInput` contract with provider-agnostic optional fields: `lastFrame` (i2v last-frame image), `referenceVideos`, and `referenceAudios` (URL entries with optional duration metadata).
- Map SDK inputs to the MiniMax multimodal `content[]` array (text / image_url / video_url / audio_url with roles) covering t2v, i2v first frame, i2v first & last frame, and r2v scenarios.
- Validate MiniMax input rules before transport: non-empty prompt, i2v/r2v mutual exclusivity, `lastFrame` pairing, media count limits (9 reference images, 3 reference videos, 3 reference audios), per-scenario `ratio` rules, `duration` 4-15, resolution allowlist, and caller-supplied reference duration limits.
- Reuse the shared async task lifecycle: submit returns `task_id`, `createTaskHandle` polls the query endpoint, maps `queued/running/succeeded/failed/cancelled` statuses, extracts `content.url`, and classifies OpenAI-style error bodies with credential redaction.
- Add `examples/minimax-video` runnable example with environment configuration and result persistence.
- Add the package to release tooling (`scripts/release-check.ts`) and workspace env forwarding (`turbo.json`).
- Playground integration (`apps/web`, `apps/site`) and the MiniMax task cancel/delete endpoint are excluded and remain follow-up changes.

## Capabilities

### New Capabilities

- `minimax-video-generation`: Generate MiniMax-H3 videos through the asynchronous V2 API with all documented input scenarios, validation rules, status polling, result mapping, and error classification.

### Modified Capabilities

- `sdk-package-foundation`: Extend the `submitVideoTask` video input contract to carry optional `lastFrame`, `referenceVideos`, and `referenceAudios` fields while preserving existing fields and adapter-authoritative validation.

## Impact

- `packages/ai-media-sdk`: additive `VideoGenerationInput` fields, new reference media types, root exports, docs.
- `packages/provider-minimax`: new workspace package (config, registry, typed params, adapter, tests).
- `examples/minimax-video`: new runnable example.
- `turbo.json`, `scripts/release-check.ts`, root and SDK README provider lists.
- No new runtime dependency; native `fetch` via the shared transport only.
- No breaking changes to existing providers or entry points.
