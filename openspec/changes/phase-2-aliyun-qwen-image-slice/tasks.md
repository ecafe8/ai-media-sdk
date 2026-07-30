## 1. Aliyun Config and Model Capability Registry

- [ ] 1.1 Evolve `AliyunBailianConfig` in `packages/provider-aliyun-bailian/src/config/` to require `apiKey` and a region-scoped `baseUrl` (retire the optional-`baseUrl` shape); update the doc comment to record `Authorization: Bearer` and region-scoped base URL.
- [ ] 1.2 Add an in-package model capability registry (`Record<ModelId, AliyunModelEntry>` with `family`, `capabilities`, `paramSupport`) in `packages/provider-aliyun-bailian/src/` covering the recommended Qwen models (`qwen-image-2.0-pro`, `qwen-image-2.0`, `qwen-image-3.0-pro` as `qwen-multimodal` family) and reserving Wan entries (`wan2.7-image-pro`, `wan2.7-image`, `z-image-turbo`) as `wan-image` family stubs.
- [ ] 1.3 Implement `provider.image(modelId)` to look up the registry, reject unknown model ids with `INVALID_REQUEST`, and return a bound `ImageModelInstance` carrying provider id, model id, adapter, and capabilities.
- [ ] 1.4 Export `AliyunModelEntry`/`AliyunModelFamily` types and `AliyunImageProviderOptions` (`providerOptions.aliyun` namespace: `negative_prompt`, `prompt_extend`, `watermark`) from the package root.

## 2. Qwen Synchronous Adapter

- [ ] 2.1 Implement the Aliyun adapter `generate()` to switch on the model `family`: `qwen-multimodal` runs the sync path; `wan-image` throws `NOT_IMPLEMENTED` without invoking the transport.
- [ ] 2.2 Build the Qwen request: `POST {baseUrl}/services/aigc/multimodal-generation/generation` with `Authorization: Bearer {apiKey}` and body `{ model, input: { messages: [{ role: "user", content: [{ text: prompt }] }] }, parameters: { size?, n?, negative_prompt?, prompt_extend?, watermark? } }`; forward `n` only when the model `paramSupport` declares it; send via the injected (or default) shared `Transport`.
- [ ] 2.3 Map the Qwen sync response `output.choices[].message.content[].image` into `GenerationResult<ImageContent[]>` with `provider: "aliyun-bailian"`, the model id, `requestId` from `request_id`, and non-sensitive `usage` (width/height/image_count) into `raw`.
- [ ] 2.4 On non-2xx responses, call `classifyHttpError(status, sanitizedMessage)` where the message is read from the Aliyun `{ code, message }` body (map `DataInspectionFailed`→`INVALID_REQUEST`, `Throttling`/429→`RATE_LIMITED`); on `TransportError` map `timeout`→`TIMEOUT`, `network`→`NETWORK_ERROR`; the API key SHALL NOT appear in messages or `cause`.
- [ ] 2.5 Keep `edit()` throwing `NOT_IMPLEMENTED` for all Aliyun models in this slice.

## 3. Contract Tests with Fake Transport

- [ ] 3.1 Add an `AliyunBailianConfig` test fixture and a fake-transport helper (reuse the Azure `createFakeTransport` pattern) under `packages/provider-aliyun-bailian/tests/`.
- [ ] 3.2 Add adapter contract tests: assert the built request URL path (`multimodal-generation/generation`), `Authorization: Bearer` header, and body fields (`model`, `input.messages[].content[].text` prompt, `parameters.size`, `parameters.n` gating, `providerOptions.aliyun` forwarding of `negative_prompt`/`prompt_extend`/`watermark`).
- [ ] 3.3 Add response mapping tests: `output.choices[].message.content[].image` maps to `ImageContent[]` with correct provider/model ids; multiple choices produce a multi-element array.
- [ ] 3.4 Add error classification tests: 401→`AUTH_ERROR` (non-retryable, no key in message), 429/`Throttling`→`RATE_LIMITED`, 400/`DataInspectionFailed`→`INVALID_REQUEST`, 5xx→`PROVIDER_ERROR`, transport timeout→`TIMEOUT`.
- [ ] 3.5 Add model-dispatch tests: `provider.image("qwen-image-2.0-pro")` binds; unknown model id throws `INVALID_REQUEST`; a Wan-family model id throws `NOT_IMPLEMENTED` and the transport call count stays zero.

## 4. Verification and Documentation

- [ ] 4.1 Run `bun run lint` and resolve all new errors without changing the existing unrelated `Geist` warning.
- [ ] 4.2 Run `bun run typecheck` and verify runtime and test tsconfigs pass for `provider-aliyun-bailian` and `@ai-media/sdk`.
- [ ] 4.3 Run `bun run test` and verify all Aliyun contract tests pass without Provider credentials or external network access.
- [ ] 4.4 Run a non-mutating Prettier check for all changed files and resolve formatting differences.
- [ ] 4.5 Confirm no `openai` or DashScope runtime SDK dependency was added and the Aliyun package remains pure-fetch.
- [ ] 4.6 Confirm Phase 1 Azure tests and core tests still pass unchanged (no regression from shared-transport/classifier reuse).
