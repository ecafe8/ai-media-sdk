## 1. Core Audio Contracts

- [ ] 1.1 Add `AudioContent` and audio metadata fields to the core content contracts.
- [ ] 1.2 Add `VoiceProfile`, voice operation result, pagination, and normalized preview-audio contracts.
- [ ] 1.3 Add `AudioGenerationInput`, `AudioGenerationRequest`, and `AudioModelInstance` with typed provider options.
- [ ] 1.4 Implement and export `generateAudio()` with modality/capability checks and preflight validation.
- [ ] 1.5 Add `streamAudio()` and discriminated SSE event contracts for sentence events, audio chunks, word timestamps, abort, and terminal errors.
- [ ] 1.6 Add core audio and voice contract tests, including invalid input rejection before adapter dispatch.

## 2. Alibaba Registry And Parameters

- [ ] 2.1 Extend the Alibaba registry with supported Qwen-Audio/CosyVoice and Qwen-TTS audio model entries.
- [ ] 2.2 Add an explicit matrix covering TTS models (`qwen-audio-3.0-tts-plus`, `qwen-audio-3.0-tts-flash`, `cosyvoice-v3.5-plus`, `cosyvoice-v3.5-flash`, `cosyvoice-v3-plus`, `cosyvoice-v3-flash`, `cosyvoice-v2`, `qwen3-tts-flash`, `qwen3-tts-instruct-flash`) and cloning/design model IDs.
- [ ] 2.3 Add registry metadata for cloning/design protocol, supported operations, languages, formats, sample rates, and limits.
- [ ] 2.4 Add separate typed Qwen-Audio/CosyVoice and Qwen-TTS `providerOptions.aliyun` parameter families.
- [ ] 2.5 Add typed `provider.audio(modelId)` overloads and public exports.
- [ ] 2.6 Add registry and family-typing tests for audio models.

## 3. Alibaba Non-Realtime TTS

- [ ] 3.1 Implement Qwen-Audio-TTS/CosyVoice `SpeechSynthesizer` request mapping and headers.
- [ ] 3.2 Implement Qwen-TTS multimodal generation request mapping and headers.
- [ ] 3.3 Map URL and inline Base64 audio responses to `AudioContent`, including request ID and expiry metadata.
- [ ] 3.4 Validate text, voice, format, sample rate, volume, rate, pitch, language, and instruction constraints before Transport.
- [ ] 3.5 Reject protocol-incompatible options and validate SSML, timestamp, seed, AIGC, hot-fix, Markdown, language, and instruction options before Transport.
- [ ] 3.6 Implement SSE streaming mapping, ordered Base64 chunks, sentence events, word timestamps, final URL, abort, and stream errors.
- [ ] 3.7 Classify HTTP/provider errors as sanitized `SdkError` values.
- [ ] 3.8 Add focused sync and streaming TTS Transport fixture tests for both protocol families and error paths.

## 4. Alibaba Voice Cloning

- [ ] 4.1 Implement `voiceCloning.create()` for Qwen-Audio/CosyVoice audio URL input.
- [ ] 4.2 Implement `voiceCloning.create()` for Qwen-TTS public URL and supported Data URL input.
- [ ] 4.3 Implement cloning list, get, update, and delete action mappings with Qwen/Qwen-Audio identifier differences.
- [ ] 4.4 Normalize cloning records, statuses, timestamps, target models, resource links, and raw metadata.
- [ ] 4.5 Validate protocol-specific names, URLs/Data URLs, languages, and operation compatibility before Transport.
- [ ] 4.6 Add cloning CRUD, pagination, validation, and error tests.
- [ ] 4.7 Add explicit tests for Qwen-TTS preferred-name, Data URL MIME, language, and unsupported-update boundaries.

## 5. Alibaba Voice Design

- [ ] 5.1 Implement Qwen-Audio/CosyVoice voice design create/list/get/delete mappings.
- [ ] 5.2 Implement Qwen voice design create/list/get/delete mappings.
- [ ] 5.3 Map `preview_audio` Base64 data, format, sample rate, and MIME type into the design creation result.
- [ ] 5.4 Validate description/preview text limits, naming rules, supported languages, sample rates, and formats.
- [ ] 5.5 Ensure update is unavailable from the design manager and never emits a cloning update action.
- [ ] 5.6 Add design lifecycle, preview audio, validation, and error tests.
- [ ] 5.7 Add model-specific voice prompt, preview text, language, sample-rate, and response-format boundary tests.

## 6. Documentation And Examples

- [ ] 6.1 Update Alibaba Provider README with TTS, cloning, and design examples and capability tables.
- [ ] 6.2 Update SDK API reference and Chinese provider documentation with the three-way naming boundary.
- [ ] 6.3 Add runnable Alibaba audio/TTS and voice-resource example configuration without committing credentials.
- [ ] 6.4 Document temporary audio URLs, inline preview data, upload expectations, and MiniMax out-of-scope behavior.

## 7. Verification And Release

- [ ] 7.1 Run focused core and Alibaba tests plus type tests.
- [ ] 7.2 Run `bun run lint`.
- [ ] 7.3 Run `bun run typecheck`.
- [ ] 7.4 Run `bun run build`.
- [ ] 7.5 Run `bun run test`.
- [ ] 7.6 Run `openspec validate "add-aliyun-voice-sdk" --type change --strict` and review the final diff.
- [ ] 7.7 Commit the change and implementation together only after verification passes.
