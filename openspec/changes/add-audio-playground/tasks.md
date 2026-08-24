## 1. Web Audio Contracts And Registry

- [ ] 1.1 Extend the web Playground request, model, response, and metadata types with explicit audio fields and normalized audio content.
- [ ] 1.2 Fix Alibaba registry projection so audio entries remain `modality: "audio"`, and add first-slice CosyVoice model labels, recommendations, and allowlisting.
- [ ] 1.3 Add explicit CosyVoice capability metadata/tests for model IDs, Beijing availability, SSML/voice constraints, supported formats, and sample rates.
- [ ] 1.4 Add registry tests proving CosyVoice models are audio models, `apps/site` does not expose runnable audio models, and image/video models remain unchanged.

## 2. Web API And Server Execution

- [ ] 2.1 Extend the Playground API schema and request validation to accept audio requests, require non-empty text and voice, and reject unsupported providers/models before transport.
- [ ] 2.2 Extend provider selection to construct an Alibaba audio model instance for the selected CosyVoice model while preserving existing image/video selection.
- [ ] 2.3 Implement the non-streaming audio execution branch with CosyVoice provider options for format, sample rate, rate, pitch, volume, and SSML.
- [ ] 2.4 Ensure SSML and LaTeX text is forwarded unchanged and optional audio values are omitted when unset.
- [ ] 2.5 Add sanitized audio-specific error handling and metadata mapping for request ID, format, MIME type, and usage.
- [ ] 2.6 Enforce named 64 KiB request-body, 10,000-character text, configured-timeout, and five-per-client-per-minute shared rate-limit boundaries before provider dispatch; keep audio disabled when the shared limiter is unavailable and disable automatic retries for generation.
- [ ] 2.7 Add API and server execution tests for valid audio requests, missing text/voice, SSML, LaTeX pass-through, unsupported models, unsupported controls, limits, rate limiting, timeout, and provider failures.

## 3. Web Audio Workbench And Results

- [ ] 3.1 Add an independent audio workbench using the existing shared UI primitives with text, voice, format, sample rate, rate, pitch, volume, and SSML controls.
- [ ] 3.2 Integrate audio modality selection into the Playground without exposing image/video-only fields for audio models.
- [ ] 3.3 Render URL and Base64 audio results with accessible playback controls for `mp3`/`wav`, MIME-aware data URLs, download actions, and temporary URL guidance; keep PCM download-only.
- [ ] 3.4 Add form and result tests covering required fields, option serialization, URL playback, Base64 playback, and failed responses.

## 4. Site Documentation

- [ ] 4.1 Add complete Chinese and English `audio-generation` MDX pages covering `generateAudio()`, CosyVoice models, SSML, LaTeX, result handling, and limitations.
- [ ] 4.2 Add Chinese and English Alibaba provider documentation sections covering the CosyVoice model/region/voice matrix, SSML/LaTeX constraints, and provider-specific options.
- [ ] 4.3 Register `audio-generation` in the site documentation manifest and verify both language navigation paths.
- [ ] 4.4 Add documentation content tests for required frontmatter, navigation membership, escaped LaTeX examples, and SSML limitation guidance.

## 5. Scope Boundaries And Verification

- [ ] 5.1 Confirm `apps/site` does not expose browser-side TTS execution or advertise audio models as runnable in this slice.
- [ ] 5.2 Confirm WebSocket realtime TTS, streaming playback, voice cloning/design UI, Qwen-TTS, and MiniMax TTS remain out of scope without changing existing SDK behavior.
- [ ] 5.3 Run focused web/site tests and the repository verification sequence: `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test`.
- [ ] 5.4 Run `openspec validate "add-audio-playground" --type change --strict` and review the final implementation against both capability specs.
