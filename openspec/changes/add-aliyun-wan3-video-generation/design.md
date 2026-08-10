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

Extend the provider-independent video input with an optional ordered media collection whose entries carry a discriminated media type and URL/content value. The core `prompt` becomes optional because Wan 3.0 accepts media-only requests; HappyHorse family parameter types keep their existing prompt requirements where applicable, and the adapter remains responsible for runtime mode validation. Wan 3.0-specific request params require this shape through the provider's model overload. This is preferred over adding more top-level fields because the API's ordering and independent image/video/audio counters are observable semantics.

The existing `firstFrame`, `referenceImages`, and `inputVideo` fields remain available for HappyHorse compatibility. The Wan 3.0 adapter consumes the new media list and does not infer one mode from unrelated legacy fields.

### Separate the registry family and capability constants

Add a dedicated `wan3-video` family and registry metadata rather than treating it as `happyhorse-video` or `wan-image`. Rename constants with these exact mappings: `WAN26_T2I_GENERATE_CAPABILITY` → `WAN2_6_T2I_GENERATE_CAPABILITY`, `WAN_GENERATE_CAPABILITY` → `WAN2_7_IMAGE_GENERATE_CAPABILITY`, and `WAN_PRO_GENERATE_CAPABILITY` → `WAN2_7_IMAGE_PRO_GENERATE_CAPABILITY`. Name the new video capability `WAN3_0_VIDEO_GENERATE_CAPABILITY`. These capability constants are internal to `registry.ts` and are not package-root exports; the public registry projection remains stable.

### Keep Wan 3.0 options separate from HappyHorse options

Wan 3.0 uses `audio?: boolean`, while HappyHorse video-edit uses `audio_setting?: "auto" | "origin"`. The provider SHALL define a distinct Wan 3.0 options shape and SHALL not reuse `AliyunVideoFamilyOptions` for this field. Wan 3.0 defaults are `resolution: "1080P"`, `ratio: "adaptive"`, `audio: true`, and `watermark: false`; omitted values may remain omitted on the wire when the provider API supplies the same defaults.

### Validate before transport and serialize the API media array directly

Wan 3.0 validation will reject invalid combinations before any request is sent. It will enforce the documented mutual exclusion between frame inputs and reference/file/link inputs, the file/link mutual exclusion, media count limits, supported URL or data content forms, duration and parameter ranges, and the requirement that at least one of prompt or media is present. The SDK will not download remote media to inspect dimensions or duration; optional caller-supplied duration metadata may be validated, while the provider remains authoritative when metadata is unavailable. The request body will preserve caller media order and the documented independent image/video/audio numbering semantics used by prompt references such as `图1` and `视频1`.

### Reuse the shared async task lifecycle

Wan 3.0 submission will use the existing video-synthesis endpoint, async header, task ID extraction, `/tasks/{task_id}` polling, status mapping, sanitized provider errors, OSS URL resolution header, and `video_url` result mapping. The configured regional `baseUrl` continues to support Beijing and Singapore endpoints. Only body construction and model-specific validation differ. This avoids a second task abstraction and keeps result behavior consistent.

### Keep Playground integration separate

The current Playground request schema cannot carry arbitrary audio, file, link, or mixed media entries. This change adds only a registry guard that excludes `wan3.0-video` from the existing form; full UI controls, API fields, and upload strategy remain a follow-up.

## Risks / Trade-offs

- [Risk] Provider documentation may add media constraints during the invite-only period. → Keep validation metadata and media rules isolated in the Wan 3.0 family so updates do not affect HappyHorse.
- [Risk] Remote media URLs and generated video URLs are temporary. → Preserve the existing URL result contract and document persistence as the caller's responsibility; do not add storage to the SDK.
- [Risk] Adding a generic media type to the core can broaden the public contract. → Use a discriminated, readonly shape and retain legacy fields unchanged; add focused type tests for model overloads.
- [Risk] Renaming internal constants can break deep imports. → The constants are not exported from the provider package root and are only referenced inside `registry.ts`; update all in-repository references and preserve exported registry behavior rather than adding aliases.

## Migration Plan

1. Add the new core media type and Wan 3.0 provider family behind tests.
2. Rename existing capability constants and update registry references.
3. Add `wan3.0-video` to the Alibaba registry and public type exports.
4. Run focused tests followed by repository lint, typecheck, build, and test commands.
5. Release the provider package with the new model available; existing model IDs and HappyHorse request fields remain unchanged.
