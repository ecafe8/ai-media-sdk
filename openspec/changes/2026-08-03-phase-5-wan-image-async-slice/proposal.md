## Why

Phase 4 landed the modality-neutral async task contract (`submitTask<TContent>` / `createTaskHandle` / the optional adapter `submit()` method / the `async` capability flag) and validated it end to end against a **new modality (video)** via the Aliyun HappyHorse video async adapter. The Phase 4 proposal explicitly deferred Wan image-async: _"Wan image-async (`image-generation/generation` submit, `output.results[].url`) — the contract supports it but implementation is deferred to a later slice."_

Live contract discovery (PRD v1.8.0, `docs/prd/sub-provider-adapters/tech.md` v1.6.0 §4.3/§4.5) confirms a key reuse: **Aliyun Wan image-async and HappyHorse video-async share the exact same task mechanism** — submit with `X-DashScope-Async: enable` → `output.task_id` + `PENDING` → poll `GET /tasks/{task_id}` → terminal status (`PENDING`/`PROCESSING`/`SUCCEEDED`/`FAILED`/`CANCELED`/`UNKNOWN`), 24h `task_id` + 24h result URL TTL, `Authorization: Bearer`. Wan image uses the DashScope `input.messages` prompt envelope, while video uses `input.prompt/media`; result extraction is `output.results[].url` → `ImageContent[]` versus `output.video_url` → `VideoContent[]`. This slice implements Wan image-async for the account-supported Wan models and keeps `z-image-turbo` generation-only until its async capability is confirmed.

## What Changes

- Add a **core image async entry**: `submitImageTask(request)` in `packages/ai-media-sdk/src/image/`. It is the image twin of `submitVideoTask` — binds `TContent = ImageContent[]`, validates `model.capabilities.async` + `model.capabilities.modality === "image"` + a non-empty `prompt`, **reuses the existing `ImageGenerationRequest` type** (same shape as `generateImage`: `{ model, prompt, n?, size?, providerOptions? }`), builds a modality-neutral `AdapterRequest` with `modality: "image"`, and dispatches to `model.adapter.submit()` via `submitTask<ImageContent[]>`. No new public request type is introduced.
- Implement the **Aliyun Wan image-async adapter**: `submit()` gains a `wan-image` family branch that posts to `POST {baseUrl}/services/aigc/image-generation/generation` with `X-DashScope-Async: enable` + `Authorization: Bearer`, reads `output.task_id` + `output.task_status`, and returns a `TaskHandle<ImageContent[]>` whose poll closure calls the **shared `getTask(taskId)` already built in Phase 4** (`GET /tasks/{task_id}` + the existing status mapping) and maps `output.results[].url` → `ImageContent[]` (potentially multi-element, unlike video's fixed 1).
- **Flip the supported Wan registry entries** (`wan2.7-image-pro` / `wan2.7-image`) to `async: true` in `ALIYUN_MODEL_REGISTRY`; keep `z-image-turbo` generation-only because the account reports that it does not support asynchronous calls. `generate()` / `edit()` keep throwing `NOT_IMPLEMENTED` for the `wan-image` family (sync path deferred to a later slice).
- Add **contract tests with a fake transport** (submit request body/headers, `PENDING` → `PROCESSING` → `SUCCEEDED` status flow, multi-element `output.results[].url` → `ImageContent[]`, `FAILED`/`CANCELED`/`UNKNOWN` error classification, 401/429/400/5xx/timeout mapping, async-capability gating); no real credentials or network in CI.
- Add an `examples/aliyun-bailian-image` Wan async example with `.env.example` and flip the Wan models from unavailable to available in the `apps/web` playground with an image-async form path.

## Capabilities

### New Capabilities

- `aliyun-wan-image-async`: Aliyun Bailian **Wan image async** generation (t2i) via the DashScope `image-generation/generation` submit + the shared `/tasks/{task_id}` poll (same task mechanism as HappyHorse video async), `output.results[].url` → `ImageContent[]` (multi-element), and HTTP error classification reusing the shared `classifyHttpError`.

### Modified Capabilities

- `sdk-package-foundation`: the core gains the `submitImageTask` image async entry point — the image twin of `submitVideoTask`, reusing `ImageGenerationRequest` and dispatching to `adapter.submit()` via `submitTask<ImageContent[]>`. Existing sync `generateImage` / `editImage`, `submitVideoTask`, the video modality, and the modality-neutral `submitTask<TContent>` / `createTaskHandle` stay unchanged.
- `provider-package-foundation`: the Aliyun Bailian adapter `submit()` gains a real async `wan-image` family branch (image async submit + shared `getTask` poll), flipping Wan models from `NOT_IMPLEMENTED` stubs to available async image models. Wan sync `generate()` / `edit()` stay `NOT_IMPLEMENTED` stubs pending the sync path.

## Impact

- Affected packages: `packages/ai-media-sdk` (core `submitImageTask` entry + export), `packages/provider-aliyun-bailian` (Wan async submit branch + registry flip + shared `getTask` reuse), `examples/aliyun-bailian-image` (Wan async example + env template), `apps/web` (playground: Wan models available, image-async form path).
- No new runtime Provider SDK dependency; Aliyun stays pure-fetch with `Authorization: Bearer`, reusing the Phase 1/2 shared transport and error classifier and the Phase 4 shared `getTask(taskId)` poll.
- Non-goals: Wan sync `generate()` / `edit()` (same `image-generation/generation` endpoint without `X-DashScope-Async`, same `output.results[].url` result shape — a cheap follow-up, out of scope here), Azure `editImage`, the Google Provider (MVP 4th provider gap), HappyHorse `r2v` / `video-edit`, `wan2.6-*` / `animate-*` video series, streaming output, Webhook, and cross-process task persistence.
- Live Wan async specifics (status enum `PENDING`/`PROCESSING`/`SUCCEEDED`/`FAILED`/`CANCELED`/`UNKNOWN`, `output.results[].url` shape, 24h URL TTL, `task_id` 24h query window, poll RPS≤20 / 15s interval) are from `docs/prd/sub-provider-adapters/tech.md` v1.6.0; the proposal does not hard-code model versions beyond the registered ids.
