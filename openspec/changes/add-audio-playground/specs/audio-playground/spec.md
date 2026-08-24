## Purpose

Lets developers generate, stream, play, and manage Alibaba speech assets from both Playgrounds, using existing SDK audio and voice-resource contracts without rewriting caller text.

## ADDED Requirements

### Requirement: Both Playgrounds expose Alibaba audio models as audio
The web and site Playgrounds SHALL expose supported Alibaba audio models as `modality: "audio"` and SHALL open an audio workbench rather than an image or video form. Audio models MUST include CosyVoice, Qwen-Audio TTS, Qwen-TTS, and MiniMax TTS registry entries that already exist in the Alibaba provider.

#### Scenario: Audio tab is enabled
- **WHEN** a user opens either Playground and selects the audio modality
- **THEN** the audio workbench lists supported Alibaba audio models and does not show image-only or video-only controls

#### Scenario: Audio model is not projected as image
- **WHEN** the Playground registry is built from the Alibaba model registry
- **THEN** CosyVoice, Qwen-Audio TTS, Qwen-TTS, and MiniMax TTS entries have audio modality and are not treated as image models

#### Scenario: Unsupported provider is requested for audio
- **WHEN** a user requests audio generation with a provider or model that does not support audio
- **THEN** the request is rejected with a stable validation error before provider dispatch

### Requirement: User can submit a non-realtime audio request
Each Playground SHALL accept non-empty `text` and `voice` values and SHALL call the existing audio generation contract for the selected model. Optional family-specific controls SHALL be omitted when unset.

#### Scenario: Valid CosyVoice request
- **WHEN** the user submits text and a voice for a CosyVoice model
- **THEN** the Playground returns a successful audio result without rewriting the text

#### Scenario: Missing required audio input
- **WHEN** the user submits empty text or empty voice
- **THEN** the Playground rejects the request with a validation error and does not call the provider

### Requirement: Family-specific controls are shown only when supported
The audio workbench SHALL switch option families by model:

- CosyVoice / Qwen-Audio: format, sample rate, rate, pitch, volume, SSML, language hints, instruction, and word-timestamp options when supported
- Qwen-TTS: language type, instructions, and optimize-instructions when supported
- MiniMax: `voiceSetting` and `audioSetting` when supported

Unsupported options MUST be hidden or rejected before transport.

#### Scenario: SSML control is available
- **WHEN** the selected model supports SSML and the user enables it
- **THEN** the request sends `enableSsml` as enabled and preserves the entered text exactly

#### Scenario: Qwen-TTS does not expose SSML
- **WHEN** the user selects a Qwen-TTS model
- **THEN** the workbench does not send CosyVoice `enableSsml` or MiniMax `voiceSetting` fields

#### Scenario: Unsupported control is selected
- **WHEN** a user selects a format, sample rate, or SSML option not supported by the selected model
- **THEN** the Playground rejects the request before provider dispatch with a stable validation error

### Requirement: SSML and LaTeX text are passed through unchanged
The Playground SHALL treat SSML and LaTeX as ordinary text. It MUST NOT parse, rewrite, render, or auto-escape caller text. JSON/runtime backslash escaping required by the transport is allowed.

#### Scenario: SSML markup is submitted
- **WHEN** the user submits `<speak rate="2">我的语速比正常人快。</speak>` with SSML enabled on a supporting model
- **THEN** the provider receives the same markup and the Playground handles the response as audio generation

#### Scenario: LaTeX formula is submitted
- **WHEN** the user submits Chinese text containing `$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$`
- **THEN** the provider receives the same formula content and the Playground does not render or validate the formula

### Requirement: Audio results are playable and downloadable
Successful URL or Base64 `mp3`/`wav` results SHALL render in an accessible `<audio controls>` player with a download action. PCM or other non-playable containers MUST NOT be presented as directly playable `<audio src>` values; they SHALL be converted to a WAV Blob or offered as download-only. Temporary URLs SHALL show expiry or persistence guidance when available.

#### Scenario: URL audio result
- **WHEN** the provider returns an `mp3` or `wav` URL
- **THEN** the result feed renders an audio player and a download link

#### Scenario: Base64 audio result
- **WHEN** the provider returns Base64 audio and a usable MIME type or format
- **THEN** the result feed builds a data URL or Blob URL and renders it in an audio player

#### Scenario: PCM result
- **WHEN** the provider returns PCM audio
- **THEN** the Playground does not assign the raw PCM to `<audio src>` and instead converts it to WAV or offers download-only

### Requirement: Users can stream HTTP SSE audio
Each Playground SHALL support an optional streaming mode that consumes `streamAudio()` events: `sentence-begin`, `sentence-synthesis`, `sentence-end`, and `complete`. Streaming MUST use POST-capable transport, not `EventSource`. Individual PCM chunks MUST NOT be treated as independently playable files. The default playback mode SHALL accumulate chunks and produce a WAV Blob after completion; an optional low-latency Web Audio mode MAY schedule decoded PCM buffers after a user gesture. Cancellation SHALL abort the stream.

#### Scenario: Stream completes successfully
- **WHEN** the user starts streaming TTS for a supporting model
- **THEN** the Playground shows stream progress, produces a playable WAV or complete audio result, and does not treat intermediate PCM chunks as complete files

#### Scenario: Stream is cancelled
- **WHEN** the user cancels an in-flight stream
- **THEN** the Playground aborts the request and stops scheduling additional audio buffers

#### Scenario: Stream event lacks playback metadata
- **WHEN** a synthesis event does not include enough format or sample-rate metadata to decode PCM
- **THEN** the Playground keeps accumulating or falls back to the complete URL/result instead of guessing a playable file

### Requirement: Users can clone and design voices
Both Playgrounds SHALL expose separate cloning and design workflows using the existing Alibaba voice managers. Cloning SHALL support create, list, get, update, and delete. Design SHALL support create, list, get, and delete, and MUST NOT offer update. Created voices MUST remain bound to their `targetModel` when later used for TTS. MiniMax voice cloning remains out of scope.

#### Scenario: User clones a voice from a public URL
- **WHEN** the user submits a public audio URL, protocol, target model, and required name/prefix
- **THEN** the Playground creates a cloned voice and can use its id as the TTS voice for that target model

#### Scenario: User designs a voice
- **WHEN** the user submits a voice prompt, preview text, protocol, and target model
- **THEN** the Playground creates a designed voice, plays any returned preview audio, and does not offer an update action

#### Scenario: Design update is requested
- **WHEN** a client attempts to update a designed voice
- **THEN** the Playground rejects the request without sending a cloning update action

### Requirement: Local audio upload is supported for voice resources
Voice cloning and design SHALL accept either a public URL or a local audio file. Local files MUST be uploaded through the Aliyun temporary-file uploader, bound to the selected target model, and converted to an `oss://` URL before the voice-resource request. The Playground SHALL validate size, MIME/extension, and required filename, and SHALL display expiry guidance for uploaded files.

#### Scenario: Local file is uploaded in the web Playground
- **WHEN** a web user selects a local audio file for cloning
- **THEN** the file is uploaded through the server-proxied Aliyun uploader and the resulting `oss://` URL is used to create the voice

#### Scenario: Local file is uploaded in the site Playground
- **WHEN** a site user selects a local audio file for cloning
- **THEN** the browser uses a Node-`fs`-free Aliyun upload path with the stored BYO key and binds the upload to the selected target model

#### Scenario: Upload is missing a target model
- **WHEN** a user attempts to upload a local file without selecting a target model
- **THEN** the Playground rejects the upload before contacting Aliyun

### Requirement: Web audio traffic stays server-proxied and protected
The web Playground SHALL keep Alibaba API keys and authorization headers on the server. Audio generate, stream, upload, and voice-resource routes SHALL enforce a maximum 64 KiB JSON body or equivalent multipart size limit, a maximum 10,000-character text value, the configured provider timeout, and five audio operations per client per minute through a shared rate-limit mechanism. If the shared limiter is unavailable, audio features MUST remain disabled. Non-idempotent generation MUST NOT be retried automatically. Responses and logs MUST NOT include API keys or authorization headers.

#### Scenario: Request exceeds a configured limit
- **WHEN** a web audio request body or text exceeds the configured maximum
- **THEN** the endpoint rejects it before provider dispatch with a stable validation error

#### Scenario: Shared limiter is unavailable
- **WHEN** the web deployment has no shared rate-limit mechanism
- **THEN** audio generate, stream, upload, and voice-resource routes remain disabled

#### Scenario: Audio request is processed
- **WHEN** the web server dispatches an audio or voice-resource request using configured credentials
- **THEN** the response and logged request details contain no API key or authorization header

### Requirement: Site audio traffic stays BYO-key and browser-direct
The site Playground SHALL send audio, stream, upload, and voice-resource requests from the browser using the existing key store. It MUST require complete Alibaba credentials and a usable confirmed endpoint, surface CORS and custom-host failures as sanitized configuration errors, and MUST NOT persist provider credentials on a project server.

#### Scenario: Site credentials are missing
- **WHEN** a site user starts audio generation without a complete Alibaba key and base URL
- **THEN** the Playground asks the user to configure API settings and does not send a provider request

#### Scenario: Site endpoint is unusable
- **WHEN** the stored Alibaba endpoint is invalid, unconfirmed, or blocked by CORS
- **THEN** the Playground shows a sanitized configuration or network error and does not claim server-side proxying is available

### Requirement: Provider failures are safe and actionable
Both Playgrounds SHALL map validation, authentication, timeout, network, CORS, upload, and provider failures to stable user-facing errors without exposing credentials, request headers, or internal stack traces.

#### Scenario: Provider request fails
- **WHEN** Alibaba rejects or cannot complete an audio or voice-resource request
- **THEN** the Playground shows a sanitized error and retains no secret provider data in the response
