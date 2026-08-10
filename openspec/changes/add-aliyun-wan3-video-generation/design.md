## Context

The SDK already has a provider-independent asynchronous video task lifecycle. The Alibaba provider currently maps a fixed set of HappyHorse modes from `firstFrame`, `referenceImages`, and `inputVideo`; those fields cannot represent Wan 3.0's ordered heterogeneous `input.media` array. Existing Wan image entries also share short, ambiguous capability constant names with no video distinction.

## Goals / Non-Goals

**Goals:**

- Represent Wan 3.0 media inputs without weakening the existing HappyHorse type contract.
- Preserve one shared asynchronous submission and polling implementation where the wire protocol is identical.
- Keep provider-specific Wan 3.0 validation and parameter typing close to the Alibaba registry.
- Make model capability constants unambiguous across Wan image and video versions.
- Cover request serialization, validation, polling, errors, and public exports with tests.

**Non-Goals:**

- Do not change the Alibaba endpoint, authentication model, or task persistence behavior.
- Do not redesign the existing HappyHorse input contract.
- Do not add Playground controls or browser-side media upload handling.
- Do not add a runtime Alibaba SDK dependency.

## Decisions

### Use a typed ordered media list for Wan 3.0

Extend the provider-independent video input with an optional ordered media collection whose entries carry a discriminated media type and URL/content value. Wan 3.0-specific request params require this shape through the provider's model overload. This is preferred over adding more top-level fields because the API's ordering and independent image/video/audio counters are observable semantics.

The existing `firstFrame`, `referenceImages`, and `inputVideo` fields remain available for HappyHorse compatibility. The Wan 3.0 adapter consumes the new media list and does not infer one mode from unrelated legacy fields.

### Separate the registry family and capability constants

Add a dedicated Wan 3.0 video family and registry metadata rather than treating it as `happyhorse-video` or `wan-image`. Rename image constants to `WAN2_6_T2I_GENERATE_CAPABILITY`, `WAN2_7_IMAGE_GENERATE_CAPABILITY`, and `WAN2_7_IMAGE_PRO_GENERATE_CAPABILITY`; name the new video capability `WAN3_0_VIDEO_GENERATE_CAPABILITY`. Underscore-separated version segments avoid ambiguity as model versions grow.

### Validate before transport and serialize the API media array directly

Wan 3.0 validation will reject invalid combinations before any request is sent. It will enforce the documented mutual exclusion between frame inputs and reference/file/link inputs, the file/link mutual exclusion, media count limits, supported URL or data content forms, duration and parameter ranges, and the requirement that at least one of prompt or media is present. The request body will preserve the caller's media order and emit `input.media` entries with the documented provider type names.

### Reuse the shared async task lifecycle

Wan 3.0 submission will use the existing video-synthesis endpoint, async header, task ID extraction, `/tasks/{task_id}` polling, status mapping, sanitized provider errors, and `video_url` result mapping. Only body construction and model-specific validation differ. This avoids a second task abstraction and keeps result behavior consistent.

### Keep Playground integration separate

The current Playground request schema cannot carry arbitrary audio, file, link, or mixed media entries. Extending it requires a separate product/UI contract and upload strategy, so this change exposes SDK/provider functionality only.

## Risks / Trade-offs

- [Risk] Provider documentation may add media constraints during the invite-only period. → Keep validation metadata and media rules isolated in the Wan 3.0 family so updates do not affect HappyHorse.
- [Risk] Remote media URLs and generated video URLs are temporary. → Preserve the existing URL result contract and document persistence as the caller's responsibility; do not add storage to the SDK.
- [Risk] Adding a generic media type to the core can broaden the public contract. → Use a discriminated, readonly shape and retain legacy fields unchanged; add focused type tests for model overloads.
- [Risk] Renaming internal constants can break deep imports. → These constants are provider implementation details; update all in-repository references and preserve exported registry behavior rather than adding aliases.

## Migration Plan

1. Add the new core media type and Wan 3.0 provider family behind tests.
2. Rename existing capability constants and update registry references.
3. Add `wan3.0-video` to the Alibaba registry and public type exports.
4. Run focused tests followed by repository lint, typecheck, build, and test commands.
5. Release the provider package with the new model available; existing model IDs and HappyHorse request fields remain unchanged.

## Open Questions

None.
