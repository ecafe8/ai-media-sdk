## Context

The Alibaba provider already implements `generateAudio()`, `streamAudio()`, CosyVoice/Qwen-Audio/Qwen-TTS/MiniMax request mapping, and `voiceCloning` / `voiceDesign` managers. Both Playgrounds still hard-code audio as a disabled tab: `apps/web` projects non-video Alibaba models as images, and `apps/site` drops audio families entirely. The web app is a server-proxied Playground; the site is a browser-direct BYO-key app. Aliyun temporary uploads already exist in `@ai-media/uploader`, but the public factory imports Node `fs` and cannot be used as-is from the site bundle.

See `proposal.md` for motivation and the capability specs for observable behavior.

## Goals / Non-Goals

**Goals:**

- Enable a complete audio path in both Playgrounds without changing image/video contracts.
- Drive forms from registry family metadata rather than ad-hoc model-id conditionals.
- Reuse existing SDK/provider audio and voice-resource APIs.
- Support public URL and local-file inputs for cloning/design through the existing Aliyun uploader.
- Make SSE streaming playable without treating PCM chunks as complete files.
- Keep web credentials server-only and site credentials browser-local.

**Non-Goals:**

- No WebSocket realtime TTS.
- No MiniMax voice cloning/design manager.
- No SSML/LaTeX parser, renderer, validator, or automatic XML escaping of user text.
- No automatic persistence or refresh of temporary result/upload URLs.
- No KaTeX/MathJax documentation renderer.
- No shared audio UI package extraction unless an existing shared primitive already covers the need.

## Decisions

### Dual execution surfaces with the same request shape

Both apps use an explicit audio request: `text`, `voice`, `model`, `family`, and `providerOptions.aliyun`. Image `prompt` and video `audioSetting` are not reused.

- `apps/web` adds server routes for generate, stream, upload, and voice resources. The browser never calls DashScope directly.
- `apps/site` extends `executeSiteRequest` / `buildSiteProvider` to call `provider.audio()`, `streamAudio()`, and the voice managers with the stored key.

Credential handling stays as-is: web may use env or per-request BYO credentials that are proxied and not persisted server-side; site keeps keys in the existing local key store.

### Registry metadata drives the workbench

Extend Alibaba audio registry entries with Playground-facing capability data instead of inferring options from model-id prefixes:

- family: `qwen-audio-tts` | `qwen-tts` | `minimax-tts`
- region/endpoint family
- SSML support
- supported formats and sample rates
- instruction field name (`instruction` vs `instructions`)
- voice-resource protocol (`qwen-audio` vs `qwen`) when a model can be a cloning/design target

Web and site projections both keep `modality: "audio"`. Site no longer filters audio families out.

First implementation exposes the current registry allowlist:

- CosyVoice: `cosyvoice-v3.5-flash`, `cosyvoice-v3.5-plus`, `cosyvoice-v3-flash`, `cosyvoice-v3-plus`, `cosyvoice-v2`
- Qwen-Audio: `qwen-audio-3.0-tts-plus`, `qwen-audio-3.0-tts-flash`
- Qwen-TTS: `qwen3-tts-flash`, dated flash/instruct snapshots, and legacy `qwen-tts*`
- MiniMax: `MiniMax/speech-2.8-hd`, `MiniMax/speech-02-hd`, `MiniMax/speech-2.8-turbo`, `MiniMax/speech-02-turbo`

v3.5 CosyVoice entries remain cloning/design-oriented where the provider documents no system voices.

### Pass text through exactly

The form submits SSML and LaTeX as the `text` field. Validation checks presence, length, modality, and supported options only. `enableSsml` is sent only for supporting CosyVoice/Qwen-Audio models. JSON string escaping is a transport concern, not a formula rewrite.

### Streaming uses native fetch and two playback modes

Do not add a third-party PCM player. `wavesurfer.js` may be considered later for complete-file waveforms, but it does not consume SSE PCM chunks and is not part of this change.

Transport:

- Web: `POST /api/playground/audio/stream` returns `text/event-stream` and forwards `streamAudio()` events. Client abort cancels the provider stream.
- Site: browser `fetch(..., { method: "POST", signal })` plus `ReadableStream` parsing. `EventSource` is rejected because it cannot send POST bodies or BYO headers.

Playback:

1. Default compatibility mode: accumulate `sentence-synthesis` PCM/Base64 chunks, wrap them as a WAV Blob after `complete` or after enough metadata is known, then use `<audio controls>`.
2. Optional low-latency mode: after a user gesture, decode PCM into `AudioBuffer`s and schedule them on `AudioContext`. Cancellation stops further scheduling.

Streaming events must carry or inherit `format`, `sampleRate`, `channels`, and `bitDepth`. If the current SDK event cannot represent that metadata, extend `AudioContent` / stream events in the smallest compatible way. Raw PCM MUST NOT be assigned to `<audio src>`.

### Upload reuses Aliyun temporary OSS and stays model-bound

Cloning/design accept either:

- a public HTTP(S) URL, or
- a local file uploaded to DashScope temporary OSS

The Aliyun uploader already requires `model` and returns `oss://` plus `X-DashScope-OssResourceResolve: enable`. The Alibaba adapter already injects that header when it sees `oss://`.

Web path:

```text
browser file -> POST /api/playground/audio/upload -> createAliyunUploader().upload({ model, fileBytes, fileName }) -> oss:// URL
```

Site path:

Extract or add a browser-safe Aliyun upload entry that uses `fileBytes` / `File.arrayBuffer()` and does not import `node:fs/promises`. The current `packages/uploader/src/aliyun/index.ts` factory is Node-oriented and cannot be imported by the site bundle as-is.

Upload validation:

- required target model
- filename
- allowlisted audio MIME/extension (`wav`, `mp3`, `m4a` where documented)
- maximum file size from the policy or a named constant
- no automatic retry of a successful upload

### Voice resources stay as two managers

UI has two panels, not one generic “voice CRUD”:

- Cloning: protocol, target model, URL or upload, Qwen-Audio `prefix` or Qwen `preferredName`, language/hints, list/get/update/delete
- Design: protocol, target model, `voicePrompt`, `previewText`, naming, language, sample rate, response format, preview-audio playback, list/get/delete

Created voice ids can be copied into the TTS `voice` field only for the same `targetModel`. Design never emits `update_voice`. MiniMax preview-clone remains out of scope.

### Protect the public web surface

Named limits:

- JSON body: 64 KiB
- text: 10,000 characters
- timeout: existing `PLAYGROUND_PROVIDER_TIMEOUT_MS`
- rate: 5 audio operations per client per minute through a shared limiter

Audio generate/stream/upload/voice routes stay disabled if the shared limiter is unavailable. Do not add a process-local fallback. Do not automatically retry generate/stream/create. Sanitize errors and logs.

Site does not get a project-operated proxy in this change. Its protections are complete credentials, endpoint allowlist/confirmation, CORS-visible errors, and client-side validation.

### Documentation stays in code blocks

SSML and LaTeX examples are fenced code blocks. Docs distinguish:

- SDK pass-through versus Playground playback
- HTTP SSE versus WebSocket realtime
- web server proxy versus site BYO-key/CORS
- `mp3`/`wav` playback versus PCM accumulate-to-WAV

## Risks / Trade-offs

- [Risk] DashScope workspace endpoints may lack browser CORS. → Document the standard DashScope endpoint for site use; keep web server-proxied as the reliable path.
- [Risk] Node `fs` in the Aliyun uploader breaks the site bundle. → Add or extract a `fileBytes`-only browser entry; keep `filePath` for Node/examples.
- [Risk] PCM chunks are not playable files. → Default to accumulate-to-WAV; never assign raw PCM to `<audio src>`.
- [Risk] Stream events omit sample rate. → Extend stream metadata or inherit the requested sample rate; fail closed to complete-result fallback.
- [Risk] Temporary `oss://` and result URLs expire. → Show expiry and require re-upload/re-generate; do not cache provider objects server-side.
- [Risk] A public web audio endpoint can consume quota. → Enforce body/text/timeout/shared rate limits; disable audio when the shared limiter is missing.
- [Risk] Family option mixing corrupts requests. → Validate and serialize only the selected family's fields.
- [Risk] Local uploads are large. → Enforce MIME/size limits and model binding before policy/OSS calls.

## Migration Plan

1. Extend registry metadata and Playground types/projections in both apps.
2. Add web generate/stream/upload/voice routes and site executor/provider-client branches.
3. Add AudioWorkbench, result/stream players, and cloning/design panels.
4. Extract a browser-safe Aliyun upload surface and wire local-file inputs.
5. Add bilingual docs and tests for registry, API, executor, upload, stream playback, and voice resources.
6. Run lint, typecheck, build, test, and `openspec validate "add-audio-playground" --type change --strict`.

Rollback is removing the audio UI/API branches and browser upload export. Image/video paths and existing SDK audio APIs remain independently usable.

## Open Questions

None. Browser-safe upload will be an additional export or internal split of `@ai-media/uploader/aliyun`, not a new provider. Low-latency Web Audio playback is optional and must not replace accumulate-to-WAV as the default.
