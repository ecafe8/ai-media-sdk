## 1. Core Video Contract

- [ ] 1.1 Define and export a readonly discriminated Wan 3.0 media input type that can represent frame, reference image/video/audio, file, and link entries.
- [ ] 1.2 Extend the video request contract with the Wan 3.0 media shape while preserving existing HappyHorse fields and type behavior.
- [ ] 1.3 Add core type tests covering ordered media entries, media-only requests, and the public exports.

## 2. Alibaba Registry And Types

- [ ] 2.1 Rename Wan image capability constants to `WAN2_6_*` and `WAN2_7_*` forms and update all in-repository references.
- [ ] 2.2 Add `WAN3_0_VIDEO_GENERATE_CAPABILITY` and a distinct Alibaba Wan 3.0 video registry family.
- [ ] 2.3 Add typed Wan 3.0 provider parameters and export them from the Alibaba package root.
- [ ] 2.4 Add `wan3.0-video` to the provider model registry projection with its video and async capabilities.

## 3. Wan 3.0 Request Handling

- [ ] 3.1 Implement Wan 3.0 media serialization that preserves order and maps SDK media types to the documented DashScope `input.media` types.
- [ ] 3.2 Implement pre-dispatch validation for prompt/media presence, media mode exclusivity, counts, URL/data values, and duration metadata constraints.
- [ ] 3.3 Implement validation and forwarding for resolution, ratio, duration, audio, seed, and watermark.
- [ ] 3.4 Route Wan 3.0 through the existing async submit, task polling, status mapping, video result mapping, OSS header, and sanitized error paths.

## 4. Verification

- [ ] 4.1 Add adapter tests for text-to-video, media-only, first/last-frame, mixed references, files, links, and exact media ordering.
- [ ] 4.2 Add validation tests for mutually exclusive modes, media count limits, parameter ranges, invalid media values, and no-transport guarantees.
- [ ] 4.3 Add async lifecycle and credential-sanitization tests for successful, failed, and unknown task responses.
- [ ] 4.4 Run focused provider/core tests, then `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test`.
- [ ] 4.5 Review the final diff and confirm only intended change files and implementation files are included before committing.
