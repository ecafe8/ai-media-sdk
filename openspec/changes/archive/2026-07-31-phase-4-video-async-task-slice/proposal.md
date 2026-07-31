## Why

Phases 0–3 proved the chain on three **synchronous** Providers (Azure, Aliyun Qwen, Doubao-Seedream). The core `TaskHandle<TContent>`/`TaskStatus` types exist but are unused — the async task lifecycle (SUB-003) was never implemented, and Aliyun Wan image-async plus all video generation remain `NOT_IMPLEMENTED` stubs. Live contract discovery (PRD v1.8.0, tech.md v1.6.0) confirmed a key reuse: **Aliyun's image-async and video-async share the exact same task mechanism** (`X-DashScope-Async: enable` → `output.task_id` → poll `GET /tasks/{task_id}` → terminal status, 24h TTL). Building the async contract against a **new modality (video, via HappyHorse)** both delivers SUB-003 and stress-tests the contract's modality-neutrality from day one — image-async (Wan) will reuse it almost for free later.

## What Changes

- Add a **core modality-neutral async task contract** (SUB-003): `submitTask<TContent>(request): Promise<TaskHandle<TContent>>` dispatching through a new optional `adapter.submit()`; `createTaskHandle<TContent>({ taskId, poll, pollIntervalMs, timeoutMs })` providing `wait()` polling/backoff/timeout; `ModelCapability.async?: boolean` to gate async-capable models.
- Add the **video modality**: a `VideoContent` type (`url`/`mimeType?`/`duration?`/`width?`/`height?`) and a `submitVideoTask(request)` entry (a thin typed wrapper over `submitTask`, the video twin of the future `submitImageTask`). The public video input carries `prompt` and an optional `firstFrame: ImageContent` (for i2v); native video params (`resolution`/`ratio`/`duration`/`watermark`/`seed`) travel under `providerOptions.aliyun`.
- Implement the **Aliyun HappyHorse video async adapter** inside the existing `@ai-media/provider-aliyun-bailian` package: `submit()` routes video models to `POST {baseUrl}/services/aigc/video-generation/video-synthesis` with `X-DashScope-Async: enable` + `Authorization: Bearer`; returns a `TaskHandle` whose poll closure calls a shared `getTask(taskId)` (`GET /tasks/{task_id}`) and maps `output.video_url` → `VideoContent[]`. Task status (`PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`/`CANCELED`/`UNKNOWN`) maps to the core `TaskStatus`.
- Reuse the shared `Transport` and `classifyHttpError` for HTTP error classification on both the submit and poll paths; the API key never appears in messages or `cause`.
- Register HappyHorse `happyhorse-1.1-t2v` (t2v) and `happyhorse-1.1-i2v` (first-frame i2v) in the Aliyun model registry with `modality: "video"`, `async: true`, and video capabilities.
- Add contract tests with a fake transport (t2v submit/poll/result, i2v first-frame media, status flow `PENDING→RUNNING→SUCCEEDED`, error classification, timeout, async-capability gating); no real credentials or network in CI.
- Add an `examples/aliyun-video` example with `.env.example` and flip the HappyHorse video models to available in the `apps/web` playground with a video-modality form path.

## Capabilities

### New Capabilities

- `video-async-task`: core modality-neutral asynchronous task contract — `submitTask<TContent>`, `TaskHandle.wait()` polling via `createTaskHandle`, the adapter `submit()` method, and the `async` capability flag. Validated with `VideoContent[]` now; `ImageContent[]` (Wan image-async) reuses it later.
- `video-content-and-generation`: the video modality content type (`VideoContent`) and the `submitVideoTask` entry point with a public `{ prompt, firstFrame?, providerOptions }` input.
- `aliyun-video-generation`: Aliyun HappyHorse synchronous-free **video async** generation (t2v + first-frame i2v) via the DashScope `video-synthesis` submit + shared `/tasks/{task_id}` poll, `output.video_url` → `VideoContent[]`, and HTTP error classification.

### Modified Capabilities

- `sdk-package-foundation`: the core gains the modality-neutral async task contract, the optional `submit()` adapter method, the `async` capability flag, and the video content/entry types. Existing sync `generateImage`/`editImage` and the `image` modality stay unchanged.
- `provider-package-foundation`: the Aliyun Bailian adapter gains real async `submit()` + shared `getTask()` calls through the shared transport for the video modality. Azure edit, Aliyun Wan sync generate/edit, and the no-external-SDK constraint remain unchanged.

## Impact

- Affected packages: `packages/ai-media-sdk` (core async + video contracts), `packages/provider-aliyun-bailian` (video async adapter, registry, shared `getTask`), `examples/aliyun-video` (runnable example + env template), `apps/web` (playground: HappyHorse video models available, video form path).
- No new runtime Provider SDK dependency; Aliyun stays pure-fetch with `Authorization: Bearer`, reusing the Phase 1/2 transport and error classifier.
- Non-goals: Wan image-async (`image-generation/generation` submit, `output.results[].url`) — the contract supports it but implementation is deferred to a later slice. HappyHorse `r2v`/`video-edit`, `wan2.7-*` video, `animate-*`, streaming, Webhook, and cross-process task persistence are out of scope. Wan sync generate/edit stays `NOT_IMPLEMENTED`.
- Live HappyHorse specifics (status enum, `video_url` MP4 24h TTL, `video_count` fixed 1, poll RPS≤20 / 15s interval, i2v no `ratio`) are from the official docs; the proposal does not hard-code model versions beyond the registered ids.
