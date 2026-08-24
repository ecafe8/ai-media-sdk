## 1. Registry And Shared Contracts

- [ ] 1.1 Extend Alibaba audio registry entries with Playground-facing metadata: family, SSML support, formats, sample rates, instruction field, region/endpoint, and voice-resource protocol/target compatibility.
- [ ] 1.2 Extend web and site Playground model/request/response types with `modality: "audio"`, explicit `text`/`voice`, family options, stream events, audio content, and voice-resource payloads.
- [ ] 1.3 Fix web projection so Alibaba audio models remain audio, and stop site from dropping CosyVoice, Qwen-Audio, Qwen-TTS, and MiniMax TTS families.
- [ ] 1.4 Add or extend stream event metadata so PCM chunks can carry or inherit format, sample rate, channels, and bit depth without treating chunks as complete files.
- [ ] 1.5 Add registry and type tests proving audio modality projection, family option isolation, and unchanged image/video models.

## 2. Web Server Audio APIs

- [ ] 2.1 Extend or add the web generate route to accept audio requests, require non-empty text/voice, reject unsupported providers/models/options, and call `generateAudio()`.
- [ ] 2.2 Add `POST /api/playground/audio/stream` that forwards `streamAudio()` as SSE, honors client abort, and never uses `EventSource`.
- [ ] 2.3 Add `POST /api/playground/audio/upload` that accepts a local audio file, binds it to the selected target model, and uploads through `createAliyunUploader().upload({ fileBytes, fileName, model })`.
- [ ] 2.4 Add voice-resource routes for cloning create/list/get/update/delete and design create/list/get/delete; reject design update.
- [ ] 2.5 Enforce named 64 KiB JSON / equivalent multipart, 10,000-character text, configured timeout, and five-per-client-per-minute shared rate limits on all audio routes; disable audio when the shared limiter is unavailable; do not auto-retry generate/stream/create.
- [ ] 2.6 Sanitize audio/upload/voice errors and logs so API keys and authorization headers never leave the server.
- [ ] 2.7 Add route and server tests for valid generation, missing text/voice, SSML/LaTeX pass-through, unsupported options, stream abort, upload model binding, design-update rejection, limits, rate limiting, and credential redaction.

## 3. Site Browser Execution

- [ ] 3.1 Extend the site executor and provider-client to construct `provider.audio(model)` and call `generateAudio()` / `streamAudio()` with stored Alibaba credentials.
- [ ] 3.2 Add site voice-resource execution through `provider.voiceCloning` and `provider.voiceDesign`, including protocol and target-model validation.
- [ ] 3.3 Surface missing credentials, unconfirmed hosts, invalid endpoints, and CORS/network failures as sanitized configuration errors.
- [ ] 3.4 Add executor tests for audio success, missing voice/text, family option mapping, stream cancellation, voice create/list/delete, and credential/endpoint failures.

## 4. Browser-Safe Upload

- [ ] 4.1 Split or add an Aliyun uploader entry that accepts `fileBytes`/`fileName`/`model` without importing `node:fs/promises`.
- [ ] 4.2 Keep the existing Node `filePath` factory for examples and server use.
- [ ] 4.3 Validate MIME/extension, filename, size, and required target model before requesting a DashScope policy.
- [ ] 4.4 Wire web upload through the server route and site upload through the browser-safe entry with the BYO key.
- [ ] 4.5 Add uploader and Playground tests for `oss://` results, missing model, oversized files, and Node-vs-browser export isolation.

## 5. Audio Workbench And Playback

- [ ] 5.1 Add an independent `AudioWorkbench` in both apps using existing shared UI primitives, with model/family-aware fields for text, voice, format, sample rate, rate/pitch/volume, SSML, Qwen-TTS instructions, and MiniMax voice/audio settings.
- [ ] 5.2 Enable the audio modality tab in both Playground shells and keep image/video workbenches isolated.
- [ ] 5.3 Render URL and Base64 `mp3`/`wav` results with `<audio controls>`, download, MIME-aware Blob/data URLs, and temporary-URL guidance.
- [ ] 5.4 Implement default accumulate-to-WAV streaming playback and optional Web Audio low-latency scheduling after a user gesture; never assign raw PCM to `<audio src>`.
- [ ] 5.5 Add form and result tests for required fields, family option serialization, URL/Base64 playback, PCM conversion, stream progress/cancel, and failed responses.

## 6. Voice Cloning And Design UI

- [ ] 6.1 Add a cloning panel for protocol, target model, public URL or local upload, prefix/preferred name, language, and list/get/update/delete.
- [ ] 6.2 Add a design panel for protocol, target model, voice prompt, preview text, naming, language, sample rate, response format, preview-audio playback, and list/get/delete without update.
- [ ] 6.3 Allow a created voice id to populate the TTS voice field only when the selected TTS model matches the voice `targetModel`.
- [ ] 6.4 Add UI/API tests for URL create, local-upload create, preview playback, design-update rejection, and target-model mismatch.

## 7. Documentation

- [ ] 7.1 Add Chinese and English `audio-generation` MDX pages covering `generateAudio()`, `streamAudio()`, all Alibaba audio families, SSML, LaTeX, PCM/WAV playback, temporary URLs, and Playground credential differences.
- [ ] 7.2 Update Chinese Alibaba provider docs and add the English counterpart with the audio model/option/voice-resource matrix and upload/`oss://` notes.
- [ ] 7.3 Register `audio-generation` in the site docs manifest and verify both-language navigation.
- [ ] 7.4 Keep SSML/LaTeX examples in fenced code blocks and add docs tests for frontmatter, navigation, escaped LaTeX, SSML limits, streaming-not-WebSocket, and web-versus-site credential guidance.

## 8. Verification

- [ ] 8.1 Confirm WebSocket realtime TTS and MiniMax voice managers remain unimplemented and undocumented as available Playground features.
- [ ] 8.2 Confirm SSML/LaTeX text is forwarded unchanged in web and site request paths.
- [ ] 8.3 Run focused web, site, SDK, provider, and uploader tests, then `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test`.
- [ ] 8.4 Run `openspec validate "add-audio-playground" --type change --strict` and review the implementation against both capability specs.
