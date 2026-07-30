## Context

Phase 1 (`phase-1-azure-image-slice`, archived-ready) validated the full chain on Azure: `generateImage` → model instance → `Transport` → HTTP → `GenerationResult<ImageContent[]>` + `classifyHttpError`. The shared transport, error classifier, and `GenerationResult<ImageContent[]>` contract are now proven and reusable unchanged.

Aliyun Bailian live contract discovery (PRD v1.6.0) confirmed: auth is `Authorization: Bearer` (matches Azure, reuses the transport); Qwen-Image text-to-image is **synchronous** via `POST {baseUrl}/services/aigc/multimodal-generation/generation` with a `messages` input; Wan text-to-image is async (`image-generation/generation` + `X-DashScope-Async` + task polling) and is explicitly out of scope here (Phase 3, with `TaskHandle`/SUB-003). This slice adds the second Provider and validates the in-package model-dispatch pattern.

## Goals / Non-Goals

**Goals:**
- Land a second Provider end to end on the synchronous Qwen path, reusing the Phase 1 transport and error classifier — covering **both** text-to-image and image editing (I2I), since Qwen serves both on the same endpoint.
- Promote the core `editImage` from a stub to a real dispatcher (mirror of `generateImage`), and land the public multi-image input contract.
- Establish the in-package **model capability registry** so `provider.image(modelId)` routes to the right endpoint family and parameter set without a global registry.
- Evolve `AliyunBailianConfig` to the live region-scoped shape.
- Keep Aliyun pure-fetch with `Authorization: Bearer`; no DashScope SDK.

**Non-Goals:**
- Wan async (`image-generation/generation` + `X-DashScope-Async` + `/tasks/{task_id}` polling) and `TaskHandle` `wait()`/polling (SUB-003) — Phase 3.
- Azure `editImage` — stays `NOT_IMPLEMENTED` (Azure edit is multipart `/images/edits`, deferred).
- Temporary `oss://` URL upload helpers and image download/persistence (24h TTL handled by the caller), content-safety policy decisions.

## Decisions

### D1: Single-package model dispatch
`@ai-media/provider-aliyun-bailian` stays one package. `provider.image(modelId)` looks up an in-package model capability registry entry (`{ family, capabilities, paramSupport }`) and binds the model instance to the shared adapter. The adapter switches on `family`: `qwen-multimodal` runs the sync path now; `wan-image` throws `NOT_IMPLEMENTED` (Phase 3 slot).

*Why over splitting wan/qwen packages:* Aliyun is one platform sharing auth, region-scoped base URL, transport, and (future) async-polling infrastructure; the PRD's "per-platform package" decision targets platforms (Azure vs Aliyun), not model families within one platform. *Alternative rejected:* `provider-aliyun-wan` + `provider-aliyun-qwen` — duplicates auth/region/polling with no isolation benefit.

### D2: In-package model capability registry
A typed `Record<ModelId, AliyunModelEntry>` lives in the Aliyun package. Each entry carries: `family` (`"qwen-multimodal" | "wan-image"`), `capabilities` (`ModelCapability`), and `paramSupport` (which public/Aliyun-native params the model accepts). `provider.image(modelId)` fails `INVALID_REQUEST` for an unknown model id.

*Why:* the registry is Aliyun-specific (it knows which models are Qwen vs Wan and their size formats); keeping it out of the core preserves modality-neutrality. It also gives `generateImage`'s pre-flight capability check real data to validate against.

### D3: Qwen request building
The adapter builds `POST {baseUrl}/services/aigc/multimodal-generation/generation` with `Authorization: Bearer {apiKey}` and body:
```
{ model, input: { messages: [{ role: "user", content: [{ text: prompt }] }] },
  parameters: { size?, n?, negative_prompt?, prompt_extend?, watermark? } }
```
`prompt` and `size` are public; `n` is forwarded only when the model's `paramSupport` allows it; `negative_prompt`, `prompt_extend`, and `watermark` travel under `providerOptions.aliyun` and never enter the public contract.

*Why:* matches the live Qwen curl exactly while keeping the PRD's public/`providerOptions` boundary. Aliyun-native fields stay namespaced so they cannot pollute the Azure contract.

### D4: Qwen sync response mapping
Map `output.choices[].message.content[].image` into `ImageContent[]` (one entry per returned image URL). Carry `provider: "aliyun-bailian"`, `model: modelId`, `requestId` from `request_id`, and non-sensitive `usage` (width/height/image_count) into `raw`.

*Why:* mirrors the Azure mapper shape; the generic `GenerationResult<ImageContent[]>` is reused unchanged, proving cross-Provider result uniformity.

### D5: Error classification reuses the Phase 1 classifier
Non-2xx → `classifyHttpError(status, sanitizedMessage)` where `sanitizedMessage` is read from the Aliyun error body `{ code, message }` (e.g. `DataInspectionFailed` → `INVALID_REQUEST`, `Throttling` on HTTP 429 → `RATE_LIMITED`). `TransportError` → `TIMEOUT`/`NETWORK_ERROR`. The API key never appears in messages or `cause`.

*Why:* identical classification surface to Azure (SUB-004 goal) with Aliyun-only message extraction. Aliyun-specific error codes map onto the existing stable `SdkErrorCode` set rather than adding new codes.

### D6: Config shape — region-scoped `baseUrl` required
`AliyunBailianConfig = { apiKey: string; baseUrl: string }` where `baseUrl` is the full region-scoped API base (e.g. `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1`). The Phase 0 optional-`baseUrl` shape is retired.

*Why:* the live base URL embeds `WorkspaceId` + region, which cannot be defaulted; requiring `baseUrl` is the clean, explicit boundary. A future convenience could accept `{ workspaceId, region }` and synthesize `baseUrl`, but the slice keeps the explicit string.

### D7: `editImage` becomes a real dispatcher with a multi-image input contract
Core `editImage` mirrors `generateImage`: validate `model.capabilities.edit`, build an `AdapterRequest` whose input is `ImageEditInput { prompt, images, providerOptions }`, and dispatch to `adapter.edit()`. `ImageEditRequest` evolves from `{ image: ImageContent }` to `{ images: ImageContent[] }` (1-3 inputs for Qwen). `ImageContent` already carries `url`/`base64`; the adapter maps each input to the provider's image-entry form.

*Why over keeping `image` singular:* the live Qwen I2I contract supports 1-3 reference images, and the PRD's multi-image editing (SUB-002 FEAT-002/FEAT-003) needs an array. A single array field covers both single- and multi-image cases (`images: [img]`). *Breaking:* `ImageEditRequest.image` → `images`; acceptable because editImage was a stub with no consumers.

### D8: Qwen I2I request building reuses the T2I endpoint and body
The Aliyun `edit()` builds the **same** `POST {baseUrl}/services/aigc/multimodal-generation/generation` with `Authorization: Bearer` and `{ model, input.messages, parameters }`. The only difference from `generate()` is the `content` array: I2I leads with 1-3 `{ image: <url | data:{mime};base64,...> }` entries (in input order, defining image order) followed by exactly one `{ text: prompt }`. Image-input mapping: `input.url` → `{image: url}`; otherwise `input.base64` → `{image: "data:${mime};base64,${base64}"}` (mime from `input.mimeType`, default `image/png`).

*Why:* Qwen unifies T2I and I2I on one sync endpoint, so `edit()` shares request/auth/response/error handling with `generate()` — only the `content` array shape differs. This maximizes reuse and keeps editing cheap. *Validation:* `model.capabilities.edit` and the registry's `maxEditImages` bound the `images` length (Qwen: 1-3) before any network call.

## Risks / Trade-offs

- **[Single-package wan/qwen coupling]** → the shared adapter switches on `family`; a Wan sub-adapter slot is reserved so Phase 3 adds async without restructuring the package.
- **[Config shape is breaking]** → the Aliyun stub tests from Phase 0/1 must update to the new `{ apiKey, baseUrl }` shape; no external consumers exist.
- **[Size format divergence]** → Qwen uses `"宽*高"`, Wan uses `"2K"`/`"4K"`; the registry's `paramSupport`/size handling encodes per-family rules, and for this slice Qwen `size` passes through as-is.
- **[Aliyun error-code granularity]** → `DataInspectionFailed`/`Throttling` collapse onto `INVALID_REQUEST`/`RATE_LIMITED`; finer codes can be added to `raw` metadata without changing the stable `SdkErrorCode`.

## Open Questions

- Whether to synthesize `baseUrl` from `{ workspaceId, region }` for ergonomics — deferred; the explicit `baseUrl` string is the slice default.
- Whether `n` (output count) is supported per Qwen model — confirmed yes (1-6 for `qwen-image-3.0-pro`/`2.0-pro`); the registry's `paramSupport` declares it per model so `generate()`/`edit()` forward it only when supported.
- Finer Aliyun error-code surfacing (e.g. content-safety `DataInspectionFailed` vs generic invalid) — map onto existing codes now, refine metadata later.
- Whether to expose `seed` (deterministic seed) as a public param or keep it under `providerOptions.aliyun` — deferred; the slice keeps `seed` in `providerOptions.aliyun`.

## Migration Plan

No production consumers. Rollout: implement → add fake-transport contract tests (T2I + I2I) → `lint → typecheck → test`. Rollback is reverting the slice commit; Azure and core `generateImage` stay untouched (only `editImage` core path changes from stub to dispatch).
