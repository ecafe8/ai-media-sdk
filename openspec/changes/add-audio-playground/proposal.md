## Why

The Alibaba audio SDK already exposes non-realtime TTS, HTTP SSE streaming, SSML/LaTeX pass-through, voice cloning, and voice design, but both Playgrounds still treat audio as a disabled placeholder. Users therefore cannot try CosyVoice, Qwen-Audio, Qwen-TTS, MiniMax speech, or voice-resource workflows from the controlled web Playground or the public BYO-key site, and the site docs still describe Alibaba as image/video only.

## What Changes

- Enable the audio modality in both `apps/web` and `apps/site` Playgrounds with a dedicated `AudioWorkbench`.
- Project Alibaba audio models as `modality: "audio"` instead of image, covering CosyVoice, Qwen-Audio TTS, Qwen-TTS, and MiniMax TTS families.
- Add non-realtime generation through existing `generateAudio()` / `provider.audio(model)` contracts, with family-specific option panels.
- Add HTTP SSE streaming through existing `streamAudio()`, using native `fetch` + `ReadableStream` and Web Audio / WAV playback. WebSocket realtime TTS remains out of scope.
- Pass SSML and LaTeX text unchanged. The Playground MUST NOT parse, rewrite, render, or auto-escape caller text.
- Support voice cloning and voice design resource managers in both Playgrounds: create, list, get, delete, plus cloning update. Design update remains unavailable.
- Accept public audio URLs and local file uploads for cloning/design. Local files reuse `@ai-media/uploader` Aliyun temporary OSS (`oss://`) and bind the upload to the selected target model.
- Keep `apps/web` server-proxied: credentials stay on the server; add generate, stream, upload, and voice-resource API routes with request-size, timeout, and shared rate-limit protections.
- Keep `apps/site` BYO-key and browser-direct: credentials stay in the existing key store; document CORS, custom-host confirmation, and browser-safe upload constraints.
- Add Chinese and English site documentation for audio generation, streaming, SSML, LaTeX, result lifecycle, voice cloning, voice design, and upload.

## Capabilities

### New Capabilities

- `audio-playground`: Dual-app audio Playground covering Alibaba TTS families, SSML/LaTeX pass-through, SSE streaming playback, local/URL upload, and voice cloning/design resource workflows.
- `audio-generation-docs`: Site documentation for the SDK audio APIs, Alibaba model/option matrix, streaming and persistence constraints, and Playground credential differences.

### Modified Capabilities

- None.

## Impact

- `apps/web` Playground types, registry, API routes, server executor, audio workbench, result feed, and upload/voice-resource routes.
- `apps/site` Playground types, registry, executor, provider-client, audio workbench, result feed, i18n, and BYO-key upload path.
- Alibaba registry metadata used to drive family-specific forms, SSML/format/sample-rate capability checks, and voice-resource protocol selection.
- `@ai-media/uploader` Aliyun path: web uses server-side `fileBytes`; site needs a browser-safe upload surface that does not import Node `fs`.
- Existing `@ai-media/sdk` and `@ai-media/provider-aliyun-bailian` public contracts are reused. Streaming event metadata may be extended only if current `AudioContent` cannot carry sample rate, channels, or bit depth needed for PCM playback.
- Site MDX docs, documentation manifest, and bilingual navigation.
- No WebSocket realtime TTS, no MiniMax voice manager, no automatic persistence of temporary result URLs, and no KaTeX/MathJax documentation renderer.
