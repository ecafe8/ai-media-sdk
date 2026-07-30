## Why

Phase 0 shipped only contracts and `NOT_IMPLEMENTED` stubs; the core→adapter→transport→result→error chain has never been exercised end to end. Azure OpenAI offers the clearest, lowest-risk contract to prove the architecture first: a synchronous image API, API Key auth, and a `data[].url`/`data[].b64_json` response. Live contract discovery (Azure AI Serverless `gpt-image-2` deployment, API version `2024-02-01`) confirms the request path, body fields, and `Authorization: Bearer` auth. Validating the full slice on Azure de-risks every later (especially the async Aliyun) provider before its live contract is confirmed.

## What Changes

- Introduce a provider-bound **image model instance** so `generateImage` dispatches to a concrete Provider adapter instead of throwing `NOT_IMPLEMENTED`. **BREAKING**: the Phase 0 `generateImage`/`editImage` free-function signatures evolve (the request now carries a model instance, not a bare `ModelId`).
- Implement the Azure OpenAI adapter `generate()`: build `POST {endpoint}/openai/deployments/{deployment}/images/generations?api-version=…` with the `api-key` header, send through the injected transport, and map `data[].url`/`data[].b64_json` into `ImageContent` results.
- Add a concrete **shared transport implementation** (fetch + timeout + limited retry per `RetryPolicy`) so adapters never call global `fetch` directly.
- Map Azure HTTP failures to classified `SdkError` codes: 401 → `AUTH_ERROR`, 429 → `RATE_LIMITED`, 400/413 → `INVALID_REQUEST`, 5xx → `PROVIDER_ERROR`, timeout → `TIMEOUT`, network failure → `NETWORK_ERROR`; retry only 429/5xx/timeout per `DEFAULT_RETRY_POLICY`.
- Resolve the multi-image result contract: a generation returns multiple images on Azure, so the result carries an array of `ImageContent` while keeping the modality-neutral `GenerationResult<TContent>` shape (see design.md).
- Add public image generation parameters (`prompt`, `n`, `size`) and a `providerOptions.azure` namespace (carrying `quality`, `output_format`, `output_compression` per the live sample); unsupported public params still fail with `INVALID_REQUEST` before any network call.
- Authenticate Azure requests with `Authorization: Bearer {apiKey}` (live-confirmed for Global Standard `gpt-image-2` deployments); this deviates from the PRD's recorded `api-key` header decision and warrants a PRD amendment.
- Add contract tests with a fake/counting transport and fixed Azure response fixtures; no real credentials or network in CI.

## Capabilities

### New Capabilities

- `azure-image-generation`: End-to-end Azure OpenAI text-to-image generation through the shared transport, including the image model instance dispatch, Azure request building, sync response mapping, and HTTP error classification. Alibaba remains a stub pending live DashScope contract discovery.

### Modified Capabilities

- `sdk-package-foundation`: `generateImage` evolves from a `NOT_IMPLEMENTED` stub into a dispatcher routed through a provider-bound image model instance; the image generation request gains public parameters and the completed result carries image content (the `NOT_IMPLEMENTED` stub requirement is retired for generation).
- `provider-package-foundation`: the Azure OpenAI provider adapter `generate` moves from a no-network stub to a real adapter that calls Azure via the shared transport (Alibaba stays a stub pending live contract discovery).

## Impact

- Affected packages: `packages/ai-media-sdk` (image API dispatch, model instance, transport impl, error helpers), `packages/provider-azure-openai` (real adapter), `packages/provider-aliyun-bailian` (unchanged, still stub).
- Affected contracts: `generateImage`/`editImage` signatures, image generation request/result shapes, `GenerationResult<ImageContent>` usage for multiple images.
- No new runtime Provider SDK dependency; Azure stays pure-fetch with `Authorization: Bearer` auth only.
- No examples or Web Playground changes in this slice (deferred to SUB-005).
- Live Azure contract confirmed: deployment `gpt-image-2`, API version `2024-02-01`, generation path `/openai/deployments/{deployment}/images/generations`, edit path `/openai/deployments/{deployment}/images/edits` (multipart, deferred to a later slice).
