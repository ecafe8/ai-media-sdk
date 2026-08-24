## Context

The core SDK already has modality-neutral adapter, model, result, error, and Transport contracts. It implements image and video entry points, while `audio` exists only as a reserved modality. The Alibaba provider already centralizes regional authentication, request serialization, HTTP error classification, and model registry projection. The new capability must fit those boundaries without introducing a DashScope runtime SDK.

The Alibaba APIs use two protocol families. Qwen-Audio-TTS/CosyVoice uses `voice-enrollment` with actions such as `create_voice`, `list_voice`, `query_voice`, and `delete_voice`; Qwen uses separate `qwen-voice-enrollment` and `qwen-voice-design` models with shorter actions such as `create`, `list`, `query`, and `delete`. TTS generation uses either `SpeechSynthesizer` or the multimodal generation endpoint. The supported model matrix must distinguish these protocols rather than treating `voice-enrollment` as cloning only.

## Goals / Non-Goals

**Goals:**

- Add a strongly typed audio generation path compatible with the existing model-instance and adapter architecture.
- Keep cloning and design as separate resource managers despite their shared Alibaba endpoint.
- Normalize provider field-name differences while retaining raw responses for provider-specific details.
- Perform validation before Transport dispatch and preserve credential/error sanitization.
- Reuse the current Aliyun configuration, Transport, retry, and error boundaries.

**Non-Goals:**

- No browser Playground integration or credential persistence changes.
- No MiniMax voice manager; its preview-oriented voice clone API requires a separate capability. MiniMax non-realtime TTS is included.
- No WebSocket realtime audio API, server-side audio persistence, URL refresh, or cross-process voice cache. HTTP SSE streaming TTS is included; WebSocket realtime APIs are not.
- No automatic upload of local reference audio; callers may use the existing uploader or provide a public/Data URL accepted by the selected API.

## Decisions

### Separate audio generation from voice resources

Add `generateAudio()` and an `AudioModelInstance` for TTS. Add `voiceCloning` and `voiceDesign` managers for persistent voice resources. A single `provider.voice` manager was rejected because it makes cloning/design operation support ambiguous and would incorrectly suggest that design voices can be updated.

### Use one normalized voice record with operation-specific results

Map Alibaba `voice_id` and `voice` to `VoiceProfile.id`, and map snake-case timestamps, target model, language, status, prompt, and preview text to camel-case SDK fields. Voice design creation returns a `VoiceDesignResult` containing both the profile and `AudioContent` preview. Clone and design managers share list/get/delete record types but expose only the operations supported by their protocols.

### Treat Alibaba protocol selection as registry metadata

Add distinct registry families for Qwen-Audio/CosyVoice TTS, Qwen-TTS, MiniMax TTS, Qwen-Audio voice cloning/design, and Qwen voice cloning/design. Each entry identifies model ID, stable/snapshot status, supported region, endpoint family, supported operations, language behavior, voice capability requirements, formats, sample rates, and text/name limits. The adapter uses this metadata for dispatch and preflight validation rather than inferring protocol from arbitrary input fields.

The initial non-realtime matrix includes:

| Family | Models | Endpoint/region |
| --- | --- | --- |
| Qwen-Audio-TTS | `qwen-audio-3.0-tts-plus`, `qwen-audio-3.0-tts-flash` | `audio/tts/SpeechSynthesizer`, Beijing |
| CosyVoice | `cosyvoice-v3.5-plus`, `cosyvoice-v3.5-flash`, `cosyvoice-v3-plus`, `cosyvoice-v3-flash`, `cosyvoice-v2` | `audio/tts/SpeechSynthesizer`, Beijing |
| Qwen3-TTS | `qwen3-tts-flash`, `qwen3-tts-flash-2025-11-27`, `qwen3-tts-flash-2025-09-18`, `qwen3-tts-instruct-flash`, `qwen3-tts-instruct-flash-2026-01-26` | multimodal generation, Beijing/Singapore where documented |
| Qwen-TTS legacy | `qwen-tts`, `qwen-tts-latest`, `qwen-tts-2025-05-22`, `qwen-tts-2025-04-10` | multimodal generation, Beijing where documented |
| Qwen voice resources | `qwen3-tts-vc-2026-01-22`, `qwen3-tts-vd-2026-01-26` | customization endpoint, Beijing/Singapore where documented |
| MiniMax | `MiniMax/speech-2.8-hd`, `MiniMax/speech-02-hd`, `MiniMax/speech-2.8-turbo`, `MiniMax/speech-02-turbo` | multimodal generation, configured host selected by the current MiniMax contract |

The model matrix is an allowlist, not a pattern match. A dated model can be added only by an explicit registry entry with its endpoint and region metadata. The voice cloning/design target model and the model used to perform TTS are separate fields and are both validated against the matrix.

Voice cloning/design model IDs remain separate from TTS model IDs, even when their target model is a TTS model.

### Keep common audio input small

The common TTS request contains `text` and `voice`. Format, sample rate, rate, pitch, volume, language, instructions, and AIGC options remain under `providerOptions.aliyun`. This follows the existing provider namespace rule and avoids pretending that every TTS provider has the same controls.

### Separate TTS protocol parameter families

The registry and types SHALL distinguish Qwen-Audio/CosyVoice fields (`language_hints`, `enable_ssml`, `word_timestamp_enabled`, `seed`, AIGC fields, `hot_fix`, and Markdown filtering) from Qwen-TTS fields (`language_type`, `instructions`, and `optimize_instructions`). Unsupported fields are rejected before Transport rather than silently forwarded. The initial matrix covers `qwen-audio-3.0-tts-plus`, `qwen-audio-3.0-tts-flash`, `cosyvoice-v3.5-plus`, `cosyvoice-v3.5-flash`, `cosyvoice-v3-plus`, `cosyvoice-v3-flash`, `cosyvoice-v2`, `qwen3-tts-flash`, and `qwen3-tts-instruct-flash`; cloning/design model IDs are recorded separately.

MiniMax options remain a separate family: `voice_setting.voice_id`, `speed`, `vol`, `pitch`, `emotion`, plus `audio_setting.sample_rate`, `bitrate`, `format`, and `channel`. Their wire names are not normalized into the Alibaba Qwen option object.

### Model voice capabilities are metadata, not a hard-coded voice catalog

The registry SHALL represent whether a model/voice combination supports SSML, instruction control, word timestamps, dialects, languages, and regions. The SDK SHALL reject only deterministic model capability conflicts. The complete system voice catalog is not hard-coded into the core or provider adapter; it may be maintained as separately versioned documentation/catalog data.

Qwen-Audio emotional/rich-language tags and LaTeX are passed as text. The SDK SHALL not parse, rewrite, or validate the complete tag/LaTeX grammar. It SHALL validate `enable_ssml` compatibility and preserve the caller's original text. CosyVoice `instruction` and Qwen-TTS `instructions` remain distinct fields.

### Use an event stream for SSE TTS

Streaming TTS exposes an async iterable of discriminated events. Intermediate events carry `sentence-begin`, `sentence-synthesis`, or `sentence-end` information; synthesis events carry ordered Base64 audio chunks, and the terminal event may carry the complete temporary URL. The stream supports `AbortSignal` and surfaces provider errors without converting chunks into a buffered `GenerationResult`.

Qwen-TTS streaming chunks are Base64 PCM and the final chunk carries the complete URL. HTTP SSE and WebSocket binary frames are different contracts; the latter is deliberately not represented by this stream.

### Normalize usage without losing provider detail

Audio generation results expose optional `characters`, `inputTokens`, `outputTokens`, `totalTokens`, and `count` usage values. Provider-specific usage details remain available through `raw`; missing fields are omitted rather than represented as zero unless the provider explicitly returned zero.

### Use distinct provider modules behind one public factory

Keep public construction on `createAliyunBailianProvider()`. Internally split audio TTS request mapping and voice resource operations into focused modules so the existing image/video adapter is not expanded with unrelated action branches. All modules receive the factory's shared Transport and use the configured `baseUrl`.

### Handle inline preview audio without decoding

The provider maps `preview_audio.data` directly to `AudioContent.base64`, derives `audio/<format>` where possible, and preserves sample rate in audio metadata. The SDK does not write files or convert formats; callers own persistence and playback decisions.

### MiniMax voice cloning remains a future separate capability

MiniMax voice cloning returns a preview audio URL from a generation request and requires a caller-chosen globally unique `voice_id`; it does not expose the same persistent CRUD contract. It is therefore not registered under the Alibaba `voiceCloning` or `voiceDesign` managers. A later MiniMax-specific preview/clone API can reuse `AudioContent` and `generateAudio` result conventions without weakening these resources.

## Risks / Trade-offs

- [Risk] Alibaba may add or rename voice models and fields. → Isolate model/action mappings in registry and protocol modules, preserve `raw`, and add fixture-driven tests.
- [Risk] `voice-enrollment` is used by both cloning and design in Qwen-Audio/CosyVoice. → Require the manager operation to select the protocol intent and never infer it from the model name alone.
- [Risk] Preview audio is Base64 and can be large. → Keep it as returned content, avoid implicit disk/memory caching, and document caller-controlled persistence.
- [Risk] TTS result URLs are temporary. → Expose expiry metadata when available and document immediate download/persistence for both sync and streaming terminal results.
- [Risk] Provider-specific validation can drift from the live service. → Validate only documented deterministic constraints locally and leave remote content-quality/review decisions to Alibaba.
- [Risk] Complete voice catalogs change independently from model APIs. → Keep voice catalog data separate from protocol adapters and rely on provider-side validation for unknown voices.
- [Risk] SSE Base64 PCM chunks may be mistaken for complete playable files. → Document encoding/container semantics and expose chunk format metadata; do not promise that individual chunks are independently playable.

## Migration Plan

1. Add core audio/content/voice contracts and typed audio generation dispatch without changing image/video APIs.
2. Add Alibaba audio model registry entries and typed provider parameters.
3. Implement TTS mapping, then cloning and design managers through the shared Transport.
4. Add type tests, transport fixture tests, examples, README/API docs, and run focused plus full verification.
5. If a provider contract changes, update the isolated registry/protocol mapping; existing image/video paths remain independently rollbackable.
