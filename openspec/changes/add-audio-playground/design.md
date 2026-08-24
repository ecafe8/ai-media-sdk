## Context

The core SDK and Alibaba provider already expose `generateAudio()`, `AudioModelInstance`, CosyVoice request mapping, URL/Base64 audio normalization, and SSML pass-through. The `apps/web` Playground currently has audio in its top-level modality union but projects audio registry entries as images and has no audio request, form, API, or result path. The site is a browser-side BYO-key application, while the web Playground is server-proxied and keeps provider credentials on the server.

## Goals / Non-Goals

**Goals:**

- Add a complete first-slice audio path to the server-proxied web Playground.
- Reuse the existing SDK/provider contracts and Alibaba credential resolution.
- Make SSML and LaTeX pass-through explicit and lossless.
- Keep model-aware controls and audio result handling separate from image/video behavior.
- Publish synchronized Chinese and English documentation.

**Non-Goals:**

- No WebSocket realtime TTS or streaming playback in this change.
- No browser-side `apps/site` TTS execution until CORS and BYO-key behavior are separately approved.
- No SSML parser, LaTeX parser, formula renderer, formula validator, or automatic XML escaping of user text.
- No voice cloning/design UI, audio editing, or automatic persistence of temporary provider URLs.
- No broad exposure of every Alibaba TTS family in the initial UI; CosyVoice is the first supported slice.

## Decisions

### Use the web Playground as the first execution surface

Audio requests will use the existing `apps/web` API route and server executor. This preserves the repository's server-side credential boundary and avoids making public site behavior depend on Alibaba endpoint CORS configuration. `apps/site` will receive documentation only in this change; its model projection must not imply that browser execution is available.

### Add a distinct audio workbench and request shape

Audio gets its own form and result branch rather than reusing image `prompt` or video `audioSetting`. The request carries explicit `text`, `voice`, and audio controls. This prevents video audio settings from being accidentally sent as TTS options and makes required TTS inputs visible in the type system.

### Start with CosyVoice registry entries

The web registry projection will preserve `modality: "audio"` and expose a deliberately selected CosyVoice allowlist for the first UI slice: `cosyvoice-v3.5-flash`, `cosyvoice-v3.5-plus`, `cosyvoice-v3-flash`, `cosyvoice-v3-plus`, and `cosyvoice-v2`. The implementation must record the documented Beijing-region and voice/SSML constraints as capability metadata or validation rules. Qwen-TTS and MiniMax TTS remain provider capabilities but are deferred because their option families and endpoint behavior differ. `apps/site` will not project these models as runnable audio models in this change. Future additions should extend registry metadata and form families instead of adding provider-specific conditionals to the generic audio path.

### Preserve caller text exactly

The form submits SSML and LaTeX as ordinary text. The API validates presence and supported modality but does not transform content. The provider's existing `enableSsml` option is sent only when selected. LaTeX backslashes are escaped by the JSON transport as required by the language runtime, not rewritten as a formula-specific operation.

### Normalize playback at the application boundary

The web response will carry normalized `AudioContent[]`. The first UI slice will offer directly playable `mp3` and `wav` formats. PCM and any format without a browser-playable container will be download-only or rejected by the form. The result feed will render provider URLs directly and construct `data:<mime>;base64,...` URLs for inline data. It will show download controls where possible and a temporary-link warning without attempting server-side caching or transcoding.

### Protect the server-proxied endpoint

The API route will enforce a maximum 64 KiB JSON request body, a maximum 10,000-character text value, the configured provider timeout, and a rate limit of five audio generations per client per minute through the deployment's shared rate-limit mechanism. If the shared mechanism is not available in the target deployment, the feature MUST remain disabled rather than silently falling back to an ineffective process-local limiter. It will reject invalid or oversized requests before provider dispatch, avoid automatic retries for non-idempotent generation, and return sanitized errors. Provider credentials and authorization headers remain server-only and are never included in response payloads or logs. These limits must be represented as named constants and covered by route tests.

### Keep documentation examples in code blocks

The site currently has no KaTeX/MathJax pipeline. SSML and LaTeX examples will therefore be presented in fenced code blocks, with escaped source-string examples, rather than relying on documentation-time mathematical rendering.

### Alternatives considered

- **Implement both playgrounds immediately:** rejected because browser-side credentials and CORS introduce a separate security and deployment decision.
- **Reuse the image prompt field:** rejected because it obscures TTS semantics and makes validation less precise.
- **Parse or sanitize SSML/LaTeX locally:** rejected because Alibaba owns the supported grammar and rewriting can change pronunciation.
- **Expose every audio model now:** rejected because Qwen-Audio/CosyVoice, Qwen-TTS, and MiniMax use incompatible option families.

## Risks / Trade-offs

- [Risk] Temporary audio URLs expire before a user replays them. → Show expiry/persistence guidance and provide immediate download where supported.
- [Risk] Base64 audio may be large for a browser response. → Keep the first slice non-streaming and avoid duplicating the payload in client state unnecessarily.
- [Risk] A public generation endpoint can be abused to consume provider quota. → Enforce request-size, text-length, timeout, and rate-limit boundaries before dispatch; do not add automatic retries.
- [Risk] Users enter unsupported SSML tags or LaTeX syntax. → Preserve text and document provider/model limits; surface sanitized provider errors.
- [Risk] Registry metadata and live Alibaba model availability drift. → Use the existing explicit registry and add projection/validation tests for the selected allowlist.
- [Risk] Existing image/video branches regress while adding audio. → Keep modality branches discriminated and run focused plus full repository verification.

## Migration Plan

1. Extend web types, registry projection, API validation, server selection, and executor for audio.
2. Add the CosyVoice audio workbench and result rendering.
3. Add focused registry, API, executor, and result tests.
4. Add bilingual documentation and manifest navigation.
5. Run lint, typecheck, build, test, and strict OpenSpec validation.

Rollback requires removing the audio UI/API branch and its registry projection; existing image/video and provider SDK behavior remain independent.

## Open Questions

None for this first implementation slice. Browser-side site execution and additional TTS families require a separate scope decision.
