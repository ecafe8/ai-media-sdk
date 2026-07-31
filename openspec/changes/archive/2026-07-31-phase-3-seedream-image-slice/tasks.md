## 1. Seedream Provider Package and Config

- [x] 1.1 Add the `packages/provider-seedream` workspace package (`@ai-media/provider-seedream`, `providerId` `"doubao-seedream"`) with `package.json` (dependency `@ai-media/sdk` `workspace:*`), `tsconfig.json`, `tsconfig.test.json`, and `eslint.config.js` mirroring `provider-aliyun-bailian`; register it under root `package.json` workspaces (already covered by `packages/*` glob).
- [x] 1.2 Define `SeedreamConfig` in `packages/provider-seedream/src/config/` requiring `apiKey: string` and `baseUrl: string`; document that `baseUrl` is the regional Ark API base and that the package supplies the `https://ark.cn-beijing.volces.com/api/v3` default.
- [x] 1.3 Export `SeedreamConfig`, the provider factory type, options type, and registry types from the package root `src/index.ts`.

## 2. Model Capability Registry and Provider Options

- [x] 2.1 Add an in-package model capability registry (`Record<ModelId, SeedreamModelEntry>` with `capabilities`, `paramSupport`, `outputFormats`) in `packages/provider-seedream/src/provider/registry.ts` covering `doubao-seedream-5-0-pro-260628` (edit, `maxEditImages` 10, `["png","jpeg"]`), `doubao-seedream-5-0-260128` + alias `doubao-seedream-5-0-lite-260128` (edit, `maxEditImages` 14, `["png","jpeg"]`), `doubao-seedream-4-5-251128` (edit, `maxEditImages` 14, `["jpeg"]`), and `doubao-seedream-4-0-250828` (edit, `maxEditImages` 14, `["jpeg"]`); export `SeedreamModelEntry`/`SeedreamParamSupport`/`SeedreamOutputFormat` types.
- [x] 2.2 Add `SeedreamImageProviderOptions` (`watermark?`, `output_format?`, `response_format?`, `optimize_prompt_options?: { mode }`) under the `providerOptions.seedream` namespace in `packages/provider-seedream/src/provider/options.ts`, mirroring the live Ark fields.
- [x] 2.3 Implement `provider.image(modelId)` to look up the registry, reject unknown model ids with `INVALID_REQUEST`, and return a bound `ImageModelInstance` carrying provider id, model id, adapter, and capabilities.

## 3. Seedream Synchronous Adapter (T2I + I2I)

- [x] 3.1 Implement the Seedream adapter `generate()` to build `POST {baseUrl}/images/generations` with `Authorization: Bearer {apiKey}` and body `{ model, prompt, size?, response_format? }` plus `providerOptions.seedream` native fields (`output_format`, `watermark`, `optimize_prompt_options`); omit the `image` field; send via the injected (or default) shared `Transport`.
- [x] 3.2 Implement the Seedream adapter `edit()` to build the same endpoint and body as `generate()`, adding the `image` field: a single string for one reference image, or a `string[]` for 1-N references preserving input order. Map each `ImageContent` to `url` or `data:{mime};base64,{base64}` (mime from `mimeType`, default `image/png`, lowercase).
- [x] 3.3 Map the synchronous response `data[]` into `GenerationResult<ImageContent[]>` with `provider: "doubao-seedream"`, the model id, `requestId` from `request_id` when present, and non-sensitive `usage` into `raw`; parse `data[].size` (`"WxH"`) into `width`/`height` best-effort.
- [x] 3.4 On non-2xx responses, call `classifyHttpError(status, sanitizedMessage)` where the message is read from the OpenAI-style `{ error: { code, message } }` body and redacted of the API key; on `TransportError` map `timeout`→`TIMEOUT`, `network`→`NETWORK_ERROR`; the API key SHALL NOT appear in messages or `cause`.

## 4. Contract Tests with Fake Transport

- [x] 4.1 Add a `SeedreamConfig` test fixture and a fake-transport helper (reuse the Azure/Aliyun `createFakeTransport` pattern) under `packages/provider-seedream/tests/`.
- [x] 4.2 Add T2I adapter contract tests: assert the built request URL path (`/images/generations`), `Authorization: Bearer` header, and body fields (`model`, `prompt`, `size`, `response_format`); assert no `image` field; assert `providerOptions.seedream` forwarding of `watermark`/`output_format`/`optimize_prompt_options`.
- [x] 4.3 Add I2I adapter contract tests: assert the `image` field is a single string for one input and a `string[]` in input order for 2-N inputs; assert URL and base64 (data-URI) forms.
- [x] 4.4 Add response mapping tests (T2I and I2I): `data[].url`/`data[].b64_json` map to `ImageContent[]` with correct provider/model ids; multiple `data[]` entries produce a multi-element array; `data[].size` parses to `width`/`height`.
- [x] 4.5 Add error classification tests: 401→`AUTH_ERROR` (non-retryable, no key in message), 429→`RATE_LIMITED`, 400→`INVALID_REQUEST`, 5xx→`PROVIDER_ERROR`, transport timeout→`TIMEOUT`, network→`NETWORK_ERROR`.
- [x] 4.6 Add model-dispatch tests: `provider.image("doubao-seedream-5-0-pro-260628")` and the other 3 ids bind; unknown model id throws `INVALID_REQUEST`.
- [x] 4.7 Confirm core `editImage` pre-flight rejects non-editable models and out-of-range image counts (zero or > `maxEditImages` 10/14) with `INVALID_REQUEST` before dispatch.

## 5. Example, Environment Template, and Playground Registration

- [x] 5.1 Add `examples/seedream-image/` with a minimal Node/Bun image-generation example using the unified SDK API, a `.env.example` (`ARK_API_KEY`, `ARK_BASE_URL` optional), and a documented run command; ensure no live calls in default verification.
- [x] 5.2 Register the Seedream provider and its 4 models in the `apps/web` playground capability registry (server-side config resolution), marking 组图/流式/联网搜索 as unsupported in this slice and filtering them from the form accordingly.

## 6. Verification and Integration

- [x] 6.1 Run `bun run lint` and resolve new errors without changing existing unrelated warnings.
- [x] 6.2 Run `bun run typecheck` across affected workspaces and verify strict/`noUncheckedIndexedAccess` boundaries for the new package and its tests.
- [x] 6.3 Run `bun run test` and verify all Seedream T2I + I2I contract tests and core dispatch tests pass without Provider credentials or external network access.
- [x] 6.4 Run `bun run build` and confirm the browser bundle contains no Provider credentials or server-only Provider construction imports.
- [x] 6.5 Run the repository formatter for all changed files, inspect the final diff, and confirm no durable storage, user-system, fallback, batch-generation, or new Provider SDK dependency was introduced.
