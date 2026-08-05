## Context

The SDK core (`packages/ai-media-sdk`) exposes a `Transport` boundary that intentionally handles only JSON or string bodies — it does not support `multipart/form-data` or `FormData`. The media-input contract (`ImageContent`/`VideoContent`) accepts only `url` or `base64`, and every PRD/OpenSpec decision to date defers temporary-file upload, multipart handling, and SSRF-safe URL fetching as non-goals. Provider packages route all generation calls through the shared `Transport`. The Aliyun Bailian adapter builds request bodies that embed image/video URLs as plain strings via `mapImageContent` → `toImageUrl`, then sets headers per request builder (`sendQwenRequest`, `submitVideoTask`, `submitWanImageTask`, r2v/video-edit submission).

Aliyun DashScope's temporary upload is a three-step REST flow against `https://dashscope.aliyuncs.com/api/v1/uploads` (get policy) followed by a multipart POST to an OSS host; the resulting `oss://` URL requires an `X-DashScope-OssResourceResolve: enable` header on every downstream model call. Google Gemini's Files API uses a resumable protocol against `https://generativelanguage.googleapis.com` and returns a standard `https://` URI with list/get/delete lifecycle. Neither flow fits the existing `Transport` contract.

## Goals / Non-Goals

**Goals:**

- Make local-file-driven multimodal calls ergonomic during development and testing without standing up durable storage.
- Keep the core SDK contract (`Transport`, `ImageContent`/`VideoContent`, `ProviderAdapter`) unchanged in observable behavior.
- Let callers use Aliyun temporary URLs end-to-end without manually managing the `X-DashScope-OssResourceResolve` header.
- Allow the uploader to be consumed independently of the generation SDK (e.g. a test harness that only needs an `oss://` URL).

**Non-Goals:**

- Production-grade storage, high-concurrency upload, or load-test support.
- Extending the core `Transport` to support `FormData` or resumable uploads.
- SSRF-safe public-URL fetching/downloading or local media transcoding/inspection.
- Azure OpenAI `/images/edits` multipart editing (a different mechanism, out of scope).
- Web/Playground file-upload UI (a separate slice).
- Long-term URL persistence or renewal; both providers expire URLs in 48 hours.

## Decisions

### Decision D1: Standalone `@ai-media/uploader` package, decoupled from `@ai-media/sdk`

**Rationale:** The uploader is a dev/test convenience tool, not a core capability. Coupling it to the core would pull `Transport`/`ProviderAdapter` types into every consumer, and would pressure the `Transport` contract to support `FormData` it deliberately excludes. Decoupling lets a test harness import only `@ai-media/uploader/aliyun` without the generation SDK. The existing `examples/*/src/save.ts` precedent already uses raw `fetch` for dev-only download outside the `Transport`.

**Alternatives considered:**
- *Add an upload module inside `@ai-media/provider-aliyun-bailian`*: rejected because it mixes "generation" and "upload" concerns, couples upload to a provider package, and would require consumers to import the provider package just to upload. The user explicitly framed this as a standalone dev convenience.
- *Extend the core `@ai-media/sdk` with a `FileUploader` contract*: rejected because it would make every provider package own an upload contract surface, contradicting the deferred-scope decision and forcing providers that have no temp-upload API (Azure, Seedream) to declare stubs.

### Decision D2: Subpath exports (`./core`, `./aliyun`, `./google`) in a single package

**Rationale:** One package is easy to discover and version; subpath exports avoid bundling the Google implementation for Aliyun-only consumers (and vice versa), matching the `packages/ui` subpath-export convention already used in the repo. Shared `core` types stay tiny (`UploadedFile`, `UploaderError`, error codes) so no leaky abstraction is forced.

**Alternatives considered:**
- *Two packages `@ai-media/uploader-aliyun` and `@ai-media/uploader-google`*: more decoupled but duplicates the shared `core` types and config boilerplate, and the user chose the single-package option.
- *A unified `upload(file, provider)` interface*: rejected because DashScope (model-bound, no lifecycle) and Gemini (model-agnostic, with list/get/delete) have irreconcilable capability surfaces; a single interface would be a leaky abstraction.

### Decision D3: Bypass `Transport`; use raw `fetch` with `FormData` inside the uploader

**Rationale:** `Transport.send` serializes bodies via `JSON.stringify` for non-strings and parses responses as JSON or text; it has no `FormData`/resumable path, and adding one would change the core contract for a dev-only concern. The Aliyun OSS multipart POST and Google resumable upload are uploader-internal implementation details. A per-uploader injectable `fetch` (default `globalThis.fetch`) keeps tests hermetic via Bun's mock API, mirroring how `examples/*/src/save.ts` already uses raw `fetch` outside `Transport`.

**Alternatives considered:**
- *Extend `Transport` with a `sendFormData` method*: rejected; it bloats the core contract for a non-core concern and every provider would inherit an unused capability.
- *Add a separate `UploadTransport` to the core*: rejected for the same coupling reason.

### Decision D4: `oss://` header auto-injection via a `hasOssUrl(body)` helper in the Aliyun adapter

**Rationale:** The Aliyun adapter already builds `headers` per request builder. A small private helper that scans the mapped request body for any string value starting with `oss://` lets each builder conditionally set `headers["X-DashScope-OssResourceResolve"] = "enable"`. Conditional (not constant) injection keeps non-`oss://` requests byte-identical to today, which makes the behavior testable and avoids unintended side effects. The helper scans body strings generically so it covers Qwen image content (`image`), video first-frame/reference/input-video URLs, and any future path without per-path changes.

**Alternatives considered:**
- *Always inject the header on Aliyun requests*: simplest, but the header is documented as an `oss://` resolver; always-on changes behavior for every request and makes contract assertions weaker. Rejected.
- *Return `requiresHeaders` from the uploader and require callers to pass them through `generateImage`*: rejected because `ImageContent` and the generation entry points have no custom-header pass-through channel, so callers literally could not honor `requiresHeaders` today. Auto-injection is the only path that makes the end-to-end flow work.
- *Add a custom-header pass-through to `ImageContent`/`generateImage`*: rejected; it changes the core contract for a dev convenience and still burdens every caller.

### Decision D5: Google uses the resumable protocol for all uploads

**Rationale:** The resumable protocol (start → upload+finalize) is the documented Gemini path and works for any file size; a separate single-shot path would add branching for marginal complexity savings. Resumable also makes the mock surface stable (two sequential `fetch` calls), which keeps tests simple.

**Alternatives considered:**
- *Single-shot `POST` for files under a threshold*: marginal benefit, adds a code path and a threshold decision with no documentation backing. Rejected.

### Decision D6: File input accepts both `filePath` (Node `fs`) and `fileBytes` (in-memory)

**Rationale:** Node callers have local paths; test harnesses and browser-adjacent callers may have `Uint8Array`. Supporting both avoids forcing a temp-file write. `filePath` uses Node's `fs/promises` `readFile`; `fileBytes` skips the filesystem. `fileName` is required when `fileBytes` is used (DashScope's `key` and Google's upload both need a name).

**Alternatives considered:**
- *`filePath` only*: rejected; it forces a temp write for in-memory bytes and complicates test mocks.

## Risks / Trade-offs

- **[Aliyun 100 QPS rate limit is not expandable]** → Documented as dev/test-only in specs, `.env.example`, and example docs; production callers are directed to durable OSS. The uploader does not add retry beyond a single re-fetch on a transient policy failure.
- **[48-hour URL expiry silently breaks deferred generation]** → `UploadedFile.expiresAt` is always set; the example prints the expiry; specs forbid claiming long-term availability.
- **[Aliyun files cannot be queried/deleted]** → The Aliyun uploader exposes only `upload`; no list/get/delete surface exists, matching the provider's actual capability.
- **[Model binding mismatch (upload model ≠ call model) returns a provider error]** → The uploader takes `model` at upload time and the example documents that it must match the call model; the uploader cannot validate this client-side because the call model is not known at upload time.
- **[`oss://` detection scans all body string values]** → A cheap prefix scan over mapped body strings; risk of false positives is negligible because only `oss://` is matched and it is not a legitimate value elsewhere.
- **[Raw `fetch` bypasses `Transport` retry/timeout]** → The uploader takes its own `timeoutMs` (default 30s) via `AbortSignal.timeout`; retry is intentionally minimal because the policy endpoint is rate-limited and retries worsen 429s.
