## Why

The SDK contract accepts only `url` or `base64` media input and explicitly defers temporary-file upload, multipart handling, and URL lifecycle to callers. For development and testing this is friction: callers must stand up durable storage (OSS, GCS) just to feed a local image to a multimodal model. Aliyun DashScope and Google Gemini both offer free 48-hour temporary-file upload APIs that remove this friction during iteration, but each has a distinct protocol (DashScope's 3-step `getPolicy` → OSS multipart → `oss://` URL with a mandatory resolution header; Gemini's resumable Files API with lifecycle management). A dedicated, dev/test-only uploader package keeps the core SDK contract clean while making local-file-driven provider calls ergonomic.

## What Changes

- Add a new `@ai-media/uploader` workspace package with subpath exports `./core`, `./aliyun`, and `./google`, decoupled from `@ai-media/sdk` and bypassing the core `Transport` (multipart is out of `Transport`'s contract).
- Implement the Aliyun DashScope temporary-upload flow: `GET /api/v1/uploads?action=getPolicy&model=...` → multipart `POST` to the returned OSS host → `oss://{upload_dir}/{fileName}` URL, returning `{ url, expiresAt, requiresHeaders: { "X-DashScope-OssResourceResolve": "enable" } }`.
- Implement the Google Gemini Files API: resumable `start` → `upload, finalize` → `{ name, uri }`, plus `get`/`list`/`delete` lifecycle, returning a standard `https://` URI with 48-hour expiry.
- Define a minimal shared `UploadedFile` contract and `UploaderError` error surface in `./core`; provider-specific implementations retain their full capability surface (DashScope's model binding, Gemini's lifecycle) without forcing a leaky unified interface.
- Extend the Aliyun Bailian provider adapter to detect `oss://` URLs in any image/video request body and automatically inject `X-DashScope-OssResourceResolve: enable`, so callers that pass an uploaded `oss://` URL to `generateImage`/`editImage`/`submitImageTask`/`submitVideoTask` work without manually managing headers.
- Add an `examples/uploader-aliyun` runnable Node.js example demonstrating the full upload-then-generate round-trip against a local image file and a Qwen-VL model, with `.env.example`, missing-config guard, and offline tests.
- Document the dev/test-only positioning and the 48-hour expiry, and explicitly scope out production storage, SSRF-safe URL fetching, and Azure `/images/edits` multipart from this change.

## Capabilities

### New Capabilities

- `temp-file-uploader`: A dev/test-only `@ai-media/uploader` package that uploads local files to Aliyun DashScope and Google Gemini temporary storage and returns provider-specific temporary URLs with expiry metadata and required downstream headers.

### Modified Capabilities

- `provider-package-foundation`: Extend the Aliyun adapter with automatic `X-DashScope-OssResourceResolve: enable` header injection when any `ImageContent`/`VideoContent` URL in a request body uses the `oss://` scheme, so temporary-upload URLs are transparently resolved by the provider.
- `examples-workspace`: Add a runnable `examples/uploader-aliyun` example demonstrating local-file upload followed by a Qwen-VL image-generation call, and constrain uploader examples to dev/test use only (not for production, not for high-concurrency or load-test scenarios).

## Impact

- New package: `packages/uploader/` with `package.json` (subpath exports, no `@ai-media/sdk` dependency), `tsconfig.json`/`tsconfig.test.json` extending `@workspace/typescript-config/node-library.json`, `eslint.config.js`, and `src/{core,aliyun,google}/` modules plus `tests/`.
- Aliyun provider: `packages/provider-aliyun-bailian/src/provider/index.ts` gains a `hasOssUrl` helper and conditional header injection in `sendQwenRequest`, `submitVideoTask`, `submitWanImageTask`, and the r2v/video-edit submission paths; new contract test asserting the header is present for `oss://` and absent otherwise.
- Example: `examples/uploader-aliyun/` with `package.json` (depends on `@ai-media/uploader` and `@ai-media/provider-aliyun-bailian`), `src/{config.ts,index.ts}`, `.env.example`, and offline tests.
- Workspace wiring: `turbo.json` `globalEnv` adds `GEMINI_API_KEY` for Google uploader tests/examples; `ALIYUN_BAILIAN_API_KEY` already present.
- No new runtime dependency, no external Provider SDK, no persistent storage, no webhook, no real-network CI test. No changes to the core `Transport` or `ImageContent`/`VideoContent` contracts.
