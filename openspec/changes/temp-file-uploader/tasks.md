## 1. Uploader Package Scaffolding

- [ ] 1.1 Create `packages/uploader/package.json` named `@ai-media/uploader` with subpath exports `./core`, `./aliyun`, `./google`, `private: true`, no `@ai-media/sdk` dependency, and the standard `lint`/`format`/`typecheck`/`test` scripts matching the provider-package convention.
- [ ] 1.2 Create `packages/uploader/tsconfig.json` extending `@workspace/typescript-config/node-library.json` and `tsconfig.test.json` extending `./tsconfig.json` with `types: ["node","bun"]`, mirroring the provider package configs.
- [ ] 1.3 Create `packages/uploader/eslint.config.js` copying the provider package's base config (with the `@typescript-eslint/no-unused-vars` warn rule).

## 2. Core Module

- [ ] 2.1 Implement `packages/uploader/src/core/types.ts` exporting `UploadedFile` (`url`, `mimeType?`, `sizeBytes?`, `expiresAt?`, `requiresHeaders?`) and `UploaderOptions` (`apiKey`, `baseUrl?`, `timeoutMs?`, `fetch?`).
- [ ] 2.2 Implement `packages/uploader/src/core/error.ts` exporting `UploaderError` (extends `Error` with `code`, `statusCode?`, `cause?`) and `as const` error-code constants (`INVALID_REQUEST`, `POLICY_ERROR`, `UPLOAD_ERROR`, `RATE_LIMITED`, `NOT_FOUND`, `INVALID_RESPONSE`, `UNKNOWN`).
- [ ] 2.3 Implement `packages/uploader/src/core/index.ts` re-exporting the types and error surface.
- [ ] 2.4 Implement `packages/uploader/src/index.ts` re-exporting `./core` only, keeping the package entry minimal.

## 3. Aliyun Uploader Module

- [ ] 3.1 Implement `packages/uploader/src/aliyun/constants.ts` with `ALIYUN_UPLOAD_BASE_URL`, the policy path, `ALIYUN_TTL_HOURS = 48`, and `ALIYUN_DEFAULT_TIMEOUT_MS`.
- [ ] 3.2 Implement `packages/uploader/src/aliyun/types.ts` exporting `AliyunUploaderOptions`, `AliyunUploadParams` (`model` required; `filePath` or `fileBytes`+`fileName`), `AliyunPolicyData` (camelCase-mapped fields), and `AliyunUploadedFile`.
- [ ] 3.3 Implement `packages/uploader/src/aliyun/get-policy.ts` performing `GET {baseUrl}/api/v1/uploads?action=getPolicy&model={model}` with `Authorization: Bearer {apiKey}`, mapping the snake_case `data` object to `AliyunPolicyData`, and classifying HTTP 429 → `RATE_LIMITED`, other non-2xx → `POLICY_ERROR`.
- [ ] 3.4 Implement `packages/uploader/src/aliyun/upload-oss.ts` building a `FormData` with the documented fields (`OSSAccessKeyId`, `Signature`, `policy`, `x-oss-object-acl`, `x-oss-forbid-overwrite`, `key`, `success_action_status`, `file` as the last field), POSTing to `policyData.uploadHost` via the injected `fetch`, classifying non-200 → `UPLOAD_ERROR`, and returning `oss://{upload_dir}/{fileName}`.
- [ ] 3.5 Implement `packages/uploader/src/aliyun/index.ts` exporting `createAliyunUploader(options): AliyunUploader` whose `upload(params)` validates `model` and the file source (throw `INVALID_REQUEST`), reads `filePath` via Node `fs/promises` when needed, calls the policy then OSS steps, and returns `AliyunUploadedFile` with `expiresAt = now + 48h` and `requiresHeaders = { "X-DashScope-OssResourceResolve": "enable" }`.

## 4. Google Uploader Module

- [ ] 4.1 Implement `packages/uploader/src/google/constants.ts` with the Files API base URL, upload/list paths, `GOOGLE_TTL_HOURS = 48`, default timeout, and max file bytes.
- [ ] 4.2 Implement `packages/uploader/src/google/types.ts` exporting `GoogleUploaderOptions`, `GoogleUploadParams`, `GoogleUploadedFile`, and the `GoogleUploader` interface (`upload`/`get`/`list`/`delete`).
- [ ] 4.3 Implement `packages/uploader/src/google/upload.ts` performing the resumable start request (parse the `X-Goog-Upload-URL` response header) then the upload+finalize POST with raw bytes, mapping the response to `GoogleUploadedFile` (`name`, `url`, `state`).
- [ ] 4.4 Implement `packages/uploader/src/google/lifecycle.ts` with `get(name)`, `list()` as an async iterable following `nextPageToken`, and `delete(name)`; classify HTTP 404 → `NOT_FOUND`.
- [ ] 4.5 Implement `packages/uploader/src/google/index.ts` exporting `createGoogleUploader(options): GoogleUploader` that validates `mimeType` when `fileBytes` is used and wires the upload and lifecycle functions.

## 5. Aliyun Provider Adapter Change

- [ ] 5.1 Add a private `hasOssUrl(body)` helper to `packages/provider-aliyun-bailian/src/provider/index.ts` that scans all string values in the mapped request body for the `oss://` prefix.
- [ ] 5.2 Conditionally inject `X-DashScope-OssResourceResolve: enable` into the headers of `sendQwenRequest`, `submitVideoTask`, `submitWanImageTask`, and the r2v/video-edit submission path when `hasOssUrl(body)` is true.

## 6. Uploader Example

- [ ] 6.1 Create `examples/uploader-aliyun/package.json` named `@ai-media/example-uploader-aliyun`, `private: true`, depending on `@ai-media/uploader` and `@ai-media/provider-aliyun-bailian`, with `start` and `test` scripts.
- [ ] 6.2 Implement `examples/uploader-aliyun/src/config.ts` loading `ALIYUN_BAILIAN_API_KEY`, optional `ALIYUN_BAILIAN_BASE_URL`, the model name, and the local image path from env/CLI args, with a missing-config guard that exits without a network call.
- [ ] 6.3 Implement `examples/uploader-aliyun/src/index.ts` that uploads the local file via `createAliyunUploader`, then calls the unified image-generation API with the `oss://` URL against a Qwen-VL model, and prints the model response or a sanitized error.
- [ ] 6.4 Create `examples/uploader-aliyun/.env.example` documenting the required variables and stating the 48-hour expiry and the 100 QPS Aliyun policy rate limit with a production-use warning.

## 7. Tests

- [ ] 7.1 Add `packages/uploader/tests/core/error.test.ts` covering `UploaderError` fields and the error-code constants.
- [ ] 7.2 Add `packages/uploader/tests/aliyun/aliyun-uploader.test.ts` with a mocked `fetch` covering: successful upload (policy → OSS → `oss://` URL), missing `model`/file-source rejection, 429 → `RATE_LIMITED`, policy non-2xx → `POLICY_ERROR`, OSS non-200 → `UPLOAD_ERROR`, and `requiresHeaders`/`expiresAt` correctness.
- [ ] 7.3 Add `packages/uploader/tests/google/google-uploader.test.ts` with a mocked `fetch` covering: resumable start → finalize → URI, missing `mimeType` rejection, `get`, `list` pagination, `delete`, and 404 → `NOT_FOUND`.
- [ ] 7.4 Add `packages/provider-aliyun-bailian/tests/aliyun-oss-resolve-header.test.ts` asserting `X-DashScope-OssResourceResolve: enable` is present when an `oss://` URL is in the body and absent for `https://`/`data:` URLs, across the Qwen image edit, HappyHorse video submit, and Wan image submit paths.
- [ ] 7.5 Add `examples/uploader-aliyun/tests/*.test.ts` offline tests covering configuration parsing, the missing-config guard, and request-construction assertions without real network calls.

## 8. Workspace Wiring and Verification

- [ ] 8.1 Add `GEMINI_API_KEY` to `turbo.json` `globalEnv` for Google uploader tests/examples (`ALIYUN_BAILIAN_API_KEY` is already present).
- [ ] 8.2 Run `bun run format` on all changed files and inspect the diff for accidental scope expansion or credential exposure.
- [ ] 8.3 Run `bun run lint` and resolve only errors introduced by this change.
- [ ] 8.4 Run `bun run typecheck` across the uploader, Aliyun provider, and example workspaces.
- [ ] 8.5 Run `bun run test` and verify all new tests pass without Provider credentials or external network access.
- [ ] 8.6 Run `bun run build` and confirm the build succeeds with no credential exposure.
