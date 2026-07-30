## 1. Aliyun Config and Model Capability Registry

- [ ] 1.1 Evolve `AliyunBailianConfig` in `packages/provider-aliyun-bailian/src/config/` to require `apiKey` and a region-scoped `baseUrl` (retire the optional-`baseUrl` shape); update the doc comment to record `Authorization: Bearer` and region-scoped base URL.
- [ ] 1.2 Add an in-package model capability registry (`Record<ModelId, AliyunModelEntry>` with `family`, `capabilities`, `paramSupport`, `maxEditImages`) in `packages/provider-aliyun-bailian/src/` covering the recommended Qwen models (`qwen-image-3.0-pro`, `qwen-image-2.0-pro`, `qwen-image-2.0`) as `qwen-multimodal` family with `capabilities.edit=true` and `maxEditImages=3`, and reserving Wan entries (`wan2.7-image-pro`, `wan2.7-image`, `z-image-turbo`) as `wan-image` family stubs.
- [ ] 1.3 Implement `provider.image(modelId)` to look up the registry, reject unknown model ids with `INVALID_REQUEST`, and return a bound `ImageModelInstance` carrying provider id, model id, adapter, and capabilities.
- [ ] 1.4 Export `AliyunModelEntry`/`AliyunModelFamily` types and `AliyunImageProviderOptions` (`providerOptions.aliyun` namespace: `negative_prompt`, `prompt_extend`, `watermark`, `seed`) from the package root.

## 2. Core editImage Dispatch and Image Input Contract

- [ ] 2.1 Evolve `ImageEditRequest` in `packages/ai-media-sdk/src/image/request.ts` from `{ image: ImageContent }` to `{ model: ImageModelInstance, prompt: string, images: ImageContent[] }`; add an `ImageEditInput` (`{ prompt, images, providerOptions }`) and an `isImageEditInput` guard.
- [ ] 2.2 Implement `editImage` in `packages/ai-media-sdk/src/image/generate.ts` to dispatch through `model.adapter.edit` (replacing the `NOT_IMPLEMENTED` stub): validate `model.capabilities.edit`, validate `images` length is within `model`'s `maxEditImages` (default 1-3 for Qwen), build an `AdapterRequest`, and dispatch.
- [ ] 2.3 Update the `ImageModelInstance`/capability type to carry `maxEditImages` (optional, default 3 for editable Qwen models); export `ImageEditRequest`/`ImageEditInput` from the package root.
- [ ] 2.4 Update the existing `image-dispatch.test.ts` so the `editImage NOT_IMPLEMENTED` assertion is replaced with a real-dispatch test (bound editable model → adapter.edit invoked) plus pre-flight `INVALID_REQUEST` tests for non-editable models and out-of-range image counts.

## 3. Qwen Synchronous Adapter (T2I + I2I)

- [ ] 3.1 Implement the Aliyun adapter `generate()` to switch on the model `family`: `qwen-multimodal` runs the sync T2I path; `wan-image` throws `NOT_IMPLEMENTED` without invoking the transport.
- [ ] 3.2 Build the Qwen T2I request: `POST {baseUrl}/services/aigc/multimodal-generation/generation` with `Authorization: Bearer {apiKey}` and body `{ model, input: { messages: [{ role: "user", content: [{ text: prompt }] }] }, parameters: { size?, n?, negative_prompt?, prompt_extend?, watermark?, seed? } }`; forward `n` only when `paramSupport` declares it; send via the injected (or default) shared `Transport`.
- [ ] 3.3 Map the Qwen sync response `output.choices[].message.content[].image` into `GenerationResult<ImageContent[]>` with `provider: "aliyun-bailian"`, the model id, `requestId` from `request_id`, and non-sensitive `usage` (width/height/image_count) into `raw`.
- [ ] 3.4 Implement the Aliyun adapter `edit()` for Qwen models: build the same endpoint/body as `generate()`, but set `content` to lead with 1-3 image entries (mapped from `images`: `url`→`{image:url}`, else `base64`→`{image:"data:"+(mimeType??"image/png")+";base64,"+base64}`) followed by one `{text:prompt}`.
- [ ] 3.5 On non-2xx responses, call `classifyHttpError(status, sanitizedMessage)` where the message is read from the Aliyun `{ code, message }` body (map `DataInspectionFailed`→`INVALID_REQUEST`, `Throttling`/429→`RATE_LIMITED`); on `TransportError` map `timeout`→`TIMEOUT`, `network`→`NETWORK_ERROR`; the API key SHALL NOT appear in messages or `cause`.

## 4. Contract Tests with Fake Transport

- [ ] 4.1 Add an `AliyunBailianConfig` test fixture and a fake-transport helper (reuse the Azure `createFakeTransport` pattern) under `packages/provider-aliyun-bailian/tests/`.
- [ ] 4.2 Add T2I adapter contract tests: assert the built request URL path (`multimodal-generation/generation`), `Authorization: Bearer` header, and body fields (`model`, `input.messages[].content[].text` prompt, `parameters.size`, `parameters.n` gating, `providerOptions.aliyun` forwarding of `negative_prompt`/`prompt_extend`/`watermark`).
- [ ] 4.3 Add I2I adapter contract tests: assert the `content` array leads with 1-3 image entries (URL and base64 forms) followed by exactly one text entry, in input order.
- [ ] 4.4 Add response mapping tests (T2I and I2I): `output.choices[].message.content[].image` maps to `ImageContent[]` with correct provider/model ids; multiple choices produce a multi-element array.
- [ ] 4.5 Add error classification tests: 401→`AUTH_ERROR` (non-retryable, no key in message), 429/`Throttling`→`RATE_LIMITED`, 400/`DataInspectionFailed`→`INVALID_REQUEST`, 5xx→`PROVIDER_ERROR`, transport timeout→`TIMEOUT`.
- [ ] 4.6 Add model-dispatch tests: `provider.image("qwen-image-2.0-pro")` binds; unknown model id throws `INVALID_REQUEST`; a Wan-family model id throws `NOT_IMPLEMENTED` on both `generate` and `edit` and the transport call count stays zero.
- [ ] 4.7 Add core edit-dispatch tests in `packages/ai-media-sdk/tests/`: `editImage` dispatches to `adapter.edit` for an editable model; rejects non-editable models and out-of-range image counts with `INVALID_REQUEST` before dispatch.

## 5. Verification and Documentation

- [ ] 5.1 Run `bun run lint` and resolve all new errors without changing the existing unrelated `Geist` warning.
- [ ] 5.2 Run `bun run typecheck` and verify runtime and test tsconfigs pass for `provider-aliyun-bailian` and `@ai-media/sdk`.
- [ ] 5.3 Run `bun run test` and verify all Aliyun T2I + I2I contract tests and core edit-dispatch tests pass without Provider credentials or external network access.
- [ ] 5.4 Run a non-mutating Prettier check for all changed files and resolve formatting differences.
- [ ] 5.5 Confirm no `openai` or DashScope runtime SDK dependency was added and the Aliyun package remains pure-fetch.
- [ ] 5.6 Confirm Phase 1 Azure tests and core `generateImage` tests still pass unchanged (no regression from shared-transport/classifier reuse or `editImage` core changes).
