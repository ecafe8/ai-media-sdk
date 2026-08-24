## Purpose

Documents the SDK audio APIs and Alibaba speech capabilities so users can generate, stream, persist, and manage voices from code or either Playground without confusing CosyVoice, Qwen-TTS, MiniMax, or WebSocket realtime contracts.

## ADDED Requirements

### Requirement: Site documents audio generation
The site documentation SHALL provide Chinese and English audio-generation pages covering `generateAudio()`, `streamAudio()`, required `text` and `voice` inputs, Alibaba audio families, family-specific options, and URL/Base64/PCM result formats.

#### Scenario: User opens the audio guide
- **WHEN** a user navigates to the audio-generation guide in either supported language
- **THEN** the page explains how to construct a non-realtime request, how to consume the result, and which Alibaba families are supported

### Requirement: Site documents the Alibaba audio model matrix
The Alibaba provider documentation SHALL list CosyVoice, Qwen-Audio TTS, Qwen-TTS, and MiniMax TTS models, their endpoint families, region constraints where documented, SSML support, instruction-field differences, and voice-resource protocol differences.

#### Scenario: User compares audio families
- **WHEN** a user reads the Alibaba audio section
- **THEN** the page distinguishes CosyVoice/Qwen-Audio `enableSsml`/`instruction` fields from Qwen-TTS `instructions` and MiniMax `voiceSetting`/`audioSetting`

### Requirement: Site documents SSML behavior
The documentation SHALL explain CosyVoice/Qwen-Audio SSML enablement, supported model and voice constraints, commonly used tags, XML escaping requirements, and the one-request limitation for supported streaming protocols. It SHALL state that the Playground and SDK pass SSML through and do not parse or rewrite it.

#### Scenario: User reads SSML guidance
- **WHEN** a user reads the SSML section
- **THEN** the page shows a code-block example and identifies unsupported model, voice, and interface combinations

### Requirement: Site documents LaTeX behavior
The documentation SHALL explain that CosyVoice accepts supported Chinese LaTeX formulas through `$...$`, `$$...$$`, `\(...\)`, or `\[...\]`, that backslashes must be escaped in source strings and JSON, that formulas must contain formula content only, and that unsupported syntax may not be read accurately. It SHALL state that the Playground passes formulas through and does not render or validate them.

#### Scenario: User reads LaTeX guidance
- **WHEN** a user reads the LaTeX section
- **THEN** the page shows an escaped source-string example and states that Markdown math fences are not supported

### Requirement: Site documents streaming and playback constraints
The documentation SHALL explain HTTP SSE versus WebSocket realtime boundaries, PCM chunk semantics, sample-rate metadata, default accumulate-to-WAV playback, optional Web Audio low-latency playback, and that individual chunks are not independently playable files. It SHALL state that the current Playgrounds support HTTP SSE only.

#### Scenario: User reads streaming guidance
- **WHEN** a user reads the streaming section
- **THEN** the page tells the user to use `streamAudio()` or the Playground stream mode, not WebSocket realtime APIs, and not to assign raw PCM chunks to `<audio src>`

### Requirement: Site documents voice resources and uploads
The documentation SHALL explain cloning and design as separate managers, required protocol and target-model binding, public URL and local-upload inputs, `oss://` expiry, and that MiniMax voice cloning is out of scope. It SHALL distinguish the web server-proxied upload path from the site browser-direct BYO-key path.

#### Scenario: User handles a cloned or designed voice
- **WHEN** a user follows the voice-resource guidance
- **THEN** the user is told to bind the voice to its target model, persist temporary upload and result URLs when longer-term access is required, and not to expect a design update API

### Requirement: Site documents Playground credential differences
The documentation SHALL state that `apps/web` keeps provider credentials on the server and that `apps/site` is a BYO-key browser-direct environment requiring CORS-capable endpoints and confirmed custom hosts.

#### Scenario: User chooses a Playground
- **WHEN** a user reads the Playground or Alibaba audio setup section
- **THEN** the page explains the credential and CORS difference between the controlled web Playground and the public site
