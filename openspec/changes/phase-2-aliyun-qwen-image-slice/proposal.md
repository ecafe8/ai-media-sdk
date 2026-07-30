## Why

Phase 1 proved the full chain on Azure (sync). The architecture has never run against a second Provider, and the Aliyun contract is materially different (region-scoped base URL, model-family dispatch, a `multimodal-generation` endpoint with `messages` input). Live contract discovery (PRD v1.6.0) confirmed Qwen-Image text-to-image is **synchronous** via `/services/aigc/multimodal-generation/generation` — the lowest-risk path to validate a second Provider and the in-package model-dispatch pattern before the async Wan/TaskHandle work (Phase 3).

## What Changes

- Implement the Aliyun Bailian **Qwen-Image synchronous text-to-image AND image-editing** adapter inside the existing `@ai-media/provider-aliyun-bailian` package (single-package model dispatch per the architecture decision). Qwen `qwen-image-3.0-pro` / `qwen-image-2.0-pro` support both T2I and I2I on the **same** `multimodal-generation/generation` endpoint; I2I only differs by adding 1-3 `{"image":...}` entries before the `{"text":...}` in the `content` array.
- Promote the core `editImage` from a `NOT_IMPLEMENTED` stub to a real dispatcher (mirrors the Phase 1 `generateImage` dispatch): validate `model.capabilities.edit`, build an `AdapterRequest`, route to `adapter.edit()`. **BREAKING**: `ImageEditRequest` evolves from `{ image: ImageContent }` to `{ images: ImageContent[] }` (1-3 inputs).
- Add the **public image-input contract**: `ImageContent` already carries `url`/`base64`; the adapter maps each input image to Qwen's `{image: url | data:{mime};base64,...}` entry.
- Add an in-package **model capability registry** so `provider.image(modelId)` binds the model to its endpoint family (`multimodal-generation` for Qwen), supported parameters, and capabilities (incl. `edit` and `maxEditImages`). Wan models stay `NOT_IMPLEMENTED` stubs pending Phase 3.
- Evolve `AliyunBailianConfig` to require `apiKey` and a region-scoped `baseUrl` (e.g. `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1`); drop the old optional-`baseUrl` shape.
- Build the Qwen request: `POST {baseUrl}/services/aigc/multimodal-generation/generation` with `Authorization: Bearer {apiKey}`, body `{ model, input.messages[], parameters: { size?, n?, negative_prompt?, prompt_extend?, watermark?, seed? } }`; for I2I the `content` array leads with 1-3 image entries.
- Map the synchronous response `output.choices[].message.content[].image` into `GenerationResult<ImageContent[]>` with provider/model ids and non-sensitive metadata (same for T2I and I2I).
- Reuse the Phase 1 shared `Transport` and `classifyHttpError` for Azure-consistent HTTP error classification (401→`AUTH_ERROR`, 429→`RATE_LIMITED`, 400→`INVALID_REQUEST`, 5xx→`PROVIDER_ERROR`, timeout→`TIMEOUT`).
- Add contract tests with a fake transport and fixed Qwen T2I and I2I response fixtures; no real credentials or network in CI.

## Capabilities

### New Capabilities

- `aliyun-qwen-image-generation`: Aliyun Bailian Qwen-Image synchronous text-to-image **and image editing** through the shared transport, including the in-package model capability registry, Qwen request building (T2I and I2I `content` shapes), sync response mapping, image-input mapping, and HTTP error classification. Wan models remain stubs pending Phase 3 async work.

### Modified Capabilities

- `sdk-package-foundation`: `editImage` evolves from a `NOT_IMPLEMENTED` stub into a dispatcher routed through a provider-bound image model instance; the image edit request gains a multi-image input contract (`images: ImageContent[]`).
- `provider-package-foundation`: the Aliyun Bailian adapter `generate` and `edit` move from no-network stubs to real Qwen synchronous calls via the shared transport (T2I and I2I); the `AliyunBailianConfig` shape changes to require a region-scoped `baseUrl`. Azure `edit` and Wan models stay `NOT_IMPLEMENTED` stubs.

## Impact

- Affected packages: `packages/provider-aliyun-bailian` (real Qwen T2I + I2I adapter, model registry, config shape), `packages/ai-media-sdk` (core `editImage` dispatch, `ImageEditRequest` multi-image input, image-edit input type/guard).
- No new runtime Provider SDK dependency; Aliyun stays pure-fetch with `Authorization: Bearer`.
- Non-goals: Wan async (`image-generation/generation` + `X-DashScope-Async` + task polling) and `TaskHandle` wait/poll (SUB-003) — deferred to Phase 3. Azure `editImage` stays `NOT_IMPLEMENTED` (multipart `/images/edits` deferred). Temporary `oss://` URL upload helpers are out of scope (callers pass public URLs or base64).
- Live Qwen specifics (size presets per model, `n` 1-6, `negative_prompt`/`prompt_extend` semantics, 1-3 image inputs) are confirmed from the official docs; the proposal does not hard-code model versions beyond the recommended registry.
