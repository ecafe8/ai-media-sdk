## 1. Core Audio Contracts

- [x] 1.1 Add `AudioContent` and audio metadata fields to the core content contracts.
- [x] 1.2 Add `VoiceProfile`, voice operation result, pagination, and normalized preview-audio contracts.
- [x] 1.3 Add `AudioGenerationInput`, `AudioGenerationRequest`, and `AudioModelInstance` with typed provider options.
- [x] 1.4 Implement and export `generateAudio()` with modality/capability checks and preflight validation.
- [x] 1.5 Add `streamAudio()` and discriminated SSE event contracts for sentence events, audio chunks, word timestamps, abort, and terminal errors.
- [ ] 1.6 Add core audio and voice contract tests, including invalid input rejection before adapter dispatch.

## 2. Alibaba Registry And Parameters

- [x] 2.1 Extend the Alibaba registry with supported Qwen-Audio/CosyVoice and Qwen-TTS audio model entries.
- [ ] 2.2 Add an explicit matrix covering TTS models (`qwen-audio-3.0-tts-plus`, `qwen-audio-3.0-tts-flash`, `cosyvoice-v3.5-plus`, `cosyvoice-v3.5-flash`, `cosyvoice-v3-plus`, `cosyvoice-v3-flash`, `cosyvoice-v2`, `qwen3-tts-flash`, `qwen3-tts-flash-2025-11-27`, `qwen3-tts-flash-2025-09-18`, `qwen3-tts-instruct-flash`, `qwen3-tts-instruct-flash-2026-01-26`, `qwen-tts`, `qwen-tts-latest`, `qwen-tts-2025-05-22`, `qwen-tts-2025-04-10`, and the four MiniMax speech models) plus cloning/design model IDs.
- [ ] 2.3 Add registry metadata for cloning/design protocol, supported operations, languages, formats, sample rates, and limits.
- [ ] 2.4 Add separate typed Qwen-Audio/CosyVoice and Qwen-TTS `providerOptions.aliyun` parameter families.
- [x] 2.5 Add typed `provider.audio(modelId)` overloads and public exports.
- [ ] 2.6 Add registry and family-typing tests for audio models.

## 3. Alibaba Non-Realtime TTS

- [x] 3.1 Implement Qwen-Audio-TTS/CosyVoice `SpeechSynthesizer` request mapping and headers.
- [x] 3.2 Implement Qwen-TTS multimodal generation request mapping and headers.
- [x] 3.3 Map URL and inline Base64 audio responses to `AudioContent`, including request ID and expiry metadata.
- [ ] 3.4 Validate text, voice, format, sample rate, volume, rate, pitch, language, and instruction constraints before Transport.
- [ ] 3.5 Reject protocol-incompatible options and validate SSML, timestamp, seed, AIGC, hot-fix, Markdown, language, and instruction options before Transport.
- [ ] 3.6 Implement SSE streaming mapping, ordered Base64 chunks, sentence events, word timestamps, final URL, abort, and stream errors.
- [ ] 3.7 Classify HTTP/provider errors as sanitized `SdkError` values.
- [ ] 3.8 Add focused sync and streaming TTS Transport fixture tests for both protocol families and error paths.
- [ ] 3.9 Implement MiniMax non-realtime and HTTP SSE TTS mapping with separate `voice_setting` and `audio_setting` options.
- [ ] 3.10 Add MiniMax TTS response, usage, endpoint, model-region, and option validation tests.
- [ ] 3.11 Add deterministic capability checks for SSML, LaTeX pass-through, emotional/rich-language tags, dialects, instructions, word timestamps, and voice/model compatibility without parsing or rewriting caller text.
- [ ] 3.12 Add endpoint/region matrix tests proving SpeechSynthesizer versus multimodal-generation routing and rejecting unsupported regions before transport.

## 4. Alibaba Voice Cloning

- [x] 4.1 Implement `voiceCloning.create()` for Qwen-Audio/CosyVoice audio URL input.
- [x] 4.2 Implement `voiceCloning.create()` for Qwen-TTS public URL and supported Data URL input.
- [x] 4.3 Implement cloning list, get, update, and delete action mappings with Qwen/Qwen-Audio identifier differences.
- [ ] 4.4 Normalize cloning records, statuses, timestamps, target models, resource links, and raw metadata.
- [ ] 4.5 Validate protocol-specific names, URLs/Data URLs, languages, and operation compatibility before Transport.
- [ ] 4.6 Add cloning CRUD, pagination, validation, and error tests.
- [ ] 4.7 Add explicit tests for Qwen-TTS preferred-name, Data URL MIME, language, and unsupported-update boundaries.

## 5. Alibaba Voice Design

- [x] 5.1 Implement Qwen-Audio/CosyVoice voice design create/list/get/delete mappings.
- [x] 5.2 Implement Qwen voice design create/list/get/delete mappings.
- [x] 5.3 Map `preview_audio` Base64 data, format, sample rate, and MIME type into the design creation result.
- [ ] 5.4 Validate description/preview text limits, naming rules, supported languages, sample rates, and formats.
- [ ] 5.5 Ensure update is unavailable from the design manager and never emits a cloning update action.
- [ ] 5.6 Add design lifecycle, preview audio, validation, and error tests.
- [ ] 5.7 Add model-specific voice prompt, preview text, language, sample-rate, and response-format boundary tests.

## 6. Documentation And Examples

- [x] 6.1 Update Alibaba Provider README with TTS, cloning, and design examples and capability tables.
- [ ] 6.2 Update SDK API reference and Chinese provider documentation with the three-way naming boundary.
- [ ] 6.3 Add runnable Alibaba audio/TTS and voice-resource example configuration without committing credentials.
- [ ] 6.4 Document temporary audio URLs, inline preview data, upload expectations, and MiniMax out-of-scope behavior.
- [ ] 6.5 Document the complete non-realtime model/protocol/endpoint/region matrix, including stable and snapshot model IDs.
- [ ] 6.6 Document HTTP SSE versus WebSocket realtime boundaries, PCM chunk semantics, final URL behavior, usage normalization, and voice capability metadata.
- [ ] 6.7 Keep system voice catalogs separately versioned from the model registry and document that unsupported voice/model combinations are provider errors unless deterministically known locally.

## 7. Verification And Release

- [x] 7.1 Run focused core and Alibaba tests plus type tests.
- [x] 7.2 Run `bun run lint`.
- [x] 7.3 Run `bun run typecheck`.
- [x] 7.4 Run `bun run build`.
- [x] 7.5 Run `bun run test`.
- [x] 7.6 Run `openspec validate "add-aliyun-voice-sdk" --type change --strict` and review the final diff.
- [ ] 7.7 Commit the change and implementation together only after verification passes.
