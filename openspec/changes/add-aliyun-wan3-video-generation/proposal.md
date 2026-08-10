## Why

Alibaba Bailian's Wan 3.0 video model exposes one asynchronous API for text-to-video, first/last-frame image-to-video, and rich reference-to-video generation. The SDK currently models HappyHorse video modes with fixed fields and cannot represent Wan 3.0 media types, mode exclusivity, or its 2-30 second output range.

## What Changes

- Add a dedicated Alibaba Wan 3.0 video model entry for `wan3.0-video`.
- Add a Wan 3.0-specific video input contract supporting ordered media entries for first frame, last frame, reference images/videos/audio, files, and links.
- Allow the core video submission contract to carry optional media-only requests while preserving HappyHorse mode-specific typing and validation.
- Validate Wan 3.0 media combinations, media counts, URL/content requirements, duration, resolution, ratio, audio, seed, and watermark before network dispatch.
- Submit Wan 3.0 requests through the existing asynchronous video-synthesis endpoint and shared task polling lifecycle.
- Keep Wan 3.0 video routing and validation separate from the existing HappyHorse video family and Wan image family.
- Rename ambiguous Wan image capability constants to versioned names using underscore separators: `WAN2_6_*`, `WAN2_7_*`, and introduce `WAN3_0_*` names for video capability constants.
- Add provider, SDK contract, registry, and adapter tests for the new behavior.

## Capabilities

### New Capabilities

- `aliyun-wan3-video-generation`: Generate Wan 3.0 videos through the Alibaba Bailian asynchronous API with all documented input modes and validation rules.

### Modified Capabilities

- `aliyun-video-generation`: Extend the Alibaba video adapter contract to route the Wan 3.0 model while preserving the shared asynchronous submission and polling behavior.
- `sdk-package-foundation`: Extend the core `submitVideoTask` contract to pass Wan 3.0 media inputs and support an optional prompt when media-only generation is valid.

## Impact

- `packages/ai-media-sdk`: provider-independent video input types and exports.
- `packages/provider-aliyun-bailian`: Wan 3.0 registry entry, typed parameters, request mapping, validation, and exports.
- Existing Alibaba video tests and new Wan 3.0 focused tests.
- No new runtime dependency or provider SDK.
- Full Playground UI and HTTP request schema support are excluded from this change and can be handled by a follow-up change.
- A minimal Playground registry guard is included so Wan 3.0 is not presented by the existing form before its media input UI exists.
