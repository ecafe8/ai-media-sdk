## 1. Core Async Task Contract and Video Modality

- [x] 1.1 Add `createTaskHandle<TContent>({ taskId, poll, pollIntervalMs?, timeoutMs? })` to `packages/ai-media-sdk/src/` implementing `TaskHandle<TContent>.wait(options?)` with poll/backoff/timeout and `AbortSignal` support; default `pollIntervalMs` 15000ms, `timeoutMs` 600000ms; export the helper and a `TaskPollResult<TContent>` type from the package root.
- [x] 1.2 Add the optional `submit(request: AdapterRequest): Promise<TaskHandle<TContent>>` method to the `ProviderAdapter<TContent>` contract in `contracts/adapter.ts`; add `async?: boolean` to `ModelCapability` in `contracts/capabilities.ts`; export the updated types.
- [x] 1.3 Implement `submitTask<TContent>(request)` in `packages/ai-media-sdk/src/image/` (or a new `async/` module) mirroring `generateImage` dispatch: validate `model.capabilities.async`, build an `AdapterRequest`, dispatch to `model.adapter.submit()`; reject non-async or non-submit adapters with `INVALID_REQUEST` before dispatch.
- [x] 1.4 Add the `VideoContent` type (`url`, `mimeType?`, `duration?`, `width?`, `height?`) to `packages/ai-media-sdk/src/contracts/content.ts`; export it from the package root alongside `ImageContent`.
- [x] 1.5 Add the video modality entry: `submitVideoTask(request)` accepting `{ model, prompt, firstFrame?, providerOptions }`, validate `model.capabilities.async` + video modality + non-empty `prompt` (+ `firstFrame` presence for first-frame i2v models), build an `AdapterRequest` with a `VideoGenerationInput` payload, and dispatch to `adapter.submit()` returning `TaskHandle<VideoContent[]>`. Export `submitVideoTask`, `VideoGenerationInput`, `VideoGenerationRequest`, and `VideoContent` from the package root.

## 2. Aliyun Video Async Adapter and Shared Polling

- [x] 2.1 Add HappyHorse video models to the Aliyun in-package registry in `packages/provider-aliyun-bailian/src/provider/registry.ts`: `happyhorse-1.1-t2v` (t2v) and `happyhorse-1.1-i2v` (first-frame i2v) with `family: "happyhorse-video"`, `capabilities: { modality: "video", generate: true, edit: false, async: true }`, and per-model `paramSupport`/`requiresFirstFrame` flags; export the new family type.
- [x] 2.2 Implement the shared `getTask(taskId)` in the Aliyun adapter: `GET {baseUrl}/tasks/{task_id}` with `Authorization: Bearer`, parse `output.task_status` → core `TaskStatus` (`PENDING`→`pending`, `RUNNING`/`PROCESSING`→`running`, `SUCCEEDED`→`succeeded`, `FAILED`→`failed`, `CANCELED`→`cancelled`, `UNKNOWN`→`failed`), return the raw task envelope; reuse the shared transport and error classifier.
- [x] 2.3 Implement `submit()` on the Aliyun adapter: route `video`-modality requests to `POST {baseUrl}/services/aigc/video-generation/video-synthesis` with `X-DashScope-Async: enable` + `Authorization: Bearer`; build the t2v body `{ model, input: { prompt }, parameters: { resolution?, ratio?, duration?, watermark?, seed? } }` and the i2v body `{ model, input: { prompt?, media: [{ type: "first_frame", url }] }, parameters: { resolution?, duration?, watermark?, seed? } }` (no `ratio` for i2v); map the first-frame `ImageContent` to `media[0].url` (URL or data-URI base64).
- [x] 2.4 Build the `TaskHandle<VideoContent[]>` poll closure: on `SUCCEEDED`, map `output.video_url` → a one-element `VideoContent[]` (carry `duration` from `usage.duration`), `requestId` from `request_id`, non-sensitive `usage` into `raw`; on `FAILED`/`CANCELED`/`UNKNOWN`, build a sanitized `SdkError` (`PROVIDER_ERROR` for FAILED; cancelled/unknown map to terminal failure) carrying `output.code`/`output.message` redacted of the API key.
- [x] 2.5 Keep the existing `generate()`/`edit()` throwing `NOT_IMPLEMENTED` for `wan-image`/`happyhorse-video` families (sync paths stay stubs); only `submit()` runs the async video path.

## 3. Contract Tests with Fake Transport

- [x] 3.1 Add a fake-transport helper (reuse the existing Aliyun/Azure `createFakeTransport` pattern) that supports async poll sequences in `packages/provider-aliyun-bailian/tests/`.
- [x] 3.2 Add t2v submit contract tests: assert the built request URL path (`video-generation/video-synthesis`), `X-DashScope-Async: enable` + `Authorization: Bearer` headers, and body fields (`model`, `input.prompt`, `parameters.resolution`/`duration`/`watermark` from `providerOptions.aliyun`); assert no `media`.
- [x] 3.3 Add i2v submit contract tests: assert `input.media` is `[{ type: "first_frame", url }]` for a URL first-frame and a data-URI base64 form; assert `parameters.ratio` is absent.
- [x] 3.4 Add poll/result tests: a `PENDING` → `RUNNING` → `SUCCEEDED` sequence resolves `wait()` with a one-element `VideoContent[]` carrying `output.video_url`; a `FAILED`/`UNKNOWN` sequence rejects with `PROVIDER_ERROR`; assert `provider`/`model` ids and `requestId`.
- [x] 3.5 Add error classification tests: submit 401→`AUTH_ERROR` (non-retryable, no key in message), 429→`RATE_LIMITED`, 400→`INVALID_REQUEST`, 5xx→`PROVIDER_ERROR`, transport timeout→`TIMEOUT`.
- [x] 3.6 Add core dispatch tests in `packages/ai-media-sdk/tests/`: `submitVideoTask` dispatches to `adapter.submit` for an async video model; rejects non-async models and empty prompts with `INVALID_REQUEST` before dispatch; `createTaskHandle` resolves/rejects/times-out/aborts per the spec scenarios.

## 4. Example, Environment Template, and Playground Registration

- [x] 4.1 Add `examples/aliyun-video/` with a minimal Node/Bun video-generation example (t2v) using `submitVideoTask` + `TaskHandle.wait()`, a `.env.example` (`ALIYUN_BAILIAN_API_KEY`, `ALIYUN_BAILIAN_BASE_URL`, `ALIYUN_BAILIAN_VIDEO_MODEL`), and a documented run command; ensure no live calls in default verification.
- [x] 4.2 Register the HappyHorse `happyhorse-1.1-t2v`/`happyhorse-1.1-i2v` models in the `apps/web` playground capability registry as available video models; flip them from unavailable to available and add a video-modality form path (provider/model select, prompt, optional first-frame URL for i2v, submit → poll → render `video_url`). Gate the form to video models.

## 5. Verification and Integration

- [x] 5.1 Run `bun run lint` and resolve new errors without changing existing unrelated warnings.
- [x] 5.2 Run `bun run typecheck` across affected workspaces and verify strict/`noUncheckedIndexedAccess` boundaries for the new core + video contracts and the Aliyun video adapter/tests.
- [x] 5.3 Run `bun run test` and verify all core async + Aliyun video contract tests pass without Provider credentials or external network access.
- [x] 5.4 Run `bun run build` and confirm the browser bundle contains no Provider credentials or server-only Provider construction imports.
- [x] 5.5 Run the repository formatter for all changed files, inspect the final diff, and confirm no durable storage, user-system, fallback, batch-generation, Webhook, or new Provider SDK dependency was introduced.
