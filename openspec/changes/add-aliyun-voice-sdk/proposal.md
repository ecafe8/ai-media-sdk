## Why

The SDK currently supports Alibaba Bailian image and video capabilities, but it has no provider-independent audio contract or API for text-to-speech, voice cloning, or voice design. Alibaba exposes these capabilities through several similar DashScope endpoints with different models, actions, field names, and lifecycle rules, so they need an explicit SDK boundary before implementation.

## What Changes

- Add provider-independent audio result, request, model-instance, and synchronous generation contracts.
- Add `generateAudio()` for non-realtime TTS and reserve the shared async lifecycle for future realtime/asynchronous audio models.
- Add a streaming TTS contract for SSE audio chunks, sentence events, optional word timestamps, abort, and terminal errors.
- Add `provider.voiceCloning` for creating, listing, querying, updating, and deleting cloned voices.
- Add `provider.voiceDesign` for creating, listing, querying, and deleting designed voices.
- Normalize Alibaba's `voice_id`/`voice`, `target_model`, timestamps, status, and preview audio fields into stable SDK types while retaining raw provider responses.
- Implement Alibaba Qwen-Audio-TTS, CosyVoice, Qwen-TTS, and MiniMax non-realtime TTS request/response mappings through the existing `Transport` and regional `baseUrl` configuration.
- Register an explicit model, protocol, endpoint, and region matrix for TTS, voice cloning, and voice design, including stable and snapshot model IDs.
- Support HTTP SSE streaming TTS with ordered audio chunks, sentence events, optional word timestamps, final URLs, cancellation, and errors.
- Model SSML, LaTeX, emotional/rich-language tags, instruction controls, dialect constraints, and voice-specific capabilities without implementing a parser or silently rewriting caller text.
- Normalize characters, token, and operation-count usage fields across provider response formats.
- Register an explicit model/protocol capability matrix and validate model-specific fields, language values, audio formats, sample rates, text lengths, naming rules, and supported operations before network dispatch.
- Keep MiniMax voice cloning outside the persistent voice resource managers because its API is an immediate preview-generation operation rather than voice CRUD.
- Add focused unit tests, type tests, package exports, README/API documentation, and examples without adding provider runtime SDK dependencies.

## Capabilities

### New Capabilities

- `audio-generation`: Provider-independent non-realtime text-to-speech generation with normalized audio results.
- `audio-streaming`: Provider-independent streaming text-to-speech events and audio chunk lifecycle.
- `voice-cloning`: Persistent voice cloning resource management for Alibaba Qwen-Audio-TTS/CosyVoice and Qwen-TTS.
- `voice-design`: Persistent voice design resource management, including preview audio returned during creation.

### Modified Capabilities

- `provider-package-foundation`: Extend the Alibaba provider boundary and registry to expose audio generation plus voice resource managers through the shared transport, while preserving existing image/video behavior and dependency constraints.

## Impact

- `packages/ai-media-sdk`: new audio contracts, audio generation entry point, exports, and shared audio content types.
- `packages/provider-aliyun-bailian`: audio model registry, TTS adapter, voice cloning manager, voice design manager, validation, mapping, exports, and tests.
- Provider README, SDK API reference, and runnable examples.
- Existing `Transport`, `SdkError`, and retry behavior are reused; no external DashScope SDK or other runtime dependency is introduced.
- WebSocket realtime TTS, including `run-task`/`continue-task`/`finish-task` duplex sessions and binary audio frames, is explicitly excluded and will be handled by a separate change because it requires a WebSocket transport boundary.
- Playground UI and browser-side credential handling are out of scope for this change.
