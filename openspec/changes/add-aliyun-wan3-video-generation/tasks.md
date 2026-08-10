## 1. Core Video Contract

- [ ] 1.1 Define and export a readonly discriminated Wan 3.0 media input type that can represent frame, reference image/video/audio, file, and link entries, including optional duration metadata for validation.
- [ ] 1.2 Extend `VideoGenerationInput` and `submitVideoTask` with optional prompt/media-only support while preserving existing HappyHorse fields and type behavior.
- [ ] 1.3 Add core type tests covering ordered media entries, media-only requests, and the public exports.

## 2. Alibaba Registry And Types

- [ ] 2.1 Rename Wan image capability constants to `WAN2_6_*` and `WAN2_7_*` forms and update all in-repository references.
- [ ] 2.2 Extend `AliyunModelFamily` with the distinct `wan3-video` family and add `WAN3_0_VIDEO_GENERATE_CAPABILITY` plus its registry metadata.
- [ ] 2.3 Add typed Wan 3.0 provider parameters with `audio` boolean semantics, export them from the Alibaba package root, and add the literal `provider.video("wan3.0-video")` overload.
- [ ] 2.4 Add `wan3.0-video` to the provider model registry projection with its video and async capabilities.

## 3. Wan 3.0 Request Handling

- [ ] 3.1 Implement Wan 3.0 media serialization that preserves order and maps SDK media types to the documented DashScope `input.media` types.
- [ ] 3.2 Implement pre-dispatch validation for prompt/media presence, media mode exclusivity, counts, URL/data values, media format/content rules, and caller-supplied duration metadata constraints without probing remote URLs.
- [ ] 3.3 Implement validation and forwarding for resolution, ratio, duration, audio, seed, and watermark.
- [ ] 3.4 Route Wan 3.0 through the existing async submit, task polling, status mapping, video result mapping, regional baseUrl, OSS header, and sanitized error paths.

## 4. Verification

- [ ] 4.1 Add adapter tests for text-to-video, media-only, first/last-frame, mixed references, files, links, and exact media ordering.
- [ ] 4.2 Add validation tests for mutually exclusive modes, media count limits, parameter ranges, invalid media values, and no-transport guarantees.
- [ ] 4.3 Add async lifecycle and credential-sanitization tests for successful, failed, and unknown task responses.
- [ ] 4.4 Update `family-typing.test-d.ts`, core contract tests, and Playground registry tests for the new overload, family, and exclusion behavior.
- [ ] 4.5 Run focused provider/core tests, provider test-tsconfig checks, then `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test`.
- [ ] 4.6 Confirm `wan3.0-video` is excluded from the current Playground projection until its media UI exists.
- [ ] 4.7 Review the final diff and confirm only intended change files and implementation files are included before committing.
