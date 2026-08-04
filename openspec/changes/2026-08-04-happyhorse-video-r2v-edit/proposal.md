## Why

Phase 4 provides a working HappyHorse t2v/i2v path, but the current video contract cannot express reference-image video generation or editing an existing video. The official HappyHorse contracts for r2v and video-edit are now available, and both reuse the existing video-synthesis endpoint and task polling, so this is the smallest next slice that materially expands video capability without introducing a new async architecture.

## What Changes

- Extend the public video request/input contract with optional `referenceImages` and `inputVideo` fields while keeping `submitVideoTask` as the single entry point.
- Add Aliyun registry entries and capability metadata for `happyhorse-1.1-r2v` and `happyhorse-1.0-video-edit`.
- Add r2v request mapping: 1-9 ordered `reference_image` media entries and t2v-compatible video parameters.
- Add video-edit request mapping: one public video URL followed by 0-5 `reference_image` entries, plus `audio_setting`; omit unsupported `ratio` and `duration` fields.
- Gate incompatible media combinations and media counts before transport dispatch with `INVALID_REQUEST`.
- Preserve the existing shared HappyHorse submission, polling, result mapping, transport, and error-classification behavior for t2v/i2v.
- Add fake-transport contract coverage for request bodies, media ordering, capability gating, polling results, and HTTP/transport failures.
- Register the supported modes in the Playground and extend the Aliyun video example without adding real-network calls to default tests.
- Keep Wan video and `animate-*` models out of scope because the available material is stale.

## Capabilities

### New Capabilities

- `aliyun-happyhorse-video-r2v-edit`: Aliyun HappyHorse reference-to-video and source-video editing through the existing asynchronous task contract.

### Modified Capabilities

- `sdk-package-foundation`: Extend video request/input contracts and require media-combination validation for the unified `submitVideoTask` entry point.
- `aliyun-video-generation`: Add r2v and video-edit model registration, media mappings, native parameter rules, and capability gating.
- `provider-package-foundation`: Extend the Aliyun video adapter while retaining the shared transport, task polling, and error classification boundaries.
- `playground-form`: Expose the new video modes and their required media inputs without changing the existing image flow.
- `sdk-usage-docs`: Document r2v and video-edit invocation, media constraints, and provider-specific options.

## Impact

- Core package: `packages/ai-media-sdk/src/video/request.ts`, `submit.ts`, exports, and core async contract tests.
- Aliyun provider: `packages/provider-aliyun-bailian/src/provider/registry.ts`, `index.ts`, and video adapter contract tests.
- Web Playground: video model registry, request validation/form controls, server request mapping, result presentation, and related tests.
- Example workspace: `examples/aliyun-video/` configuration, invocation, and offline tests.
- OpenSpec delta specs and implementation documentation under `openspec/changes/2026-08-04-happyhorse-video-r2v-edit/`.
- No new runtime dependency, external SDK, persistent task store, webhook, or real-network CI test.
