## Why

Phases 0–2 proved the chain on Azure (sync) and Aliyun Qwen (sync, in-package model dispatch). The Doubao-Seedream official contract was the last unconfirmed first-party Provider entry. Live contract discovery (PRD v1.7.0, tech.md v1.5.0) now confirms the Volcengine Ark API is OpenAI-compatible, **synchronous**, and authenticates with `Authorization: Bearer {apiKey}` — the lowest-risk path to add a third Provider, and the first that serves both text-to-image and multi-reference image editing on a **single** `/images/generations` endpoint (edit just adds an `image` field, unlike Azure's separate multipart `/images/edits`).

## What Changes

- Add a new Provider package `@ai-media/provider-seedream` (`providerId` `"doubao-seedream"`) that builds `POST {baseUrl}/images/generations` against the Volcengine Ark OpenAI-compatible endpoint with `Authorization: Bearer {apiKey}`. The adapter stays pure-fetch; no Volcengine official SDK is introduced.
- Implement **text-to-image** (`generate`): body `{ model, prompt, size?, response_format? }` plus `providerOptions.seedream` native fields (`watermark`, `output_format`, `optimize_prompt_options`); no `image` field.
- Implement **image editing / multi-reference fusion** (`edit`): the **same** `/images/generations` endpoint, differing only by adding the `image` field — a single string for one reference image, or a `string[]` for 1-N references (up to `maxEditImages`: 10 for `doubao-seedream-5-0-pro`, 14 for the others). Each input `ImageContent` maps to `url` or `data:{mime};base64,{base64}`.
- Add an in-package **model capability registry** (`Record<ModelId, SeedreamModelEntry>`) covering the 4 live models: `doubao-seedream-5-0-pro-260628`, `doubao-seedream-5-0-260128` (alias `doubao-seedream-5-0-lite-260128`), `doubao-seedream-4-5-251128`, `doubao-seedream-4-0-250828`. Each entry carries `capabilities` (incl. `edit` and `maxEditImages`), `paramSupport`, and `outputFormats`. `provider.image(modelId)` rejects unknown ids with `INVALID_REQUEST`.
- Define `SeedreamConfig = { apiKey: string; baseUrl: string }` where `baseUrl` defaults to `https://ark.cn-beijing.volces.com/api/v3` (region `ark+cn-beijing`); the package supplies the default so callers only pass the API key unless they target another region.
- Map the synchronous response `data[]` (`url` | `b64_json` + `size`) into `GenerationResult<ImageContent[]>` carrying `provider: "doubao-seedream"`, the model id, and non-sensitive `usage` metadata — identical in shape to the Azure mapper (proving cross-Provider result uniformity).
- Reuse the shared `Transport` and `classifyHttpError` for Azure/Aliyun-consistent HTTP error classification (401→`AUTH_ERROR`, 429→`RATE_LIMITED`, 400→`INVALID_REQUEST`, 5xx→`PROVIDER_ERROR`, timeout→`TIMEOUT`, network→`NETWORK_ERROR`). OpenAI-style `error.message` is extracted and redacted of the API key.
- Add contract tests with a fake transport and fixed response fixtures (T2I, single-image I2I, multi-image I2I, error cases); no real credentials or network in CI.
- Add a Node example (`examples/seedream-image`) with `.env.example` and register the Provider + 4 models in the `apps/web` playground capability registry.

## Capabilities

### New Capabilities

- `doubao-seedream-image-generation`: Volcengine Ark Doubao-Seedream synchronous text-to-image **and multi-reference image editing** through the shared transport, including the in-package model capability registry, OpenAI-compatible request building (T2I and I2I `image` field shapes), sync `data[]` response mapping, image-input mapping, and HTTP error classification.

### Modified Capabilities

- `provider-package-foundation`: the Seedream adapter `generate` and `edit` are added as real synchronous calls through the shared transport (a third Provider alongside Azure and Aliyun). Azure `edit`, Aliyun Wan models, and the no-external-SDK constraint remain unchanged.

## Impact

- Affected packages: new `packages/provider-seedream` (config, model registry, options, adapter, tests); `examples/seedream-image` (runnable example + env template); `apps/web` (playground capability registry adds Seedream + 4 models).
- No new runtime Provider SDK dependency; Seedream stays pure-fetch with `Authorization: Bearer`, reusing the Phase 1/2 transport and error classifier unchanged.
- Non-goals: 组图 (`sequential_image_generation` multi-output), 流式输出 (`stream`), 联网搜索 (`tools: web_search`), and 交互编辑坐标标签语义化 (`<point>`/`<bbox>`) — deferred to later slices. Interactive edit works in this slice as `edit` + prompt coordinate tags gated by the 5.0 pro capability; the SDK does no coordinate parsing.
- Live Seedream specifics (4 models, size tiers per model, png/jpeg per model, `optimize_prompt_options.mode`, 10/14 reference-image limits, 24h URL TTL, 500 IPM) are from the official docs; the proposal does not hard-code model versions beyond the registered ids.
