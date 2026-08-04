## Context

Phase 4 landed the modality-neutral async task contract. The core already has:

- `submitTask<TContent>` (`packages/ai-media-sdk/src/async/submit-task.ts`) — generic async dispatcher that validates `model.capabilities.async`, builds a modality-neutral `AdapterRequest`, and calls `model.adapter.submit()`.
- `createTaskHandle<TContent>` (`packages/ai-media-sdk/src/async/create-task-handle.ts`) — generic poll/backoff/timeout/abort helper returning `TaskHandle<TContent>`.
- `ProviderAdapter<TContent>.submit?` (`packages/ai-media-sdk/src/contracts/adapter.ts:44`) — optional async submit method on the adapter contract, already generic.
- `submitVideoTask` (`packages/ai-media-sdk/src/video/submit.ts`) — the video twin of the future `submitImageTask` (per its own docstring), validating `async` + `modality === "video"` + non-empty `prompt`, dispatching via `submitTask<VideoContent[]>`.
- The `async` capability flag on `ModelCapability` (`contracts/capabilities.ts`).

So the **async skeleton is complete and video-validated**. The Aliyun adapter already has a shared `getTask(taskId)` (`GET /tasks/{task_id}` + status mapping `PENDING`→`pending`, `PROCESSING`/`RUNNING`→`running`, `SUCCEEDED`→`succeeded`, `FAILED`→`failed`, `CANCELED`→`cancelled`, `UNKNOWN`→`failed`) built in Phase 4. The registry already has `wan2.7-image-pro` / `wan2.7-image` / `z-image-turbo` as `wan-image` family entries with `generate: true, edit: false` but **no `async` flag**, and `generate()` / `edit()` throw `NOT_IMPLEMENTED` for `wan-image`.

Live contract discovery (`docs/prd/sub-provider-adapters/tech.md` v1.6.0 §4.5 / line 143) confirms Wan image-async shares the HappyHorse video task mechanism exactly: submit `POST /services/aigc/image-generation/generation` + `X-DashScope-Async: enable` → `output.task_id` + `output.task_status=PENDING` → poll `GET /tasks/{task_id}` → `PENDING`/`PROCESSING`/`SUCCEEDED`/`FAILED`/`CANCELED`/`UNKNOWN`, 24h `task_id` + 24h result URL TTL. The only per-modality differences are the submit path (`image-generation/generation` vs `video-synthesis`), the request body (`input.prompt` + `parameters.size/n/seed` vs video `input.prompt/media` + `parameters.resolution/ratio/duration/watermark/seed`), and the result extraction (`output.results[].url` → `ImageContent[]` (multi-element) vs `output.video_url` → `VideoContent[]` (single)). This slice implements the image side, reusing the Phase 4 contract and shared poll, to validate the async contract's cross-modality reuse for the image modality.

## Goals / Non-Goals

**Goals:**

- Land `submitImageTask` core entry — the image twin of `submitVideoTask`, **reusing `ImageGenerationRequest`** (no new public type), dispatching to `adapter.submit()` via `submitTask<ImageContent[]>`.
- Implement Wan image-async in the Aliyun adapter via a `wan-image` branch in `submit()`, reusing the Phase 4 shared `getTask(taskId)` poll.
- Validate that the Phase 4 async contract is truly cross-modality reusable (image, not just video) — proving `TaskHandle<TContent>` is modality-neutral and the shared `getTask` serves both image and video.
- Unlock the 3 registered Wan models currently throwing `NOT_IMPLEMENTED`.
- Add a runnable example and playground registration.

**Non-Goals:**

- Wan sync `generate()` / `edit()` — the same `image-generation/generation` endpoint without `X-DashScope-Async` returns `output.results[].url` synchronously; a cheap follow-up, deferred to keep this slice focused on async-contract reuse.
- Azure `editImage`, the Google Provider (MVP 4th provider gap), HappyHorse `r2v` / `video-edit`, `wan2.6-*` / `animate-*` video series, streaming output, Webhook, and cross-process task persistence (Redis/DB).
- New `SdkErrorCode`s — error classification reuses the shared `classifyHttpError`.

## Decisions

### D1: Reuse `ImageGenerationRequest` as `submitImageTask` input (no new public type)

`submitImageTask(request: ImageGenerationRequest)` takes the same shape as `generateImage`: `{ model: ImageModelInstance, prompt, n?, size?, providerOptions? }`. Wan async supports the same public params (`n`, `size`) as the sync path per the registry `paramSupport: { n: true, size: true }`.

_Why over a new `ImageSubmissionRequest`:_ identical shape; a parallel type would be type bloat and force callers to remember two names for the same fields. The dispatch path differs (sync → `.generate`, async → `.submit`) but the public request contract is the same. `submitVideoTask` introduced `VideoGenerationRequest` only because video carries a different public param (`firstFrame`); image async has no such divergence, so the existing `ImageGenerationRequest` is reused verbatim.

### D2: `submitImageTask` mirrors `submitVideoTask` dispatch

`submitImageTask` validates `model.capabilities.async` + `model.capabilities.modality === "image"` + a non-empty `prompt`, builds an `AdapterRequest` with `modality: "image"` and an `ImageGenerationInput` payload (`{ prompt, n, size, providerOptions }`), then calls `submitTask<ImageContent[]>`. This is the literal image twin of `submitVideoTask` (`video/submit.ts`), swapping `VideoContent`→`ImageContent`, `modality: "video"`→`modality: "image"`, and dropping `firstFrame`.

_Why:_ keeps the dispatch pattern uniform across all 4 entry points (`generateImage` / `editImage` / `submitVideoTask` / `submitImageTask`). The core `submitTask<TContent>` (`async/submit-task.ts`) is already modality-neutral; `submitImageTask` is just the typed image binding.

### D3: Single `submit()` with family-branch dispatch (confirmed approach A)

The Aliyun adapter `submit()` keeps a single method signature and branches internally on `entry.family`:

- `happyhorse-video` → `POST video-generation/video-synthesis` + `output.video_url` → `TaskHandle<VideoContent[]>` (existing, Phase 4, unchanged)
- `wan-image` → `POST image-generation/generation` + `output.results[].url` → `TaskHandle<ImageContent[]>` (new)

The provider object serves both modalities. The `image()` binding (`index.ts:123-137`) returns `adapter: provider` directly — **no cast needed** — because `AliyunBailianProvider extends ProviderAdapter<ImageContent[]>`, so from the image binding's perspective `submit?` is already typed `Promise<TaskHandle<ImageContent[]>>`. Only the `video()` binding (`index.ts:160`) casts (`provider as unknown as ProviderAdapter<VideoContent[]>`) because video needs a different `TContent`. The `submit()` method's declared return type stays `Promise<TaskHandle<VideoContent[]>>` (Phase 4); TypeScript's bivariant method checking lets the Wan branch return `TaskHandle<ImageContent[]>` at runtime while each binding sees its own `TContent` through the interface. If bivariance proves fragile, the signature can be widened to `Promise<TaskHandle<ImageContent[] | VideoContent[]>>` as a fallback.

_Why over per-modality adapter methods (approach B):_ avoids changing the core `ProviderAdapter<TContent>` contract and all existing adapters. Phase 4 already validated this family-branch pattern (HappyHorse t2v/i2v branch inside the same `submit`). No per-binding cast is needed for image models — the existing `image()` binding already provides the correct `TContent` view.

### D4: Reuse the shared `getTask(taskId)` poll (no new poll code)

The `getTask(taskId)` built in Phase 4 (`GET /tasks/{task_id}` + status mapping `PENDING`→`pending`, `PROCESSING`/`RUNNING`→`running`, `SUCCEEDED`→`succeeded`, `FAILED`→`failed`, `CANCELED`→`cancelled`, `UNKNOWN`→`failed`) serves both video and image async without change. The `AliyunTaskResponse` type (`index.ts:468-481`) already declares `results?: ReadonlyArray<{ readonly url?: string }>` (line 473), so the Wan poll closure reads `output.results[].url` directly without modifying the shared response type. Only the result extraction in the submit's poll closure differs: image maps `output.results[].url` → `ImageContent[]` (potentially multi-element, unlike video's fixed 1).

_Why:_ the `/tasks/{task_id}` endpoint and status machine are identical for Wan image-async and HappyHorse video async (confirmed in `tech.md` v1.6.0 §4.5). One `getTask` serves both; the result extraction is isolated per submit branch.

### D5: Wan registry flip + `generate`/`edit` stay stubs

The `wan-image` registry entries flip `async: true` (added to `capabilities`). `generate()` / `edit()` keep throwing `NOT_IMPLEMENTED` for `wan-image` family (sync path deferred). Only `submit()` runs the async image path.

_Why:_ this slice delivers async only, to validate the async contract reuse. Sync `generate` / `edit` for Wan (same endpoint without `X-DashScope-Async`, same `output.results[].url`) is a cheap follow-up but out of scope here.

### D6: Wan async request body

`submit()` builds the `wan-image` body: `{ model, input: { prompt }, parameters: { size?, n?, watermark?, seed? } }` where `size` and `n` are sourced from the public `ImageGenerationInput` (gated by `entry.paramSupport`) and Aliyun-native fields (`watermark`, `seed`, and Wan2.7-specific `thinking_mode`/`color_palette`/`enable_sequential`) from `providerOptions.aliyun`. The Wan branch SHALL use a dedicated `buildWanImageParameters` (not the Qwen `buildParameters`) so Qwen-only fields (`negative_prompt`, `prompt_extend` — per `tech.md` line 145) are never forwarded to the Wan API. Headers: `X-DashScope-Async: enable`, `Authorization: Bearer {apiKey}`, `Content-Type: application/json`. The submit response `output.task_id` + `output.task_status` builds the `TaskHandle<ImageContent[]>`.

_Why:_ matches the live Wan image-async contract (`tech.md` §4.3 line 143 + line 145 parameter differentiation). `prompt`, `n`, `size` are public; `watermark` is universal (Wan+Qwen); Wan2.7-specific fields travel under `providerOptions.aliyun` (consistent with the `providerOptions.aliyun` boundary established in Phase 2 for Qwen). Qwen-only params are excluded to avoid the Wan API rejecting unsupported fields.

### D7: Wan async result mapping

On `SUCCEEDED`, map `output.results[].url` → `ImageContent[]` (one entry per result URL; `n` may produce multiple, unlike video's fixed `video_count: 1`). `requestId` from `request_id`; non-sensitive `usage` / `metrics` into `raw`. On `FAILED` / `CANCELED` / `UNKNOWN`, throw a sanitized `SdkError` (`PROVIDER_ERROR` for FAILED; cancelled/unknown map to terminal failure) carrying `output.code` / `output.message` redacted of the API key.

_Why:_ unlike video's fixed single `video_url`, Wan image `n` can produce multiple result URLs — the `ImageContent[]` array form (already used by sync `generateImage`) handles this natively.

### D8: Error classification reuses the shared classifier

Submit/poll non-2xx → `classifyHttpError(status, sanitizedMessage)` (same as Phase 4). `TransportError` → `TIMEOUT` / `NETWORK_ERROR`. No new `SdkErrorCode`s.

_Why:_ the shared classifier already covers 401→`AUTH_ERROR`, 429→`RATE_LIMITED`, 400/422→`INVALID_REQUEST`, 5xx→`PROVIDER_ERROR`. Both submit and poll paths hit the same Aliyun error envelope shape.

## Risks / Trade-offs

- **[Status string divergence]** image-async uses `PROCESSING`, video uses `RUNNING` for "in progress"; `getTask` (Phase 4) already maps both → core `running`. Absorbed.
- **[Multi-element results]** Wan `n` can produce multiple URLs (unlike video's fixed 1); `ImageContent[]` array form handles this natively. Contract tests must cover `n>1`.
- **[24h URL TTL]** handled by the caller; the adapter does not download/transcode.
- **[Single-package image+video]** the shared `getTask` serves both modalities; no package split needed.
- **[Public param reuse]** `submitImageTask` reuses `ImageGenerationRequest` (same type as sync `generateImage`); callers pick the entry by whether they want sync (`.generate` → direct result) or async (`.submit` → `TaskHandle`). The type reuse is intentional, not a leak.

## Open Questions

- Whether to also implement Wan sync `generate()` in the same slice (same endpoint, same result shape, no async header) — deferred; this slice stays focused on async-contract reuse validation.
- Finer Wan error-code surfacing (`output.code` like `InvalidParameter`) — carried in `raw` / message now; refine later.

## Migration Plan

No production consumers. Rollout: add core `submitImageTask` + export → Aliyun adapter `wan-image` submit branch + registry flip → fake-transport contract tests (submit body/headers, `PENDING`→`PROCESSING`→`SUCCEEDED`, multi-element results, errors, timeout, async gating) → example + `.env.example` → playground registration → `lint → typecheck → test → build`. Rollback is reverting the slice commit; Azure, Seedream, sync Qwen, HappyHorse video, and core sync contracts stay untouched (async image is additive to the Phase 4 contract).
