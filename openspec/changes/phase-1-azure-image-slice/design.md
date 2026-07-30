## Context

Phase 0 (`2026-07-30-phase-0-sdk-foundation`, archived) delivered only contracts and `NOT_IMPLEMENTED` stubs. The modality-neutral core (`GenerationResult<TContent>`, `TaskHandle<TContent>`, `ProviderAdapter<TContent>`, `Transport`, `SdkError`, `RetryPolicy`) exists but has never executed a real request. The Azure OpenAI provider adapter retains an injected transport it never calls, and `generateImage`/`editImage` are free functions that throw before any dispatch.

This slice targets Azure OpenAI first because its image contract is the simplest to validate: synchronous `POST …/images/generations`, `api-key` header auth, and a `data[].url`/`data[].b64_json` response. Aliyun Bailian remains a stub pending live DashScope contract discovery (SUB-001 open questions). The existing TypeScript configs, Bun test baseline, and source-first workspace exports are reused unchanged.

## Goals / Non-Goals

**Goals:**
- Prove the full chain end to end on one provider: core dispatch → Azure adapter → shared transport → Azure HTTP → sync response mapping → classified error handling.
- Land the AI-SDK-style call shape (`provider.image(deployment)` model instance + `generateImage({ model, prompt, … })`) so later providers reuse it.
- Ship a concrete, injectable `Transport` (fetch + timeout + limited retry) shared by all adapters.
- Map Azure HTTP failures to stable `SdkError` codes with correct retryability.
- Keep the SDK pure-fetch with zero external Provider SDK dependency; Azure auth stays `api-key` only.

**Non-Goals:**
- `editImage` for Azure (edit endpoint/contract differs; stays `NOT_IMPLEMENTED`).
- Aliyun Bailian real adapter (stays stub until live DashScope contract is confirmed).
- Async task flow (`TaskHandle` polling) — Azure is synchronous; async is exercised when Aliyun lands.
- `examples/*` runnable apps and Web Playground (SUB-005).
- Public parameter schema validation library (e.g., Zod); the slice validates structurally only.

## Decisions

### D1: AI-SDK-style model instance dispatch
`generateImage({ model, prompt, … })` receives an **image model instance** produced by `provider.image(deployment)`, not a bare `ModelId`. The instance carries `{ providerId, modelId, adapter, capabilities }` and delegates to `adapter.generate(AdapterRequest)`. `generateImage` validates public params against `capabilities`, builds the request, and returns the adapter result.

*Why over alternatives:* matches the PRD-mandated AI SDK mental model (`provider.image(deployment)`); keeps `generateImage` provider-agnostic in core; avoids a global provider registry. *Alternative rejected:* a free function taking `(provider, model, request)` — loses the bound-instance ergonomics and explicit capability attachment.

### D2: Multi-image result via `TContent = ImageContent[]`
Azure returns 1+ images in `data[]`. Image modality specializes the generic result as `GenerationResult<ImageContent[]>` (i.e., `content: ImageContent[]`), keeping the modality-neutral `GenerationResult<TContent>` generic untouched. `TaskHandle<ImageContent[]>` follows for future async image providers.

*Why over alternatives:* preserves the single generic result per call; makes multi-image explicit without a bespoke image-only result type. *Alternative rejected:* `GenerationResult<ImageContent>[]` (one result per image) — fragments provider/model metadata and forces callers to aggregate. *Breaking:* Phase 0's stub used `GenerationResult<ImageContent>` (singular); this slice changes the image specialization to the array form. Acceptable: Phase 0 had no consumers and the spec is modified in this change.

### D3: Concrete shared transport with transport-layer retry
Add `createTransport({ fetch?, retryPolicy?, defaultTimeoutMs? }): Transport`. It wraps `fetch` with `AbortController` timeout and exponential backoff retry on `RetryPolicy.retryableStatusCodes` plus network errors. Adapters never call global `fetch`.

*Why:* retry-once at the transport layer benefits every provider and keeps adapter logic focused on request/response mapping. *Layering rule:* the transport stays provider-agnostic and does **not** import `SdkError`; on exhaustion it throws a plain `TransportError` carrying `statusCode` (or `kind: "timeout" | "network"`) and the last response body. Adapters convert it via a core `classifyHttpError(status, message)` helper.

### D4: Error classification in core, mapping at the adapter
`@ai-media/sdk` exposes `classifyHttpError(status, message): SdkError` mapping: 401/403 → `AUTH_ERROR`, 429 → `RATE_LIMITED`, 400/413/422 → `INVALID_REQUEST`, 5xx → `PROVIDER_ERROR`, timeout → `TIMEOUT`, network failure → `NETWORK_ERROR`, unknown → `UNKNOWN`. The Azure adapter calls it after transport failure or non-2xx response. Retryability follows the `SdkError` code defaults (`RATE_LIMITED`/`TIMEOUT`/`NETWORK_ERROR` retryable).

*Why:* consistent classification across providers; the adapter only supplies the Azure-specific context. Adapters retain `providerId`/`modelId` in the error metadata per the PRD's non-sensitive-diagnostics rule. Sensitive credentials (the API key used in the `Authorization` header) never enter error messages or `cause`.

### D5: Public params + `providerOptions.azure` namespace
`ImageGenerationRequest` gains `prompt`, optional `n`, optional `size`, and optional `providerOptions`. Azure-specific fields live under a typed `providerOptions.azure` namespace and never enter the public contract. Unsupported public params fail with `INVALID_REQUEST` before any network call (PRD §8.2).

The live Azure AI sample for the `gpt-image-2` deployment confirms the body mapping: `prompt`, `size`, `n` are public; `quality`, `output_format`, and `output_compression` are Azure-native and forward through `providerOptions.azure`.

*Why:* preserves portability while exposing Azure-native capability, matching the PRD's "public params + `providerOptions`" decision.

### D6: Azure auth uses `Authorization: Bearer` (live-confirmed, deviates from the PRD)
The Azure adapter authenticates with `Authorization: Bearer {apiKey}`, matching the official Azure AI Serverless API sample for Global Standard `gpt-image-2` deployments (`POST …/images/generations` with `-H "Authorization: Bearer $AZURE_API_KEY"`). This **deviates from the PRD's recorded `api-key` header decision** (main-prd §12 / sub-provider-adapters tech §4.1), which predated live contract discovery.

*Why `Bearer` over `api-key`:* the live deployment's documented sample uses Bearer; it is the authoritative contract for this deployment type. The traditional `api-key` header may also work on classic Azure OpenAI resources, but the slice targets the confirmed Serverless/Global Standard contract. *Recommendation:* amend the PRD §12 decision and the sub-provider-adapters tech §4.1 to record `Authorization: Bearer` as the Phase 1 auth method, with `api-key` noted as a classic-resource alternative to evaluate later.

## Risks / Trade-offs

- **[Breaking `generateImage`/`editImage` signature]** → Phase 0 was an explicit stub with no external consumers; the break is documented in the modified `sdk-package-foundation` spec.
- **[Azure `api-version`/deployment unknowns]** → `AzureOpenAIConfig` already types `apiVersion`/`endpoint`/`apiKey`; concrete values are confirmed during implementation (Context7/live docs) and never hard-coded in contracts.
- **[Transport retry masks transient 429 from the adapter]** → the transport surfaces the final `statusCode`/`kind` via `TransportError`; the adapter still maps the exhausted case to `RATE_LIMITED`, preserving the stable error code.
- **[Multi-image as `ImageContent[]` may surprise Phase 0 callers]** → no Phase 0 consumers exist; the design favors long-term correctness over stub compatibility.
- **[Azure edit endpoint differs from generation]** → explicitly out of scope; `editImage` stays `NOT_IMPLEMENTED` so a later slice can design the edit contract.

## Open Questions

- Default `defaultTimeoutMs` for the shared transport (proposal suggests a conservative value; confirm during implementation).
- Whether `size` belongs in the public image contract (DALL-E/gpt-image use `size`) or should defer to `providerOptions` until a second provider clarifies cross-provider sizing.
- Azure edit contract uses `/images/edits` with `multipart/form-data` (`image`, `mask`, `prompt`), confirmed from the live sample — a later slice should design `editImage` around multipart input; this slice keeps `editImage` as `NOT_IMPLEMENTED`.
- Whether to amend the PRD `api-key` header decision to `Authorization: Bearer` (see D6) — recommended.

## Resolved from Live Contract Discovery

- Azure generation path: `POST {endpoint}/openai/deployments/{deployment}/images/generations?api-version={apiVersion}`.
- Confirmed deployment/model: `gpt-image-2` (deployment name = model instance identifier), API version `2024-02-01`.
- Request body: `prompt`, `size`, `n` (public); `quality`, `output_format`, `output_compression` (Azure-native).
- Response: `data[].b64_json` by default for gpt-image models; `data[].url` for DALL-E — adapter supports both.
- Auth: `Authorization: Bearer {apiKey}` (see D6).

## Migration Plan

No production consumers exist. Rollout is: implement → add contract tests with fake transport → run `lint → typecheck → test`. Rollback is reverting the slice commit; Phase 0 contracts remain in place for the unchanged (Aliyun) paths.
