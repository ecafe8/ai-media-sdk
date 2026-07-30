## Why

Phase 1 proved the full chain on Azure (sync). The architecture has never run against a second Provider, and the Aliyun contract is materially different (region-scoped base URL, model-family dispatch, a `multimodal-generation` endpoint with `messages` input). Live contract discovery (PRD v1.6.0) confirmed Qwen-Image text-to-image is **synchronous** via `/services/aigc/multimodal-generation/generation` — the lowest-risk path to validate a second Provider and the in-package model-dispatch pattern before the async Wan/TaskHandle work (Phase 3).

## What Changes

- Implement the Aliyun Bailian **Qwen-Image synchronous** text-to-image adapter inside the existing `@ai-media/provider-aliyun-bailian` package (single-package model dispatch per the architecture decision).
- Add an in-package **model capability registry** so `provider.image(modelId)` binds the model to its endpoint family (`multimodal-generation` for Qwen), supported parameters, and capabilities. Wan models stay `NOT_IMPLEMENTED` stubs pending Phase 3.
- Evolve `AliyunBailianConfig` to require `apiKey` and a region-scoped `baseUrl` (e.g. `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1`); drop the old optional-`baseUrl` shape.
- Build the Qwen request: `POST {baseUrl}/services/aigc/multimodal-generation/generation` with `Authorization: Bearer {apiKey}`, body `{ model, input.messages[], parameters: { size, negative_prompt?, prompt_extend?, watermark? } }`.
- Map the synchronous response `output.choices[].message.content[].image` into `GenerationResult<ImageContent[]>` with provider/model ids and non-sensitive metadata.
- Reuse the Phase 1 shared `Transport` and `classifyHttpError` for Azure-consistent HTTP error classification (401→`AUTH_ERROR`, 429→`RATE_LIMITED`, 400→`INVALID_REQUEST`, 5xx→`PROVIDER_ERROR`, timeout→`TIMEOUT`).
- Add contract tests with a fake transport and fixed Qwen response fixtures; no real credentials or network in CI.

## Capabilities

### New Capabilities

- `aliyun-qwen-image-generation`: Aliyun Bailian Qwen-Image synchronous text-to-image generation through the shared transport, including the in-package model capability registry, Qwen request building, sync response mapping, and HTTP error classification. Wan models remain stubs pending Phase 3 async work.

### Modified Capabilities

- `provider-package-foundation`: the Aliyun Bailian adapter `generate` moves from a no-network stub to a real Qwen synchronous adapter that calls Aliyun via the shared transport; the `AliyunBailianConfig` shape changes to require a region-scoped `baseUrl`. Wan models stay `NOT_IMPLEMENTED` stubs.

## Impact

- Affected packages: `packages/provider-aliyun-bailian` (real Qwen adapter, model registry, config shape), `packages/ai-media-sdk` (unchanged — reuses Phase 1 transport, `classifyHttpError`, `generateImage` dispatch, `GenerationResult<ImageContent[]>`).
- No new runtime Provider SDK dependency; Aliyun stays pure-fetch with `Authorization: Bearer`.
- Non-goals: Wan async (`image-generation/generation` + `X-DashScope-Async` + task polling) and `TaskHandle` wait/poll (SUB-003) — deferred to Phase 3. `editImage` stays `NOT_IMPLEMENTED`.
- Live Qwen specifics (size presets per model, `negative_prompt`/`prompt_extend` semantics) are confirmed from the official docs; the proposal does not hard-code model versions beyond the recommended registry.
