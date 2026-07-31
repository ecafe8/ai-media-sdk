## Context

Phases 0–2 proved the chain on Azure (sync `/images/generations`, `data[]` response) and Aliyun Qwen (sync `multimodal-generation`, in-package model dispatch). The shared `Transport`, `classifyHttpError`, and `GenerationResult<ImageContent[]>` contract are reusable unchanged. The core `editImage` is already a real dispatcher (Phase 2) with a multi-image `ImageEditInput`; the `maxEditImages` capability bound is per-model and optional.

Doubao-Seedream live contract discovery (PRD v1.7.0, tech.md v1.5.0) confirms: auth is `Authorization: Bearer` (matches Azure/Aliyun, reuses the transport); the Volcengine Ark API is OpenAI-compatible `POST /api/v3/images/generations` and **synchronous** (returns `data[]` directly, no async task polling — not blocked by SUB-003); a **single endpoint** serves T2I, I2I, multi-reference fusion, 组图, and interactive edit — editing only adds an `image` field (not a separate multipart endpoint like Azure). This slice adds the third Provider and the first that unifies T2I and multi-image edit on one endpoint.

## Goals / Non-Goals

**Goals:**

- Land a third Provider end to end on the synchronous Ark path, reusing the Phase 1/2 transport and error classifier — covering **both** text-to-image and single/multi-image editing (I2I/fusion), since Seedream serves both on the same `/images/generations` endpoint.
- Establish the in-package **model capability registry** (4 live models) so `provider.image(modelId)` routes to capabilities and parameter sets without a global registry.
- Map the OpenAI-compatible `data[]` response (`url`/`b64_json` + `size`) into `GenerationResult<ImageContent[]>`, mirroring the Azure mapper shape.
- Keep Seedream pure-fetch with `Authorization: Bearer`; no Volcengine SDK.
- Add a runnable example and playground registration.

**Non-Goals:**

- 组图 (`sequential_image_generation` multi-output) — needs a sequential/multi-result contract; deferred.
- 流式输出 (`stream` SSE) and 联网搜索 (`tools: web_search`) — need streaming/tool contracts; deferred.
- Interactive-edit coordinate parsing (`<point>`/`<bbox>`) — prompt-side only; the SDK forwards prompts verbatim, gated by the 5.0 pro capability.
- Image download/persistence (24h URL TTL handled by the caller); content-safety policy decisions.

## Decisions

### D1: New `@ai-media/provider-seedream` package, `providerId` `"doubao-seedream"`

A new package mirrors `@ai-media/provider-aliyun-bailian` (config / provider/options / provider/registry / provider/index). `providerId` is `"doubao-seedream"` (model-family name, matching the PRD FEAT-005 package `@ai-media/provider-seedream`).

_Why over a platform-named `provider-volcengine-ark`:_ the PRD scopes the first-party package by model family; Seedream is the only Volcengine image family in scope. A platform package can be split later if other Volcengine families arrive. _Alternative rejected:_ `provider-volcengine-ark` — premature platform grouping with no current second family.

### D2: In-package model capability registry

A typed `Record<ModelId, SeedreamModelEntry>` lives in the Seedream package. Each entry carries `capabilities` (`ModelCapability`, incl. `edit` and `maxEditImages`), `paramSupport` (which public params the model accepts), and `outputFormats` (`["png","jpeg"]` for 5.0 series; `["jpeg"]` for 4.5/4.0). `provider.image(modelId)` fails `INVALID_REQUEST` for an unknown id. The 4 registered models: `doubao-seedream-5-0-pro-260628` (edit, maxEditImages 10), `doubao-seedream-5-0-260128` (alias `doubao-seedream-5-0-lite-260128`; edit, maxEditImages 14), `doubao-seedream-4-5-251128` (edit, maxEditImages 14), `doubao-seedream-4-0-250828` (edit, maxEditImages 14).

_Why:_ the registry is Seedream-specific (it knows per-model size tiers, output formats, reference limits); keeping it out of the core preserves modality-neutrality and gives `editImage`'s pre-flight capability check real data.

### D3: Single endpoint for T2I and I2I

The adapter builds `POST {baseUrl}/images/generations` with `Authorization: Bearer {apiKey}` and body `{ model, prompt, size?, response_format?, output_format?, watermark?, optimize_prompt_options? }`. `generate()` omits `image`; `edit()` adds `image` — a single string for one reference, or a `string[]` for 1-N references. Public fields: `model`, `prompt`, `size`, `response_format` (URL/b64 selection is a result-shape concern, kept public); native fields travel under `providerOptions.seedream` and never enter the public contract.

_Why:_ matches the live Ark curl exactly. Reusing one endpoint for T2I and I2I maximizes code sharing (auth, body, response mapping, error handling) — only the `image` field differs.

### D4: Image-input mapping

For each input `ImageContent`, `edit()` emits one `image` entry: `input.url` → the URL string; otherwise `input.base64` → `"data:{mime};base64,{base64}"` (mime from `input.mimeType`, default `image/png`, lowercase). When `images.length === 1`, the body's `image` is a string; when `> 1`, it is a `string[]` preserving input order.

_Why:_ the Ark API accepts `image` as a string or string[]; mapping the SDK's `ImageContent[]` to this shape is direct. `maxEditImages` (10/14) bounds the array length via the core `editImage` pre-flight and the registry.

### D5: Sync response mapping

Map `data[]` into `ImageContent[]` — one entry per returned image, carrying `url` (`data[].url`) or `base64` (`data[].b64_json`), plus `width`/`height` parsed from `data[].size` when present (`"WxH"` form). Carry `provider: "doubao-seedream"`, `model: modelId`, `requestId` from `request_id` when present, and non-sensitive `usage` into `raw`.

_Why:_ mirrors the Azure mapper (OpenAI-compatible `data[]` shape), proving cross-Provider result uniformity. The `size` string is parsed to `width`/`height` for richer metadata without changing the contract.

### D6: Error classification reuses the shared classifier

Non-2xx → `classifyHttpError(status, sanitizedMessage)` where `sanitizedMessage` is read from the OpenAI-style error body `{ error: { code, message } }`; the API key is redacted from any message. `TransportError` → `TIMEOUT`/`NETWORK_ERROR`. No new `SdkErrorCode`s.

_Why:_ identical classification surface to Azure/Aliyun (SUB-004 goal) with Seedream-only message extraction. The `error.code` (e.g. `InternalServiceError`) can be carried in `raw` metadata without changing stable codes.

### D7: Config shape — `apiKey` required, `baseUrl` defaulted

`SeedreamConfig = { apiKey: string; baseUrl: string }` where `baseUrl` defaults to `https://ark.cn-beijing.volces.com/api/v3`. The package supplies the default so a caller passing only `{ apiKey }` targets `ark+cn-beijing`; callers targeting another region pass `baseUrl` explicitly.

_Why:_ unlike Aliyun (where `baseUrl` embeds a workspace id and cannot be defaulted), the Ark base URL is a fixed regional endpoint and can be defaulted for ergonomics. The explicit `baseUrl` field still allows region overrides.

## Risks / Trade-offs

- **[Single endpoint overloading T2I/I2I/组图/交互]** → the adapter only handles T2I + I2I now; 组图/stream/web_search slots are reserved by the registry's capability flags and deferred.
- **[Size format divergence]** → Ark accepts both tier (`2K`) and `WxH`; the registry's `paramSupport`/size handling passes `size` through as-is, matching the live API (note: Ark uses `x`, not Aliyun's `*`).
- **[maxEditImages up to 14]** → exceeds the Phase 2 Qwen (1-3) assumption; the `maxEditImages` capability is already optional and per-model, so no core change is needed.
- **[24h URL TTL]** → handled by the caller; the adapter does not download or persist.

## Open Questions

- Whether to expose `response_format` (`url`/`b64_json`) as a public param or keep it under `providerOptions.seedream` — the slice keeps `response_format` public (it selects the result content shape, a cross-Provider concern) and `output_format`/`watermark`/`optimize_prompt_options` under `providerOptions.seedream`.
- Whether to parse `data[].size` (`"WxH"`) into `width`/`height` — yes, parsed best-effort, non-fatal when absent.
- Finer Ark error-code surfacing (`error.code` like `InternalServiceError`) — carried in `raw` metadata now; refine later.

## Migration Plan

No production consumers. Rollout: implement package → add fake-transport contract tests (T2I, single-image I2I, multi-image I2I, error cases) → add example + `.env.example` → register in playground → `lint → typecheck → test → build`. Rollback is reverting the slice commit; Azure, Aliyun, and core contracts stay untouched (Seedream is additive only).
