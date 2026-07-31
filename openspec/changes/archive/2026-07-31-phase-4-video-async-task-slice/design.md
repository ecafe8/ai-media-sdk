## Context

Phases 0–3 proved the chain on three synchronous Providers. The core already declares `TaskHandle<TContent>` and `TaskStatus` (`pending`/`running`/`succeeded`/`failed`/`cancelled`) in `contracts/generation.ts`, and `AdapterModality` already includes `"video"`. So the **modality-neutral skeleton exists** — but `submitTask`, `createTaskHandle`, the adapter `submit()` method, and the `async` capability flag are not implemented, and no Provider uses them.

Live contract discovery (PRD v1.8.0, tech.md v1.6.0 §4.5) confirms Aliyun HappyHorse video is **async** and shares the Wan image-async task mechanism: submit with `X-DashScope-Async: enable` → `output.task_id` + `PENDING` → poll `GET /tasks/{task_id}` → `RUNNING`/`SUCCEEDED`/`FAILED`/`CANCELED`/`UNKNOWN`, 24h `task_id` + 24h result URL TTL, `Authorization: Bearer`. The only per-modality differences are the submit path (`video-synthesis` vs image `image-generation/generation`), the request body, and the result extraction (`output.video_url` vs image `output.results[].url`). This slice builds the async contract against video (a new modality) to validate modality-neutrality immediately.

## Goals / Non-Goals

**Goals:**

- Land the core modality-neutral async task contract: `submitTask<TContent>` + `createTaskHandle` + adapter `submit()` + `async` capability, so both video (now) and image-async (later) reuse it.
- Land the video modality (`VideoContent`, `submitVideoTask`) and the first video Provider path end to end (HappyHorse t2v + first-frame i2v), reusing the shared transport, error classifier, and a shared Aliyun `getTask()` poll.
- Validate the contract with a new modality (video) — proving `TaskHandle<TContent>` is truly modality-neutral.
- Add a runnable example and playground registration.

**Non-Goals:**

- Wan image-async (`image-generation/generation` submit, `output.results[].url`) — contract supports it, implementation deferred to a later slice.
- HappyHorse `r2v`/`video-edit`, `wan2.7-*` video, `animate-*`; streaming output; Webhook/async-task-callback; cross-process task persistence (Redis/DB); video download/transcoding (24h URL TTL handled by the caller).
- `submitImageTask` entry (image async) — deferred with Wan image-async; only `submitVideoTask` ships now.

## Decisions

### D1: Modality-neutral `submitTask<TContent>` + thin `submitVideoTask` wrapper

Core exposes `submitTask<TContent>(request: TaskSubmissionRequest<TContent>): Promise<TaskHandle<TContent>>`, mirroring `generateImage`'s dispatch: validate `model.capabilities.async`, build an `AdapterRequest`, call `adapter.submit(adapterRequest)`. `submitVideoTask(request)` is a thin typed wrapper binding `TContent = VideoContent[]` and the video input contract, the twin of the future `submitImageTask`. Sync `generateImage`/`editImage` stay unchanged (non-breaking).

_Why over changing `generateImage` to return `TaskHandle`:_ keeps the sync entry points' return type stable and lets async be opt-in per model via the `async` capability. The core `TaskHandle<TContent>` is already generic, so video and image-async share one contract surface.

### D2: `createTaskHandle` centralizes polling

`createTaskHandle<TContent>({ taskId, poll, pollIntervalMs?, timeoutMs? })` returns a `TaskHandle<TContent>` whose `wait(options?)` loops: call `poll()` → if terminal (`succeeded`/`failed`/`cancelled`), resolve/reject; else sleep `pollIntervalMs` and repeat until `timeoutMs`. The `poll()` callback is provider-supplied (the adapter captures its transport/config + task_id) and returns `{ status, result?, error? }`. Defaults: `pollIntervalMs` 15000ms (HappyHorse recommends 15s), `timeoutMs` 600000ms (video takes 1-5 min).

_Why:_ the polling loop (sleep/backoff/timeout/AbortSignal) is modality- and provider-neutral; centralizing it avoids duplicating timers in each adapter. The adapter only supplies the provider-specific "fetch task status" closure.

### D3: Shared Aliyun `getTask(taskId)` poll

The Aliyun adapter gains a private `getTask(taskId)` that does `GET {baseUrl}/tasks/{task_id}` with `Authorization: Bearer`, parses `output.task_status` → core `TaskStatus` (`PENDING`→`pending`, `RUNNING`/`PROCESSING`→`running`, `SUCCEEDED`→`succeeded`, `FAILED`→`failed`, `CANCELED`→`cancelled`, `UNKNOWN`→`failed`), and returns the raw task envelope. `submit()`'s poll closure calls `getTask`, then extracts content per modality: video → `output.video_url` → `VideoContent[]` (1 element, `video_count` is 1); image (later) → `output.results[].url` → `ImageContent[]`.

_Why:_ Aliyun image-async and video-async share the identical `/tasks/{task_id}` endpoint and status machine, so one `getTask` serves both. Only the result extraction differs, isolated in each submit's poll closure.

### D4: `async` capability flag + `modality` reuse

`ModelCapability` gains `async?: boolean`. HappyHorse video models set `modality: "video"`, `generate: true` (video generation), `edit: false`, `async: true`. `submitTask` rejects models without `async` capability with `INVALID_REQUEST` before dispatch. Wan image models (later) will set `async: true` for the image-async path.

_Why:_ the PRD wants capability checks to prevent unsupported calls; an explicit `async` flag is clearer than inferring from `typeof adapter.submit`. Sync-only models (Azure, Seedream, Qwen) leave `async` undefined.

### D5: Video submit request

`submit()` routes by `request.modality === "video"`: `POST {baseUrl}/services/aigc/video-generation/video-synthesis` with `X-DashScope-Async: enable`, `Authorization: Bearer`, `Content-Type: application/json`. t2v body `{ model, input: { prompt }, parameters: { resolution?, ratio?, duration?, watermark?, seed? } }`; i2v body `{ model, input: { prompt?, media: [{ type: "first_frame", url }] }, parameters: { resolution?, duration?, watermark?, seed? } }` (no `ratio` for i2v). The first-frame `ImageContent` maps to `media[0].url` (URL or `data:{mime};base64,{base64}`). The submit response `output.task_id` + `output.task_status` builds the `TaskHandle`.

_Why:_ matches the live HappyHorse curl exactly. `prompt` and `firstFrame` are public; `resolution`/`ratio`/`duration`/`watermark`/`seed` travel under `providerOptions.aliyun` (consistent with the image `providerOptions.aliyun` boundary).

### D6: Video result mapping

On `SUCCEEDED`, map `output.video_url` → a single-element `VideoContent[]` carrying `url`; `usage.SR`/`usage.ratio`/`usage.duration` map to `width`/`height` (SR is a resolution tier, not pixels — kept in `raw` only) and `duration`. `requestId` from `request_id`. On `FAILED`/`CANCELED`/`UNKNOWN`, throw an `SdkError` (`PROVIDER_ERROR` for FAILED, `CANCELLED`-style for CANCELED/UNKNOWN) carrying the sanitized `output.code`/`output.message`.

_Why:_ `video_count` is fixed 1, so `VideoContent[]` always has one element — consistent with `GenerationResult<ImageContent[]>`'s array form. Non-pixel metadata stays in `raw`.

### D7: Error classification reuses the shared classifier

Submit non-2xx → `classifyHttpError(status, sanitizedMessage)` (message from `{ code, message, request_id }` body, redacted of the API key); poll non-2xx → same. `TransportError` → `TIMEOUT`/`NETWORK_ERROR`. Task `FAILED` → `PROVIDER_ERROR` (retryable per the existing default? no — `PROVIDER_ERROR` defaults non-retryable, appropriate for a failed task). No new `SdkErrorCode`s.

## Risks / Trade-offs

- **[Status string divergence]** image-async uses `PROCESSING`, video uses `RUNNING` for "in progress"; `getTask` maps both → core `running`. Documented; absorbed in the adapter.
- **[i2v media constraint]** first-frame must be 1 image (JPEG/JPG/PNG/WEBP, ≥300px, ratio 1:2.5–2.5:1, ≤20MB); the adapter validates presence (1 image) and forwards; full client-side size/aspect validation is out of scope (the provider rejects invalid input → `INVALID_REQUEST`).
- **[Polling timeout vs video duration]** videos take 1-5 min; default `timeoutMs` 600000ms covers it; callers can override via `wait({ timeoutMs })`.
- **[24h URL TTL]** handled by the caller; the adapter does not download/transcode.
- **[Single-package video+image in Aliyun]** the shared `getTask` serves both modalities; no need to split a video package.

## Open Questions

- Whether to expose `submitImageTask` now (image-async entry) as a stub for symmetry — deferred; only `submitVideoTask` ships to avoid an unused entry.
- Whether `wait()` should accept an `AbortSignal` — yes, via `wait({ signal })` (optional, non-breaking); the loop checks `signal.aborted` between polls.
- Finer HappyHorse error-code surfacing (`output.code` like `InvalidParameter`) — carried in `raw`/message now; refine later.

## Migration Plan

No production consumers. Rollout: implement core async + video contracts → add Aliyun video adapter + shared `getTask` → fake-transport contract tests (t2v, i2v, status flow, errors, timeout) → example + `.env.example` → playground registration → `lint → typecheck → test → build`. Rollback is reverting the slice commit; Azure, Seedream, sync Qwen, and core sync contracts stay untouched (async + video are additive).
