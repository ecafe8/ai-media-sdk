## 1. Core Image API Dispatch and Result Contract

- [ ] 1.1 Introduce an `ImageModelInstance` type (`{ providerId, modelId, adapter, capabilities }`) in `packages/ai-media-sdk/src/image/` and export it from the package root.
- [ ] 1.2 Evolve `ImageGenerationRequest` to carry a `model: ImageModelInstance`, `prompt`, optional `n`, optional `size`, and optional `providerOptions`; keep `editImage` request shape minimal and still throw `NOT_IMPLEMENTED`.
- [ ] 1.3 Implement `generateImage` to validate public params against model capabilities (fail `INVALID_REQUEST` pre-flight), build a modality-neutral `AdapterRequest`, dispatch to `model.adapter.generate`, and return the adapter's result.
- [ ] 1.4 Specialize the image result as `GenerationResult<ImageContent[]>` (array content) and update barrel exports/types so image modality uses the array form while `GenerationResult<TContent>` stays generic.
- [ ] 1.5 Add a `classifyHttpError(status, message)` helper in `packages/ai-media-sdk/src/contracts/` mapping 401/403→`AUTH_ERROR`, 429→`RATE_LIMITED`, 400/413/422→`INVALID_REQUEST`, 5xx→`PROVIDER_ERROR`, and export it; ensure sensitive credentials never enter messages.

## 2. Shared Transport Implementation

- [ ] 2.1 Add `createTransport({ fetch?, retryPolicy?, defaultTimeoutMs? }): Transport` in `packages/ai-media-sdk/src/transport/` wrapping `fetch` with `AbortController` timeout, exponential backoff retry on `RetryPolicy.retryableStatusCodes` plus network/timeout failures, capped at `maxRetries`.
- [ ] 2.2 Define a `TransportError` carrying `statusCode` (or `kind: "timeout" | "network"`) and the last response body; ensure the transport module does **not** import `SdkError`.
- [ ] 2.3 Export `createTransport`, `TransportError`, and `DEFAULT_TIMEOUT_MS` from the package root; add a unit test that a counting fake `fetch` is retried on 429 up to `maxRetries` then throws `TransportError`.

## 3. Azure OpenAI Adapter Implementation

- [ ] 3.1 Add a typed `AzureImageProviderOptions` (`providerOptions.azure` namespace) carrying optional `quality`, `output_format`, and `output_compression` in `packages/provider-azure-openai/src/`.
- [ ] 3.2 Implement `AzureOpenAIProvider.image(deployment)` returning an `ImageModelInstance` bound to the provider adapter, model id `deployment`, and image-generation capabilities (`generate: true`, `edit: false`).
- [ ] 3.3 Implement the Azure adapter `generate()`: build `POST {endpoint}/openai/deployments/{deployment}/images/generations?api-version={apiVersion}` with `Authorization: Bearer {apiKey}` and a JSON body from `prompt`/`n`/`size` plus `providerOptions.azure` fields; send via the injected (or default) `Transport`.
- [ ] 3.4 Map the Azure sync response `data[]` (`url` and/or `b64_json`) into a `GenerationResult<ImageContent[]>` with provider id, model id, and request id when present; preserve `raw` as non-sensitive metadata only.
- [ ] 3.5 On non-2xx responses or `TransportError`, call `classifyHttpError` to throw a classified `SdkError` (401/403 `AUTH_ERROR`, 429 `RATE_LIMITED`, 5xx `PROVIDER_ERROR`, timeout `TIMEOUT`, network `NETWORK_ERROR`); keep `editImage` throwing `NOT_IMPLEMENTED`.

## 4. Contract Tests with Fake Transport

- [ ] 4.1 Add a `CountingTransport`/fake-`fetch` test helper shared across provider tests (records `TransportRequest`s, returns fixed `TransportResponse`s) without real network.
- [ ] 4.2 Add Azure adapter contract tests: assert the built request URL path, `api-version` query, `Authorization: Bearer` header, and JSON body fields (`prompt`, `n`, `size`, and `providerOptions.azure` forwarding).
- [ ] 4.3 Add Azure response mapping tests: `data[].url` and `data[].b64_json` each map to `ImageContent[]` with correct provider/model ids; multiple images produce a multi-element array.
- [ ] 4.4 Add Azure error classification tests: 401→`AUTH_ERROR` (non-retryable, no key in message), 429→`RATE_LIMITED`, 5xx→`PROVIDER_ERROR`, timeout→`TIMEOUT`; assert the API key never appears in thrown error text or `cause`.
- [ ] 4.5 Add a core dispatch test: `generateImage` with a bound model instance invokes the adapter `generate` and returns its result; an unsupported public param throws `INVALID_REQUEST` before any transport call.
- [ ] 4.6 Confirm the Alibaba provider adapter still throws `NOT_IMPLEMENTED` and a counting transport stays at zero calls.

## 5. Verification and Documentation

- [ ] 5.1 Run `bun run lint` and resolve all new errors without changing the existing unrelated `Geist` warning.
- [ ] 5.2 Run `bun run typecheck` and verify runtime and test tsconfigs pass for `ai-media-sdk` and `provider-azure-openai`.
- [ ] 5.3 Run `bun run test` and verify all Azure contract tests pass without Provider credentials or external network access.
- [ ] 5.4 Run a non-mutating Prettier check (`bun run format` dry-run or `prettier --check`) for all changed files and resolve formatting differences.
- [ ] 5.5 Update `docs/prd/sub-provider-adapters/tech.md` §4.1 to record `Authorization: Bearer` as the Phase 1 Azure auth method (live-confirmed for Global Standard `gpt-image-2` deployments), noting `api-key` as a classic-resource alternative; add a PRD §12 amendment pointer in the main PRD change log.
- [ ] 5.6 Confirm no `openai` or DashScope runtime SDK dependency was added and both provider packages remain pure-fetch.
