## 1. Core Video Contract

- [x] 1.1 Extend `VideoGenerationInput` in `packages/ai-media-sdk/src/video/request.ts` with optional `lastFrame: ImageContent`, `referenceVideos`, and `referenceAudios` (URL + optional duration metadata entry types) and document the fields.
- [x] 1.2 Export the new reference media types from the SDK root and confirm existing core tests still pass.

## 2. Provider Package Skeleton

- [x] 2.1 Create `packages/provider-minimax` manifest (`@ai-media/provider-minimax`, ESM, tsup + emit-dts build scripts, `@ai-media/sdk` runtime dependency) and the node-library/test/emit-dts tsconfig set.
- [x] 2.2 Add `LICENSE` and a Chinese README documenting configuration, scenarios, and `providerOptions.minimax`.
- [x] 2.3 Implement `src/config/index.ts` with `MiniMaxConfig` and `resolveBaseUrl` defaulting to `https://api.minimax.io`.
- [x] 2.4 Implement `src/provider/registry.ts` with the `MiniMax-H3` entry (family `h3-video`, async video capabilities, resolution/ratio allowlists, reference image cap) and the `ModelRegistry` projection.
- [x] 2.5 Implement `src/provider/params.ts` with `MiniMaxVideoOptions` (required `resolution`/`duration`, optional `ratio`/`callbackUrl`) and `MiniMaxH3VideoParams`.
- [x] 2.6 Create the `src/index.ts` barrel exporting factory, provider/config types, params, and registries.

## 3. Adapter Implementation

- [x] 3.1 Implement `createMiniMaxProvider` with `video()` literal overload + string fallback, `listModels`, and `NOT_IMPLEMENTED` sync generate/edit.
- [x] 3.2 Implement pre-dispatch validation: non-empty prompt, i2v/r2v exclusivity, `lastFrame` pairing, count limits, URL requirements, duration metadata limits, resolution/duration/ratio rules per scenario.
- [x] 3.3 Implement `content[]` body building (text/image_url/video_url/audio_url with roles, base64 → data URI for images) and submit `POST /v2/video_generation` extracting `task_id`.
- [x] 3.4 Implement the poll closure over `GET /v2/query/video_generation/{task_id}` with status mapping, `content.url`/duration result mapping, usage passthrough, and `createTaskHandle` return.
- [x] 3.5 Implement OpenAI-style error parsing, HTTP classification including the 402 special case, transport error mapping, and API-key redaction.

## 4. Tests

- [x] 4.1 Add `tests/helpers/fake-transport.ts` mirroring the existing provider test helper.
- [x] 4.2 Add adapter tests for t2v, i2v first frame, i2v first & last frame, and r2v mixed-reference request bodies including base64 data URI mapping and ratio normalization.
- [x] 4.3 Add validation tests for exclusivity, pairing, count/duration limits, ratio rules, and no-transport guarantees.
- [x] 4.4 Add lifecycle tests for queued/running/succeeded/failed/cancelled polling, missing task id, missing success URL, and error classification (401/402/422/429/5xx) with credential redaction.
- [x] 4.5 Add `family-typing.test-d.ts` compile-time tests for the `video("MiniMax-H3")` overload narrowing.

## 5. Example And Tooling

- [x] 5.1 Create `examples/minimax-video` (package.json, tsconfig, `.env.example`, config reader with tests, run script with result download/persistence).
- [x] 5.2 Add `MINIMAX_API_KEY`/`MINIMAX_BASE_URL` to `turbo.json` `globalEnv` and `packages/provider-minimax` to `scripts/release-check.ts` `PACKAGES`.
- [x] 5.3 Add the provider to the root README and `packages/ai-media-sdk/README.md` provider lists; run `bun install`.

## 6. Verification

- [x] 6.1 Run focused provider and SDK tests plus provider test-tsconfig checks.
- [x] 6.2 Run `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test`.
- [x] 6.3 Review the final diff, stage only intended files, and commit on `main`.
