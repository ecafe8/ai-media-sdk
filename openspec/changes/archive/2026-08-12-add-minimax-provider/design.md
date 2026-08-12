## Context

The SDK has a provider-independent asynchronous video task lifecycle (`submitVideoTask` → adapter `submit` → `createTaskHandle` polling) implemented today only by the Alibaba Bailian provider. MiniMax's V2 video API (`MiniMax-H3`) is asynchronous and multimodal: a single model id serves text-to-video, first/last-frame image-to-video, and reference-to-video through one `content[]` input array with role labels. The core `VideoGenerationInput` contract currently carries `prompt`, `firstFrame`, `referenceImages`, `inputVideo`, and the Wan 3.0-specific ordered `media` list; it cannot express a last-frame image or reference video/audio media.

## Goals / Non-Goals

**Goals:**

- Add a self-contained `packages/provider-minimax` package following the established provider skeleton (typed config, in-package registry, family-typed params, adapter with tests).
- Extend the core video input contract with provider-agnostic fields usable by future providers.
- Validate all documented MiniMax input rules before any transport call.
- Reuse the shared task-handle polling lifecycle; implement only submit, a poll closure, and status/result mapping.
- Cover request serialization, validation, polling, error classification, credential redaction, and public exports with Bun tests plus compile-time family typing tests.

**Non-Goals:**

- Playground integration (`apps/web`, `apps/site`): follow-up change.
- MiniMax task cancel/delete endpoint (`DELETE /v2/video_generation/{task_id}`): the SDK `TaskHandle` has no cancel contract.
- Server-side `callback_url` challenge handling: the field is forwarded only; receiving callbacks is the caller's infrastructure concern.
- H3-Context-IR (`/v2/h3_context_ir`) and video regeneration (`/v2/video_regeneration`) endpoints.
- Any runtime MiniMax SDK dependency.

## Decisions

### Extend `VideoGenerationInput` with discrete provider-agnostic fields

Add optional `lastFrame: ImageContent`, `referenceVideos`, and `referenceAudios` (entries `{ url: string; duration?: number }`) to the core input contract rather than a MiniMax-specific media array. Rationale: MiniMax roles map one-to-one onto discrete fields, the fields are ergonomic at call sites, and they are reusable by future providers with first/last-frame or reference-audio/video support. The alternative (a `MiniMaxVideoMediaEntry` union in core, like `Wan3VideoMediaEntry`) was rejected: ordering across media kinds is not observable semantics for MiniMax (roles disambiguate), and it would add another provider-named type to the core. The Wan 3.0 `media` list stays untouched; the new fields are purely additive.

### Single model entry; scenario determined by input shape

MiniMax-H3 is one model id covering all scenarios, unlike Alibaba's per-mode model ids. The registry therefore has a single `MiniMax-H3` entry with family `h3-video`, capabilities `{ modality: "video", generate: true, edit: false, async: true }`, resolutions `["768P", "2K"]`, and ratios `["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]`. Scenario detection (t2v vs i2v vs r2v) happens at validation time from the input fields, mirroring how the API itself derives behavior from `content` roles.

### Type-level enforcement of required native parameters

The MiniMax API requires `resolution` and `duration` in every request. The family params type `MiniMaxH3VideoParams` makes `providerOptions.minimax` required with required `resolution: "768P" | "2K"` and `duration: 4 | … | 15` literal union, giving compile-time guarantees; the adapter still re-validates at runtime because `AdapterRequest.input` arrives as `unknown`. `ratio` and `callbackUrl` remain optional. This is stricter than the Aliyun precedent (all options optional) because the MiniMax API has no server-side defaults for these two fields.

### Per-scenario ratio rules in the adapter

Text-to-video requires a ratio and rejects `adaptive`; image-to-video always sends `adaptive` regardless of caller input (the API ignores other values); reference-to-video defaults to `adaptive` and accepts any documented ratio. These rules are enforced/normalized during body building with pre-transport `INVALID_REQUEST` errors for the t2v violations.

### Media serialization and base64 handling

Frames and reference images accept a URL or base64 content; base64 images serialize to `data:{mime};base64,{data}` URLs (default `image/png` when MIME type is absent), matching the Wan 3.0 precedent. Reference videos and audios accept URLs only (the API allows data URIs but the 64 MB request body limit makes them impractical; URL-only keeps the contract simple). First frame serializes before last frame; reference items preserve caller order within each media kind, with text first.

### Reuse the shared async lifecycle with MiniMax-specific endpoints

Submit: `POST {base}/v2/video_generation` → `task_id`. Poll: `GET {base}/v2/query/video_generation/{task_id}`. Status mapping: `queued → pending`, `running → running`, `succeeded`, `failed`, `cancelled`. Success extracts `task.content.url` into `VideoContent { url, duration: task.duration }` with `raw: task.usage` and no request id (the query response carries none). Missing `task_id` or missing success URL are `PROVIDER_ERROR`.

### Error classification and redaction

Non-2xx responses parse the OpenAI-style body `{ type: "error", error: { type, message, http_code }, request_id }` and route through the core `classifyHttpError` (401/403 → `AUTH_ERROR`, 429 → `RATE_LIMITED`, 400/422 → `INVALID_REQUEST`, 5xx → `PROVIDER_ERROR`). HTTP 402 (insufficient balance) has no core classification and is special-cased to non-retryable `PROVIDER_ERROR` with the provider message, since it is neither retryable nor a malformed request. All surfaced provider messages redact the configured API key. Transport throws map to `TIMEOUT`/`NETWORK_ERROR` via the shared pattern.

### Default base URL with override

`MiniMaxConfig.baseUrl` is optional and defaults to `https://api.minimax.io` via a `resolveBaseUrl` helper (seedream pattern), with trailing-slash normalization. This keeps the common case to a single `apiKey` while allowing regional or proxy endpoints.

## Risks / Trade-offs

- [Risk] MiniMax V2 API is new; field availability and limits may shift. → Isolate all MiniMax rules in the provider package and registry entry so updates stay local; core contract additions are generic and unaffected.
- [Risk] Generated video URLs are time-limited. → Keep the URL result contract; document prompt download/persistence as the caller's responsibility (the example persists results).
- [Risk] Adding fields to `VideoGenerationInput` widens the public core contract. → Fields are optional, readonly, provider-agnostic, and do not alter existing provider behavior; type tests pin the overload narrowing.
- [Trade-off] `ratio` normalization for i2v silently overrides caller input with `adaptive`. → Matches documented API behavior (other values are ignored); the params type omits `ratio` only where a scenario forbids it entirely (t2v keeps it required, i2v/r2v keep it optional).
- [Trade-off] No cancel/delete support. → The SDK has no cancel abstraction; adding one would be a cross-provider contract change and is deferred.

## Migration Plan

1. Add core input fields and types behind tests; existing providers compile and pass unchanged.
2. Add `packages/provider-minimax` with registry, params, adapter, and tests.
3. Add `examples/minimax-video` and wire release/env tooling.
4. Run full verification (`lint`, `typecheck`, `build`, `test`) and commit.
5. Follow-up changes: Playground integration; cancel/delete when a task-cancel contract exists.
